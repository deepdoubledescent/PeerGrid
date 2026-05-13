import db from '../db.js';
import notificationService from './notificationService.js';

const parseLocationFilter = (rawLocation) => {
    const value = String(rawLocation || '').trim();
    if (!value) {
        return { raw: '', city: '', country: '' };
    }

    const parts = value
        .split(',')
        .map(part => part.trim())
        .filter(Boolean);

    if (parts.length >= 2) {
        return {
            raw: value,
            city: parts[0],
            country: parts.slice(1).join(', ')
        };
    }

    return {
        raw: value,
        city: '',
        country: value
    };
};

const projectService = {

    searchProjects: async (userSub, filter) => {
        const {
            sortBy,
            page,
            query,
            location,
            institute,
            published_before,
            published_after,
            keywords,
            skills,
            types,
            results_per_page,
        } = filter;
    
        const parsedLocation = parseLocationFilter(location);
        const locationCity = parsedLocation.city;
        const locationCountry = parsedLocation.country;
        const rawLocation = parsedLocation.raw.toLowerCase();
    
        const lowerQuery = query ? `%${query.toLowerCase().trim()}%` : null;
    
        // 1. Fetch current user visibility context if authenticated
        let currentUser = null;
        if (userSub) {
            const [userRows] = await db.execute(
                'SELECT country_id, city_id, institution_id FROM Users WHERE cognito_sub = ?',
                [userSub]
            );
            if (userRows.length > 0) currentUser = userRows[0];
        }
    
        // 2. Build query
        let selectClause = `
            SELECT 
                p.*, 
                c.country_name, 
                ci.city_name, 
                i.institution_name,
                u.name AS author_display_name,
                CASE
                    WHEN ? IS NOT NULL AND LOWER(p.title) LIKE ? THEN 'title'
                    WHEN ? IS NOT NULL AND LOWER(p.short_description) LIKE ? THEN 'short_description'
                    WHEN ? IS NOT NULL AND LOWER(p.long_description) LIKE ? THEN 'long_description'
                    ELSE ''
                END AS relevant_field,
                CASE
                    WHEN ? IS NOT NULL AND LOWER(p.title) LIKE ? THEN 1
                    WHEN ? IS NOT NULL AND LOWER(p.short_description) LIKE ? THEN 2
                    WHEN ? IS NOT NULL AND LOWER(p.long_description) LIKE ? THEN 3
                    ELSE 4
                END AS relevance_score
        `;
    
        const selectParams = Array(12).fill(lowerQuery);
    
        let fromClause = `
            FROM Projects p
            LEFT JOIN Countries c ON p.country_id = c.country_id
            LEFT JOIN Cities ci ON p.city_id = ci.city_id
            LEFT JOIN Institutions i ON p.institution_id = i.institution_id
            LEFT JOIN Users u ON p.cognito_sub = u.cognito_sub
        `;
    
        let whereClauses = [];
        let queryParams = [];
    
        whereClauses.push(`p.completed = 0`);
    
        if (lowerQuery) {
            whereClauses.push(`(
                LOWER(p.title) LIKE ?
                OR LOWER(p.short_description) LIKE ?
                OR LOWER(p.long_description) LIKE ?
            )`);
            queryParams.push(lowerQuery, lowerQuery, lowerQuery);
        }
    
        if (location) {
            if (locationCity && locationCountry) {
                whereClauses.push(`
                    LOWER(ci.city_name) = ?
                    AND LOWER(c.country_name) = ?
                `);
                queryParams.push(locationCity.toLowerCase(), locationCountry.toLowerCase());
            } else {
                whereClauses.push(`
                    (
                        LOWER(c.country_name) = ?
                        OR LOWER(ci.city_name) = ?
                    )
                `);
                queryParams.push(rawLocation, rawLocation);
            }
        }
    
        if (institute) {
            whereClauses.push(`i.institution_name = ?`);
            queryParams.push(institute);
        }
    
        if (published_before) {
            whereClauses.push(`p.published <= ?`);
            queryParams.push(published_before);
        }
    
        if (published_after) {
            whereClauses.push(`p.published >= ?`);
            queryParams.push(published_after);
        }
    
        if (keywords && keywords.length > 0) {
            const placeholders = keywords.map(() => '?').join(',');
            whereClauses.push(`EXISTS (
                SELECT 1
                FROM Project_Topics pt
                JOIN Topics t ON pt.topic_id = t.topic_id
                WHERE pt.project_id = p.project_id
                AND t.topic_name IN (${placeholders})
            )`);
            queryParams.push(...keywords);
        }
    
        if (skills && skills.length > 0) {
            const placeholders = skills.map(() => '?').join(',');
            whereClauses.push(`EXISTS (
                SELECT 1
                FROM Project_Skills ps
                JOIN Skills s ON ps.skill_id = s.skill_id
                WHERE ps.project_id = p.project_id
                AND s.skill_name IN (${placeholders})
            )`);
            queryParams.push(...skills);
        }
    
        if (types && types.length > 0) {
            const placeholders = types.map(() => '?').join(',');
            whereClauses.push(`EXISTS (
                SELECT 1
                FROM Project_Types pt
                JOIN Types t ON pt.type_id = t.type_id
                WHERE pt.project_id = p.project_id
                AND t.type_name IN (${placeholders})
            )`);
            queryParams.push(...types);
        }
    
        if (!currentUser) {
            whereClauses.push(`p.only_same_country = 0`);
            whereClauses.push(`p.only_same_city = 0`);
            whereClauses.push(`p.only_same_institute = 0`);
            whereClauses.push(`NOT EXISTS (
                SELECT 1
                FROM Project_Visible_For_Institutions pvi
                WHERE pvi.project_id = p.project_id
            )`);
        } else {
            whereClauses.push(`(
                p.cognito_sub = ?
                OR (
                    (p.only_same_country = 0 OR p.country_id = ?)
                    AND (p.only_same_city = 0 OR p.city_id = ?)
                    AND (p.only_same_institute = 0 OR p.institution_id = ?)
                    AND (
                        NOT EXISTS (
                            SELECT 1
                            FROM Project_Visible_For_Institutions pvi
                            WHERE pvi.project_id = p.project_id
                        )
                        OR EXISTS (
                            SELECT 1
                            FROM Project_Visible_For_Institutions pvi
                            WHERE pvi.project_id = p.project_id
                            AND pvi.institution_id = ?
                        )
                    )
                )
            )`);
    
            queryParams.push(
                userSub,
                currentUser.country_id,
                currentUser.city_id,
                currentUser.institution_id,
                currentUser.institution_id
            );
        }
    
        const whereString = whereClauses.length > 0
            ? `WHERE ${whereClauses.join(' AND ')}`
            : '';
    
        // 3. Count total
        const countSql = `SELECT COUNT(*) as total ${fromClause} ${whereString}`;
        const [countRows] = await db.execute(countSql, queryParams);
        const total_results = countRows[0].total;
    
        // 4. Sorting + pagination
        let orderByClause = '';
        if (sortBy === 'recommended') {
            orderByClause = 'ORDER BY relevance_score ASC, p.published DESC';
        } else if (sortBy === 'date_newest') {
            orderByClause = 'ORDER BY p.published DESC';
        } else if (sortBy === 'date_oldest') {
            orderByClause = 'ORDER BY p.published ASC';
        } else {
            orderByClause = 'ORDER BY p.published DESC';
        }
    
        const safePage = Math.max(parseInt(page || 1, 10), 1);
        const safeResultsPerPage = Math.max(parseInt(results_per_page || 10, 10), 1);
        const offset = (safePage - 1) * safeResultsPerPage;
    
        const paginatedSql = `
            ${selectClause}
            ${fromClause}
            ${whereString}
            ${orderByClause}
            LIMIT ? OFFSET ?
        `;
    
        const finalParams = [
            ...selectParams,
            ...queryParams,
            String(safeResultsPerPage),
            String(offset)
        ];
    
        const [projects] = await db.execute(
            paginatedSql,
            finalParams.map(p => (p !== null ? p.toString() : null))
        );
    
        if (projects.length === 0) {
            return { projects: [], total_results: 0 };
        }
    
        // 5. Bulk fetch related data
        const projectIds = projects.map(p => p.project_id);
        const placeholders = projectIds.map(() => '?').join(',');
    
        const [
            [skillsRows],
            [topicsRows],
            [docsRows],
            [allowedInstRows],
            [typesRows]
        ] = await Promise.all([
            db.execute(`
                SELECT ps.project_id, s.skill_name
                FROM Project_Skills ps
                JOIN Skills s ON ps.skill_id = s.skill_id
                WHERE ps.project_id IN (${placeholders})
            `, projectIds),
    
            db.execute(`
                SELECT pt.project_id, t.topic_name
                FROM Project_Topics pt
                JOIN Topics t ON pt.topic_id = t.topic_id
                WHERE pt.project_id IN (${placeholders})
            `, projectIds),
    
            db.execute(`
                SELECT document_id, project_id, document_label, document_type, document_required
                FROM Documents
                WHERE project_id IN (${placeholders})
            `, projectIds),
    
            db.execute(`
                SELECT pvi.project_id, i.institution_name
                FROM Project_Visible_For_Institutions pvi
                JOIN Institutions i ON pvi.institution_id = i.institution_id
                WHERE pvi.project_id IN (${placeholders})
            `, projectIds),
    
            db.execute(`
                SELECT pt.project_id, t.type_name
                FROM Project_Types pt
                JOIN Types t ON pt.type_id = t.type_id
                WHERE pt.project_id IN (${placeholders})
            `, projectIds),
        ]);
    
        // 6. Group related rows into maps for fast lookup
        const groupToMap = (rows, valueFn) => {
            const map = new Map();
            for (const row of rows) {
                if (!map.has(row.project_id)) {
                    map.set(row.project_id, []);
                }
                map.get(row.project_id).push(valueFn(row));
            }
            return map;
        };
    
        const skillsMap = groupToMap(skillsRows, r => r.skill_name);
        const topicsMap = groupToMap(topicsRows, r => r.topic_name);
        const allowedInstitutesMap = groupToMap(allowedInstRows, r => r.institution_name);
        const typesMap = groupToMap(typesRows, r => r.type_name);
    
        const docsMap = new Map();
        for (const d of docsRows) {
            if (!docsMap.has(d.project_id)) {
                docsMap.set(d.project_id, []);
            }
            docsMap.get(d.project_id).push({
                id: String(d.document_id),
                label: d.document_label,
                type: d.document_type,
                required: !!d.document_required,
            });
        }
    
        // 7. Format output
        const formattedProjects = projects.map((p) => ({
            id: p.project_id,
            author: p.cognito_sub,
            author_display_name: p.author_display_name,
            title: p.title,
            short_description: p.short_description,
            long_description: p.long_description,
            country: p.country_name,
            city: p.city_name,
            location: p.city_name && p.country_name
                ? `${p.city_name}, ${p.country_name}`
                : (p.city_name || p.country_name || null),
            institute: p.institution_name,
            skills: skillsMap.get(p.project_id) || [],
            topics: topicsMap.get(p.project_id) || [],
            types: typesMap.get(p.project_id) || [],
            workload: p.work_load,
            visibility: {
                onlyInstitute: !!p.only_same_institute,
                onlyCity: !!p.only_same_city,
                onlyCountry: !!p.only_same_country,
                allowedInstitutes: allowedInstitutesMap.get(p.project_id) || [],
            },
            requiredDocuments: docsMap.get(p.project_id) || [],
            published: p.published instanceof Date
                ? p.published.toISOString().split('T')[0]
                : p.published,
            relevant_field: p.relevant_field,
        }));
    
        return {
            projects: formattedProjects,
            total_results,
        };
    },

    createProject: async (cognito_sub, projectData) => {
        // 1. Resolve Country ID (Insert if it doesn't exist)
        const parsedLocation = parseLocationFilter(projectData.location);
        const countryValue = projectData.country || parsedLocation.country;
        const cityValue = projectData.city || parsedLocation.city;

        let countryId = null;
        if (countryValue) {
            await db.execute(
                'INSERT IGNORE INTO Countries (country_name) VALUES (?)',
                [countryValue.trim()]
            );
            const [countryRows] = await db.execute(
                'SELECT country_id FROM Countries WHERE country_name = ?',
                [countryValue.trim()]
            );
            if (countryRows.length > 0) {
                countryId = countryRows[0].country_id;
            }
        }

        let cityId = null;
        if (cityValue && String(cityValue).trim()) {
            if (!countryId) {
                throw new Error('Country must be set before city.');
            }

            const normalizedCity = String(cityValue).trim();

            await db.execute(
                'INSERT IGNORE INTO Cities (city_name, country_id) VALUES (?, ?)',
                [normalizedCity, countryId]
            );

            const [cityRows] = await db.execute(
                'SELECT city_id FROM Cities WHERE city_name = ? AND country_id = ?',
                [normalizedCity, countryId]
            );

            if (cityRows.length > 0) {
                cityId = cityRows[0].city_id;
            }
        }

        // 2. Resolve Institution ID (Insert if it doesn't exist)
        let institutionId = null;
        if (projectData.institute) {
            await db.execute('INSERT IGNORE INTO Institutions (institution_name) VALUES (?)', [projectData.institute]);
            const [instRows] = await db.execute('SELECT institution_id FROM Institutions WHERE institution_name = ?', [projectData.institute]);
            if (instRows.length > 0) institutionId = instRows[0].institution_id;
        }

        // 3. Insert the Core Project (Explicitly ignoring projectData.author, using cognito_sub)
        const vis = projectData.visibility || {};
        const [projectResult] = await db.execute(`
            INSERT INTO Projects (
                cognito_sub, 
                title, 
                short_description, 
                long_description, 
                work_load, 
                published,
                completed,
                only_same_country, 
                only_same_institute, 
                only_same_city, 
                country_id,
                city_id,
                institution_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            cognito_sub,
            projectData.title,
            projectData.short_description,
            projectData.long_description,
            projectData.workload, 
            projectData.published,
            projectData.completed ? 1 : 0,
            vis.onlyCountry ? 1 : 0,
            vis.onlyInstitute ? 1 : 0,
            vis.onlyCity ? 1 : 0,
            countryId,
            cityId,
            institutionId
        ]);

        const projectId = projectResult.insertId;

        // 4. Handle Skills
        if (projectData.skills && projectData.skills.length > 0) {
            for (const skill of projectData.skills) {
                await db.execute('INSERT IGNORE INTO Skills (skill_name) VALUES (?)', [skill]);
                const [skillRows] = await db.execute('SELECT skill_id FROM Skills WHERE skill_name = ?', [skill]);
                
                if (skillRows.length > 0) {
                    await db.execute(
                        'INSERT INTO Project_Skills (project_id, skill_id) VALUES (?, ?)', 
                        [projectId, skillRows[0].skill_id]
                    );
                }
            }
        }

        // 5. Handle Topics (Keywords)
        if (projectData.topics && projectData.topics.length > 0) {
            for (const topic of projectData.topics) {
                await db.execute('INSERT IGNORE INTO Topics (topic_name) VALUES (?)', [topic]);
                const [topicRows] = await db.execute('SELECT topic_id FROM Topics WHERE topic_name = ?', [topic]);
                
                if (topicRows.length > 0) {
                    await db.execute(
                        'INSERT INTO Project_Topics (project_id, topic_id) VALUES (?, ?)', 
                        [projectId, topicRows[0].topic_id]
                    );
                }
            }
        }

        // Handle Types
        if (projectData.types && projectData.types.length > 0) {
            for (const typeName of projectData.types) {
                const [typeRows] = await db.execute(
                    'SELECT type_id FROM Types WHERE type_name = ?',
                    [typeName]
                );

                if (typeRows.length > 0) {
                    await db.execute(
                        'INSERT IGNORE INTO Project_Types (project_id, type_id) VALUES (?, ?)',
                        [projectId, typeRows[0].type_id]
                    );
                }
            }
        }

        // 6. Handle Allowed Institutes Visibility
        if (vis.allowedInstitutes && vis.allowedInstitutes.length > 0) {
            for (const allowedInst of vis.allowedInstitutes) {
                await db.execute('INSERT IGNORE INTO Institutions (institution_name) VALUES (?)', [allowedInst]);
                const [allowedRows] = await db.execute('SELECT institution_id FROM Institutions WHERE institution_name = ?', [allowedInst]);
                
                if (allowedRows.length > 0) {
                    await db.execute(
                        'INSERT INTO Project_Visible_For_Institutions (project_id, institution_id) VALUES (?, ?)', 
                        [projectId, allowedRows[0].institution_id]
                    );
                }
            }
        }

        // 7. Handle Required Documents
        if (projectData.requiredDocuments && projectData.requiredDocuments.length > 0) {
            for (const doc of projectData.requiredDocuments) {
                // We ignore doc.id as the document_id column is auto_incremented in your DB
                await db.execute(`
                    INSERT INTO Documents (project_id, document_label, document_type, document_required) 
                    VALUES (?, ?, ?, ?)
                `, [
                    projectId, 
                    doc.label, 
                    doc.type, 
                    doc.required ? 1 : 0
                ]);
            }
        }

        // 8. Return exactly the output format specified
        return { id: projectId };
    },

    deleteProject: async (cognito_sub, projectId) => {
        try {
            // 1. Verify ownership before doing anything else
            const [projectRows] = await db.execute(
                'SELECT project_id FROM Projects WHERE project_id = ? AND cognito_sub = ?',
                [projectId, cognito_sub]
            );

            // If no rows are returned, the project either doesn't exist or belongs to someone else
            if (projectRows.length === 0) {
                return { 
                    success: false, 
                    message: "Project not found or you do not have permission to delete it." 
                };
            }

            // 2. Start a transaction for safe deletion
            await db.query('START TRANSACTION');

            // 3. Delete dependent records from join tables 
            // (Note: If you have ON DELETE CASCADE set up in your MySQL schema, 
            // you can actually safely remove all of these up to step 4)
            await db.execute('DELETE FROM Documents WHERE project_id = ?', [projectId]);
            await db.execute('DELETE FROM Project_Skills WHERE project_id = ?', [projectId]);
            await db.execute('DELETE FROM Project_Topics WHERE project_id = ?', [projectId]);
            await db.execute('DELETE FROM Project_Visible_For_Institutions WHERE project_id = ?', [projectId]);
            
            // Deleting from other project-related tables based on your database list
            await db.execute('DELETE FROM Project_Links WHERE project_id = ?', [projectId]);
            await db.execute('DELETE FROM User_Liked_Projects WHERE project_id = ?', [projectId]);
            //await db.execute('DELETE FROM User_Published_Projects WHERE project_id = ?', [projectId]);

            // 4. Finally, delete the core project record
            await db.execute('DELETE FROM Project_Types WHERE project_id = ?', [projectId]);
            await db.execute(
                'DELETE FROM Projects WHERE project_id = ? AND cognito_sub = ?',
                [projectId, cognito_sub]
            );


            // 5. Commit the transaction
            await db.query('COMMIT');

            return { 
                success: true, 
                deleted_project_id: projectId 
            };

        } catch (error) {
            // If anything fails, roll back the transaction so we don't end up with partial deletes
            await db.query('ROLLBACK');
            console.error("Error deleting project:", error);
            throw error; 
        }
    },

    getProject: async (userSub, projectId) => {
        // 1. Fetch the core project details along with country and institution names
        const projectQuery = `
            SELECT p.*, c.country_name, ci.city_name, i.institution_name
            FROM Projects p
            LEFT JOIN Countries c ON p.country_id = c.country_id
            LEFT JOIN Cities ci ON p.city_id = ci.city_id
            LEFT JOIN Institutions i ON p.institution_id = i.institution_id
            WHERE p.project_id = ?
        `;
        const [projectRows] = await db.execute(projectQuery, [projectId]);

        if (projectRows.length === 0) {
            return null; // Project not found
        }

        const p = projectRows[0];

        // 2. Optional: Enforce visibility rules (similar to searchProjects)
        // If the project has restrictions, check if the user is authorized to see it.
        const hasRestrictions = p.only_same_country || p.only_same_city  || p.only_same_institute; 
        let allowedInstRows = []; // We will fetch this anyway, but might need it for visibility check

        // Fetch allowed institutes early for the visibility check
        [allowedInstRows] = await db.execute(`
            SELECT i.institution_id, i.institution_name 
            FROM Project_Visible_For_Institutions pvi
            JOIN Institutions i ON pvi.institution_id = i.institution_id 
            WHERE pvi.project_id = ?
        `, [projectId]);

        const hasAllowedInstitutes = allowedInstRows.length > 0;

        if (hasRestrictions || hasAllowedInstitutes) {
            if (!userSub) return null;
        
            // owner override
            if (String(userSub) !== String(p.cognito_sub)) {
                const [userRows] = await db.execute(
                    'SELECT country_id, city_id, institution_id FROM Users WHERE cognito_sub = ?',
                    [userSub]
                );
        
                if (userRows.length === 0) return null;
                const currentUser = userRows[0];
        
                if (p.only_same_country && p.country_id !== currentUser.country_id) return null;
                if (p.only_same_city && p.city_id !== currentUser.city_id) return null;
                if (p.only_same_institute && p.institution_id !== currentUser.institution_id) return null;
        
                if (hasAllowedInstitutes) {
                    const isUserInstituteAllowed = allowedInstRows.some(
                        inst => inst.institution_id === currentUser.institution_id
                    );
                    if (!isUserInstituteAllowed) return null;
                }
            }
        }

        // 3. Fetch Relational Data (Skills, Topics, Documents)
        const [skillsRows] = await db.execute(`
            SELECT s.skill_name FROM Project_Skills ps
            JOIN Skills s ON ps.skill_id = s.skill_id 
            WHERE ps.project_id = ?
        `, [projectId]);

        const [topicsRows] = await db.execute(`
            SELECT t.topic_name FROM Project_Topics pt
            JOIN Topics t ON pt.topic_id = t.topic_id 
            WHERE pt.project_id = ?
        `, [projectId]);

        const [docsRows] = await db.execute(`
            SELECT document_id, document_label, document_type, document_required 
            FROM Documents 
            WHERE project_id = ?
        `, [projectId]);

        // Fetch authors name
        const [authorRows] = await db.execute(
            'SELECT name FROM Users WHERE cognito_sub = ?',
            [p.cognito_sub]
        );

        const [typesRows] = await db.execute(`
            SELECT t.type_name
            FROM Project_Types pt
            JOIN Types t ON pt.type_id = t.type_id
            WHERE pt.project_id = ?
        `, [projectId]);

        const author_display_name = authorRows[0].name;

        // 4. Map SQL results into arrays
        const projSkills = skillsRows.map(r => r.skill_name);
        const projTopics = topicsRows.map(r => r.topic_name);
        const projAllowedInstitutes = allowedInstRows.map(r => r.institution_name);
        const projDocs = docsRows.map(d => ({
            id: String(d.document_id),
            label: d.document_label,
            type: d.document_type,
            required: !!d.document_required
        }));
        const projTypes = typesRows.map(r => r.type_name);

        // 5. Return the exact formatted object
        return {
            id: p.project_id,
            author: p.cognito_sub,
            author_display_name: author_display_name,
            title: p.title,
            short_description: p.short_description,
            long_description: p.long_description,
            country: p.country_name,
            city: p.city_name,
            location: p.city_name && p.country_name
                ? `${p.city_name}, ${p.country_name}`
                : (p.city_name || p.country_name || null),
            institute: p.institution_name,
            skills: projSkills,
            topics: projTopics,
            types: projTypes,
            workload: p.work_load,
            completed: !!p.completed,
            visibility: {
                onlyInstitute: !!p.only_same_institute,
                onlyCity: !!p.only_same_city, 
                onlyCountry: !!p.only_same_country,
                allowedInstitutes: projAllowedInstitutes
            },
            requiredDocuments: projDocs,
            // Convert date object to YYYY-MM-DD
            published: p.published instanceof Date ? p.published.toISOString().split('T')[0] : p.published,
        };
    },

    getLikeCountForProject: async (projectId) => {
        const query = `
            SELECT COUNT(*) AS like_count 
            FROM User_Liked_Projects 
            WHERE project_id = ?
        `;
        
        const [result] = await db.execute(query, [projectId]); 
        console.log(projectId, result)
        return result[0].like_count;
    },

    applyToProject: async (userId, projectId, documentIds) => {
        // Acquire a specific connection from the pool for the transaction
        const connection = await db.getConnection();

        try {
            // Start the transaction on this specific connection
            await connection.beginTransaction();

            // 1. Create the Application
            const [appResult] = await connection.execute(
                `INSERT INTO Project_Applications (project_id, cognito_sub, status) 
                VALUES (?, ?, 'pending')`,
                [projectId, userId]
            );

            const newAppId = appResult.insertId;

            // 2. Update the Documents
            if (documentIds && documentIds.length > 0) {
                await connection.query(
                    `UPDATE Project_Application_Documents 
                    SET pending = 0, application_id = ? 
                    WHERE project_application_document_id IN (?) 
                    AND cognito_sub = ?`,
                    [newAppId, documentIds, userId]
                );
            }

            // 3. Commit the changes if both queries succeeded
            await connection.commit();

            console.log("Applied to project", newAppId);

            // 4. Add new notification for owner of project
            try {
                const [projDetails] = await connection.execute('SELECT cognito_sub, title FROM Projects WHERE project_id = ?', [projectId]);
                const project_owner = projDetails[0].cognito_sub;
                const project_title = projDetails[0].title;
                const [applicDetails] = await connection.execute('SELECT name FROM Users WHERE cognito_sub = ?', [userId]);
                const applicant_name = applicDetails[0].name;
                notificationService.addNotification({
                    sub: project_owner, 
                    originId: userId, 
                    type: 'project_application', 
                    message: `${applicant_name} applied to your project “${project_title}”.`,
                    projectId: projectId,
                    applicationId: newAppId
                });
            } catch (err) {
                console.error(err);
            }

            console.log("Exiting applyToProject");

            return {
                success: true,
                applicationId: newAppId,
            };

        } catch (error) {
            // If anything goes wrong, rollback to prevent partial data entry
            await connection.rollback();
            console.error('Transaction failed, rolled back:', error);
            throw error; 
        } finally {
            // Release the connection back to the pool 
            // (Important since your limit is 1!)
            connection.release();
        }
    },

    getApplications: async (userId, projectId) => {
        const query = `
            SELECT 
                pa.application_id AS applicationId,
                pa.project_id AS projectId,
                pa.cognito_sub AS applicantUserId,
                pa.created_at AS createdAt,
                pa.status AS status,
                -- Aggregate documents into a JSON array
                COALESCE(
                    JSON_ARRAYAGG(
                        IF(pad.project_application_document_id IS NULL, NULL,
                            JSON_OBJECT(
                                'id', d.document_id,
                                'label', d.document_label,
                                'required', CAST(d.document_required AS UNSIGNED),
                                'type', d.document_type,
                                'size', pad.size,
                                'project_application_document_id', pad.project_application_document_id,
                                'name', pad.name
                            )
                        )
                    ), 
                    JSON_ARRAY()
                ) AS documents,
                -- Create the applicant object
                JSON_OBJECT(
                    'name', u.name,
                    'institute', inst.institution_name,
                    'country', countr.country_name,
                    'city', city.city_name,
                    'id', u.cognito_sub
                ) AS applicant
            FROM Projects p
            INNER JOIN Project_Applications pa ON p.project_id = pa.project_id
            INNER JOIN Users u ON pa.cognito_sub = u.cognito_sub
            LEFT JOIN Institutions inst ON u.institution_id = inst.institution_id
            LEFT JOIN Countries countr ON u.country_id = countr.country_id
            LEFT JOIN Cities city ON u.city_id = city.city_id
            LEFT JOIN Project_Application_Documents pad ON pa.application_id = pad.application_id
            LEFT JOIN Documents d ON pad.document_id = d.document_id
            WHERE p.project_id = ? 
              AND p.cognito_sub = ? -- Security check: Only the project owner can see apps
            GROUP BY pa.application_id, u.cognito_sub, inst.institution_name, countr.country_name, city.city_name;
        `;
    
        const [rows] = await db.execute(query, [projectId, userId]);
        
        // MySQL returns JSON columns as strings or objects depending on the driver.
        // If they are strings, we parse them.
        return rows.map(row => ({
            ...row,
            documents: (typeof row.documents === 'string' ? JSON.parse(row.documents) : row.documents).filter(doc => doc),
            applicant: typeof row.applicant === 'string' ? JSON.parse(row.applicant) : row.applicant
        }));
    },

    updateApplicationStatus: async (userId, application_id, newStatus) => {
        // Valid statuses based on your ENUM: 'accepted', 'rejected', 'pending'
        const allowedStatuses = ['accepted', 'rejected', 'pending'];
        if (!allowedStatuses.includes(newStatus)) {
            throw new Error("Invalid status provided");
        }
    
        const query = `
            UPDATE Project_Applications pa
            INNER JOIN Projects p ON pa.project_id = p.project_id
            SET pa.status = ?
            WHERE pa.application_id = ? 
              AND p.cognito_sub = ?; -- Security: Only the project owner can update
        `;
    
        const [result] = await db.execute(query, [newStatus, application_id, userId]);
    
        // result.affectedRows will be 0 if the ID is wrong OR if the user doesn't own the project
        if (result.affectedRows === 0) {
            throw new Error("Project Application not found or User is lacking permission");
        }
    
        // Add new notification for applicant
        if (newStatus == 'accepted' || newStatus == 'rejected') {
            try {
                const [appDetails] = await db.execute(`SELECT p.title, p.project_id, pa.cognito_sub
                    FROM Project_Applications pa
                    JOIN Projects p ON pa.project_id = p.project_id
                    WHERE pa.application_id = ?
                `, [application_id]);

                const project_applicant = appDetails[0].cognito_sub;
                const project_title = appDetails[0].title;
                const projectId = appDetails[0].project_id;
            
                notificationService.addNotification({
                    sub: project_applicant, 
                    originId: userId, 
                    type: newStatus == 'accepted' ? 'application_accepted' : 'application_rejected', 
                    message: `Your application to "${project_title}" has been ${newStatus}.`,
                    projectId: projectId,
                    applicationId: application_id
                })
            } catch (err) {
                console.error(err)
            }
        }

        return { 
            success: true,  
        };
    },

    listUserProjects: async (authenticatedUserId, targetUserId) => {    
        const authId = authenticatedUserId ?? null;
        let countryId = null;
        let cityId = null;
        let institutionId = null;
    
        if (authId) {
          const [userRows] = await db.execute(
            'SELECT country_id, city_id, institution_id FROM Users WHERE cognito_sub = ?',
            [authId]
          );
    
          if (userRows.length > 0) {
            countryId = userRows[0].country_id ?? null;
            cityId = userRows[0].city_id ?? null;
            institutionId = userRows[0].institution_id ?? null;
          }
        }
    
        const query = `
          SELECT DISTINCT
            p.project_id,
            p.title,
            p.short_description,
            p.published,
            p.completed
          FROM Projects p
          LEFT JOIN Project_Visible_For_Institutions pvi
            ON p.project_id = pvi.project_id
          WHERE p.cognito_sub = ?
            AND (
              (? IS NOT NULL AND ? = ?)
    
              OR (p.only_same_country = 0 AND p.only_same_city = 0 AND p.only_same_institute = 0 AND pvi.institution_id IS NULL)
    
              OR (? IS NOT NULL AND (
                (p.only_same_country = 1 AND p.country_id = ?)
                OR (p.only_same_city = 1 AND p.city_id = ?)
                OR (p.only_same_institute = 1 AND p.institution_id = ?)
                OR (pvi.institution_id = ?)
              ))
            )
          ORDER BY p.published DESC
        `;
    
        const params = [
          targetUserId,
          authId,
          authId,
          targetUserId,
          authId,
          countryId,
          cityId,
          institutionId,
          institutionId,
        ];
    
        const [rows] = await db.execute(query, params);
    
        return rows.map((p) => ({
          id: p.project_id,
          title: p.title,
          short_description: p.short_description,
          published: p.published instanceof Date
            ? p.published.toISOString().split('T')[0]
            : p.published,
          completed: !!p.completed,
        }));
    },

    getProjectTypes: async () => {
        const [rows] = await db.execute(`
            SELECT type_id, type_name
            FROM Types
            ORDER BY type_name ASC
        `);
    
        return rows;
    },

    getTopics: async () => {
        const [rows] = await db.execute(`
            SELECT topic_id, topic_name
            FROM Topics
            ORDER BY topic_name ASC
        `);
    
        return rows;
    },

    getSkills: async () => {
        const [rows] = await db.execute(`
            SELECT skill_id, skill_name
            FROM Skills
            ORDER BY skill_name ASC
        `);
    
        return rows;
    },

    updateProject: async (cognito_sub, projectId, projectData) => {
        // 1. Verify ownership
        const [projectRows] = await db.execute(
            'SELECT project_id FROM Projects WHERE project_id = ? AND cognito_sub = ?',
            [projectId, cognito_sub]
        );
    
        if (projectRows.length === 0) {
            throw new Error("Project not found or you do not have permission to edit it.");
        }
    
        // 2. Resolve Country ID
        const parsedLocation = parseLocationFilter(projectData.location);
        const countryValue = projectData.country || parsedLocation.country;
        const cityValue = projectData.city || parsedLocation.city;

        let countryId = null;
        if (countryValue) {
            await db.execute(
                'INSERT IGNORE INTO Countries (country_name) VALUES (?)',
                [countryValue.trim()]
            );
            const [countryRows] = await db.execute(
                'SELECT country_id FROM Countries WHERE country_name = ?',
                [countryValue.trim()]
            );
            if (countryRows.length > 0) countryId = countryRows[0].country_id;
        }

        let cityId = null;
        if (cityValue && String(cityValue).trim()) {
            if (!countryId) {
                throw new Error('Country must be set before city.');
            }

            const normalizedCity = String(cityValue).trim();

            await db.execute(
                'INSERT IGNORE INTO Cities (city_name, country_id) VALUES (?, ?)',
                [normalizedCity, countryId]
            );

            const [cityRows] = await db.execute(
                'SELECT city_id FROM Cities WHERE city_name = ? AND country_id = ?',
                [normalizedCity, countryId]
            );

            if (cityRows.length > 0) cityId = cityRows[0].city_id;
        } else if (projectData.country !== undefined || projectData.city !== undefined || projectData.location !== undefined) {
            cityId = null;
        }
    
        // 3. Resolve Institution ID
        let institutionId = null;
        if (projectData.institute) {
            await db.execute(
                'INSERT IGNORE INTO Institutions (institution_name) VALUES (?)',
                [projectData.institute]
            );
            const [instRows] = await db.execute(
                'SELECT institution_id FROM Institutions WHERE institution_name = ?',
                [projectData.institute]
            );
            if (instRows.length > 0) institutionId = instRows[0].institution_id;
        }
    
        const vis = projectData.visibility || {};
    
        // 4. Update core project row
        await db.execute(`
            UPDATE Projects
            SET
                title = ?,
                short_description = ?,
                long_description = ?,
                work_load = ?,
                completed = ?,
                only_same_country = ?,
                only_same_institute = ?,
                only_same_city = ?,
                country_id = ?,
                city_id = ?,
                institution_id = ?
            WHERE project_id = ? AND cognito_sub = ?
        `, [
            projectData.title,
            projectData.short_description,
            projectData.long_description,
            projectData.workload,
            projectData.completed ? 1 : 0,
            vis.onlyCountry ? 1 : 0,
            vis.onlyInstitute ? 1 : 0,
            vis.onlyCity ? 1 : 0,
            countryId,
            cityId,
            institutionId,
            projectId,
            cognito_sub
        ]);
    
        // 5. Replace skills
        await db.execute('DELETE FROM Project_Skills WHERE project_id = ?', [projectId]);
        if (projectData.skills && projectData.skills.length > 0) {
            for (const skill of projectData.skills) {
                await db.execute('INSERT IGNORE INTO Skills (skill_name) VALUES (?)', [skill]);
                const [skillRows] = await db.execute(
                    'SELECT skill_id FROM Skills WHERE skill_name = ?',
                    [skill]
                );
    
                if (skillRows.length > 0) {
                    await db.execute(
                        'INSERT INTO Project_Skills (project_id, skill_id) VALUES (?, ?)',
                        [projectId, skillRows[0].skill_id]
                    );
                }
            }
        }
    
        // 6. Replace topics
        await db.execute('DELETE FROM Project_Topics WHERE project_id = ?', [projectId]);
        if (projectData.topics && projectData.topics.length > 0) {
            for (const topic of projectData.topics) {
                await db.execute('INSERT IGNORE INTO Topics (topic_name) VALUES (?)', [topic]);
                const [topicRows] = await db.execute(
                    'SELECT topic_id FROM Topics WHERE topic_name = ?',
                    [topic]
                );
    
                if (topicRows.length > 0) {
                    await db.execute(
                        'INSERT INTO Project_Topics (project_id, topic_id) VALUES (?, ?)',
                        [projectId, topicRows[0].topic_id]
                    );
                }
            }
        }
    
        // 7. Replace types
        await db.execute('DELETE FROM Project_Types WHERE project_id = ?', [projectId]);
        if (projectData.types && projectData.types.length > 0) {
            for (const typeName of projectData.types) {
                const [typeRows] = await db.execute(
                    'SELECT type_id FROM Types WHERE type_name = ?',
                    [typeName]
                );
    
                if (typeRows.length > 0) {
                    await db.execute(
                        'INSERT IGNORE INTO Project_Types (project_id, type_id) VALUES (?, ?)',
                        [projectId, typeRows[0].type_id]
                    );
                }
            }
        }
    
        // 8. Replace allowed institutes
        await db.execute('DELETE FROM Project_Visible_For_Institutions WHERE project_id = ?', [projectId]);
        if (vis.allowedInstitutes && vis.allowedInstitutes.length > 0) {
            for (const allowedInst of vis.allowedInstitutes) {
                await db.execute(
                    'INSERT IGNORE INTO Institutions (institution_name) VALUES (?)',
                    [allowedInst]
                );
                const [allowedRows] = await db.execute(
                    'SELECT institution_id FROM Institutions WHERE institution_name = ?',
                    [allowedInst]
                );
    
                if (allowedRows.length > 0) {
                    await db.execute(
                        'INSERT INTO Project_Visible_For_Institutions (project_id, institution_id) VALUES (?, ?)',
                        [projectId, allowedRows[0].institution_id]
                    );
                }
            }
        }
    
        // 9. Replace required documents
        await db.execute('DELETE FROM Documents WHERE project_id = ?', [projectId]);
        if (projectData.requiredDocuments && projectData.requiredDocuments.length > 0) {
            for (const doc of projectData.requiredDocuments) {
                await db.execute(`
                    INSERT INTO Documents (project_id, document_label, document_type, document_required)
                    VALUES (?, ?, ?, ?)
                `, [
                    projectId,
                    doc.label,
                    doc.type,
                    doc.required ? 1 : 0
                ]);
            }
        }
    
        // 10. Return updated project
        return await projectService.getProject(cognito_sub, projectId);
    },

    getInstitutes: async (query = '') => {
        const q = String(query || '').trim().toLowerCase();
        const hasQuery = q.length > 0;
        const like = `%${q}%`;
    
        const [rows] = await db.execute(
            `
            SELECT
                institution_id AS id,
                institution_name AS label
            FROM Institutions
            ${hasQuery ? 'WHERE LOWER(institution_name) LIKE ?' : ''}
            ORDER BY institution_name ASC
            LIMIT 20
            `,
            hasQuery ? [like] : []
        );
    
        return rows;
    },

    getLocations: async (query = '') => {
        const q = String(query || '').trim().toLowerCase();
    
        // Return some defaults when empty
        const hasQuery = q.length > 0;
        const like = `%${q}%`;
    
        // Countries
        const [countryRows] = await db.execute(
            `
            SELECT
                c.country_name AS label,
                c.country_name AS country,
                NULL AS city,
                'country' AS type
            FROM Countries c
            ${hasQuery ? 'WHERE LOWER(c.country_name) LIKE ?' : ''}
            ORDER BY c.country_name ASC
            LIMIT 20
            `,
            hasQuery ? [like] : []
        );
    
        // Cities with country
        const [cityRows] = await db.execute(
            `
            SELECT
                CONCAT(ci.city_name, ', ', c.country_name) AS label,
                c.country_name AS country,
                ci.city_name AS city,
                'city' AS type
            FROM Cities ci
            JOIN Countries c ON ci.country_id = c.country_id
            ${hasQuery ? `
                WHERE LOWER(ci.city_name) LIKE ?
                   OR LOWER(c.country_name) LIKE ?
                   OR LOWER(CONCAT(ci.city_name, ', ', c.country_name)) LIKE ?
            ` : ''}
            ORDER BY ci.city_name ASC, c.country_name ASC
            LIMIT 30
            `,
            hasQuery ? [like, like, like] : []
        );
    
        // Merge + dedupe by label
        const merged = [...countryRows, ...cityRows];
        const seen = new Set();
    
        const unique = merged.filter(row => {
            const key = row.label.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    
        // Sort: exact starts first, then countries before cities, then alpha
        unique.sort((a, b) => {
            const aStarts = hasQuery ? a.label.toLowerCase().startsWith(q) : false;
            const bStarts = hasQuery ? b.label.toLowerCase().startsWith(q) : false;
    
            if (aStarts !== bStarts) return aStarts ? -1 : 1;
            if (a.type !== b.type) return a.type === 'country' ? -1 : 1;
            return a.label.localeCompare(b.label);
        });
    
        return unique.slice(0, 20);
    },

    getProjectsPageData: async (userSub, filter) => {
        const [searchResp, projectTypes, topics, skills] = await Promise.all([
            projectService.searchProjects(userSub, filter),
            projectService.getProjectTypes(),
            projectService.getTopics(),
            projectService.getSkills(),
        ]);
    
        return {
            projects: searchResp.projects || [],
            total_results: searchResp.total_results || 0,
            projectTypes: projectTypes || [],
            topics: topics || [],
            skills: skills || [],
        };
    },

    getRecommendedProjects: async (userSub, page = 1, resultsPerPage = 10) => {
        const safePage = Math.max(1, Number(page) || 1);
        const safeLimit = Math.max(1, Math.min(50, Number(resultsPerPage) || 10));
    
        const [userRows] = await db.execute(`
            SELECT
                u.cognito_sub,
                u.institution_id,
                u.country_id,
                u.city_id,
                i.institution_name,
                c.country_name,
                ci.city_name
            FROM Users u
            LEFT JOIN Institutions i ON u.institution_id = i.institution_id
            LEFT JOIN Countries c ON u.country_id = c.country_id
            LEFT JOIN Cities ci ON u.city_id = ci.city_id
            WHERE u.cognito_sub = ?
            LIMIT 1
        `, [userSub]);
    
        if (!userRows.length) {
            return {
                projects: [],
                total_results: 0,
                page: safePage,
                results_per_page: safeLimit,
            };
        }
    
        const currentUser = userRows[0];
    
        const [interestRows] = await db.execute(`
            SELECT ri.interest_name
            FROM User_Research_Interests uri
            JOIN Research_Interests ri ON uri.interest_id = ri.interest_id
            WHERE uri.cognito_sub = ?
        `, [userSub]);
    
        const userInterests = new Set(
            interestRows.map(r => String(r.interest_name || '').trim().toLowerCase()).filter(Boolean)
        );
    
        const [projects] = await db.execute(`
            SELECT
                p.project_id,
                p.cognito_sub,
                p.title,
                p.short_description,
                p.long_description,
                p.work_load,
                p.published,
                i.institution_name,
                c.country_name,
                ci.city_name,
                u.name AS author_display_name
            FROM Projects p
            LEFT JOIN Institutions i ON p.institution_id = i.institution_id
            LEFT JOIN Countries c ON p.country_id = c.country_id
            LEFT JOIN Cities ci ON p.city_id = ci.city_id
            LEFT JOIN Users u ON p.cognito_sub = u.cognito_sub
            WHERE p.cognito_sub <> ?
        `, [userSub]);
    
        if (!projects.length) {
            return {
                projects: [],
                total_results: 0,
                page: safePage,
                results_per_page: safeLimit,
            };
        }
    
        const projectIds = projects.map(p => p.project_id);
        const placeholders = projectIds.map(() => '?').join(',');
    
        const [topicRows] = await db.execute(`
            SELECT pt.project_id, t.topic_name
            FROM Project_Topics pt
            JOIN Topics t ON pt.topic_id = t.topic_id
            WHERE pt.project_id IN (${placeholders})
        `, projectIds);
    
        const [skillRows] = await db.execute(`
            SELECT ps.project_id, s.skill_name
            FROM Project_Skills ps
            JOIN Skills s ON ps.skill_id = s.skill_id
            WHERE ps.project_id IN (${placeholders})
        `, projectIds);
    
        const [typeRows] = await db.execute(`
            SELECT pt.project_id, t.type_name
            FROM Project_Types pt
            JOIN Types t ON pt.type_id = t.type_id
            WHERE pt.project_id IN (${placeholders})
        `, projectIds);
    
        const topicsMap = new Map();
        topicRows.forEach(row => {
            if (!topicsMap.has(row.project_id)) topicsMap.set(row.project_id, []);
            topicsMap.get(row.project_id).push(row.topic_name);
        });
    
        const skillsMap = new Map();
        skillRows.forEach(row => {
            if (!skillsMap.has(row.project_id)) skillsMap.set(row.project_id, []);
            skillsMap.get(row.project_id).push(row.skill_name);
        });
    
        const typesMap = new Map();
        typeRows.forEach(row => {
            if (!typesMap.has(row.project_id)) typesMap.set(row.project_id, []);
            typesMap.get(row.project_id).push(row.type_name);
        });
    
        const scored = projects.map(project => {
            const topics = topicsMap.get(project.project_id) || [];
            const normalizedTopics = topics.map(t => String(t || '').trim().toLowerCase());
    
            let score = 0;
    
            normalizedTopics.forEach(topic => {
                if (userInterests.has(topic)) score += 3;
            });
    
            if (
                currentUser.city_name &&
                project.city_name &&
                String(currentUser.city_name).toLowerCase() === String(project.city_name).toLowerCase()
            ) {
                score += 2;
            }
    
            if (
                currentUser.country_name &&
                project.country_name &&
                String(currentUser.country_name).toLowerCase() === String(project.country_name).toLowerCase()
            ) {
                score += 1;
            }
    
            if (
                currentUser.institution_name &&
                project.institution_name &&
                String(currentUser.institution_name).toLowerCase() === String(project.institution_name).toLowerCase()
            ) {
                score += 1;
            }
    
            return {
                id: project.project_id,
                author: project.cognito_sub,
                author_display_name: project.author_display_name || '',
                title: project.title,
                short_description: project.short_description,
                long_description: project.long_description,
                institute: project.institution_name,
                country: project.country_name,
                city: project.city_name,
                location: project.city_name && project.country_name
                    ? `${project.city_name}, ${project.country_name}`
                    : (project.city_name || project.country_name || null),
                workload: project.work_load,
                published: project.published instanceof Date
                    ? project.published.toISOString().split('T')[0]
                    : project.published,
                topics,
                skills: skillsMap.get(project.project_id) || [],
                types: typesMap.get(project.project_id) || [],
                recommendation_score: score,
            };
        });
    
        const filtered = scored
            .filter(project => project.recommendation_score > 0)
            .sort((a, b) => b.recommendation_score - a.recommendation_score);
    
        const totalResults = filtered.length;
        const start = (safePage - 1) * safeLimit;
        const paginated = filtered.slice(start, start + safeLimit);
    
        return {
            projects: paginated,
            total_results: totalResults,
            page: safePage,
            results_per_page: safeLimit,
        };
    },

}

export default projectService;