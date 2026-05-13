// src/services/userService.js
import db from '../db.js'; // Ensure the .js extension is here!
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

const getFullProfile = async (db, sub) => {
    // 1. Get base user, country, institution
    const userQuery = `
        SELECT u.cognito_sub as id, u.name, u.email, u.bio, u.verified, u.first_sign_on,
               i.institution_name as institute, c.country_name as country,
               ci.city_name as city, u.avatar as avatar
        FROM Users u
        LEFT JOIN Institutions i ON u.institution_id = i.institution_id
        LEFT JOIN Countries c ON u.country_id = c.country_id
        LEFT JOIN Cities ci ON u.city_id = ci.city_id
        WHERE u.cognito_sub = ?
    `;
    const [userRows] = await db.execute(userQuery, [sub]);
    if (userRows.length === 0) return null;
    const user = userRows[0];

    // 2. Get Skills
    const [skillRows] = await db.execute(`
        SELECT s.skill_name
        FROM User_Skills us
        JOIN Skills s ON us.skill_id = s.skill_id
        WHERE us.cognito_sub = ?
        ORDER BY s.skill_name ASC
    `, [sub]);

    // 3. Get Interests
    const [interestRows] = await db.execute(`
        SELECT ri.interest_name
        FROM User_Research_Interests uri
        JOIN Research_Interests ri ON uri.interest_id = ri.interest_id
        WHERE uri.cognito_sub = ?
        ORDER BY ri.interest_name ASC
    `, [sub]);

    // 4. Get Languages
    const [langRows] = await db.execute(`
        SELECT l.language_name
        FROM User_Languages ul
        JOIN Languages l ON ul.language_id = l.language_id
        WHERE ul.cognito_sub = ?
        ORDER BY l.language_name ASC
    `, [sub]);

    // 5. Get Degree + Field
    const [educationRows] = await db.execute(`
        SELECT
            t.title_name,
            f.field_name
        FROM User_Titles ut
        JOIN Titles t ON ut.title_id = t.title_id
        JOIN Fields f ON ut.field_id = f.field_id
        WHERE ut.cognito_sub = ?
        LIMIT 1
    `, [sub]);

    // 5b. Get Current Position + Field
    const [positionRows] = await db.execute(`
        SELECT
            pt.position_title_name,
            pf.position_field_name
        FROM User_Positions up
        JOIN Position_Titles pt ON up.position_title_id = pt.position_title_id
        LEFT JOIN Position_Fields pf ON up.position_field_id = pf.position_field_id
        WHERE up.cognito_sub = ?
        LIMIT 1
    `, [sub]);

    // 6. Get Links
    const [linkRows] = await db.execute(`
        SELECT l.link_id, l.link_text, l.link_hyperlink
        FROM User_Links ul
        JOIN Links l ON ul.link_id = l.link_id
        WHERE ul.cognito_sub = ?
    `, [sub]);

    return {
        id: user.id,
        name: user.name,
        institute: user.institute,
        country: user.country,
        city: user.city,
        verified: user.verified,
        firstSignOn: user.first_sign_on,
        location: user.city && user.country
            ? `${user.city}, ${user.country}`
            : (user.city || user.country || null),
        degree: educationRows.length ? educationRows[0].title_name : null,
        field: educationRows.length ? educationRows[0].field_name : null,
        positionTitle: positionRows.length ? positionRows[0].position_title_name : null,
        positionField: positionRows.length ? positionRows[0].position_field_name : null,
        languages: langRows.map(r => r.language_name),
        bio: user.bio,
        interests: interestRows.map(r => r.interest_name),
        email: user.email,
        skills: skillRows.map(r => r.skill_name),
        avatar: user.avatar,
        skippedOpenAlex: true,
        links: linkRows.map(r => ({
            id: r.link_id,
            text: r.link_text,
            url: r.link_hyperlink
        }))
    };
};

const resetProfile = async (db, sub) => {
    await db.execute(`UPDATE Users SET
        name = NULL,
        bio = NULL,
        profile_picture_id = NULL,
        country_id = NULL,
        institution_id = NULL,
        avatar = NULL,
        openalex_id = NULL,
        city_id = NULL,
        verified = 0,
        verified_email = NULL WHERE cognito_sub = ?`, [sub]);

}

const userService = {
    setName: async (sub, name) => {
        const query = 'UPDATE Users SET name = ? WHERE cognito_sub = ?';
        // db is the pool we exported from db.js
        const [result] = await db.execute(query, [name, sub]);
        return result;
    },

    getProfile: async (sub) => {
        const profile = await getFullProfile(db, sub);
        return profile;
    },


    deleteUser: async (sub) => {
        const query = 'DELETE FROM Users WHERE cognito_sub = ?';
        const [result] = await db.execute(query, [sub]);
        return true;
    },

    validateSignOn: async (sub) => {
        const query = 'UPDATE Users SET first_sign_on = 0 WHERE cognito_sub = ?';
        const [result] = await db.execute(query, [sub]);
        return true;
    },

    updateBio: async (sub, bio) => {
        const query1 = 'UPDATE Users SET bio = ? WHERE cognito_sub = ?';
        // db is the pool we exported from db.js
        const [result] = await db.execute(query1, [bio, sub]);
        return await getFullProfile(db, sub);
    },

    updateSkills: async (sub, skillsArray) => {
        // 1. Remove existing skills for this user to perform a clean overwrite
        await db.execute('DELETE FROM User_Skills WHERE cognito_sub = ?', [sub]);
    
        // 2. Normalize + deduplicate input
        const normalizedSkills = [
            ...new Set(
                (skillsArray || [])
                    .map(skill => String(skill).trim())
                    .filter(Boolean)
            )
        ];
    
        // 3. Ensure each skill exists, then link it to the user
        for (const skill of normalizedSkills) {
            console.log('each new skill', skill);
            await db.execute(
                'INSERT IGNORE INTO Skills (skill_name) VALUES (?)',
                [skill]
            );
    
            const [rows] = await db.execute(
                'SELECT skill_id FROM Skills WHERE skill_name = ?',
                [skill]
            );
    
            if (rows.length > 0) {
                const skillId = rows[0].skill_id;
                await db.execute(
                    'INSERT INTO User_Skills (cognito_sub, skill_id) VALUES (?, ?)',
                    [sub, skillId]
                );
            }
        }
    
        // 4. Return the fully populated profile
        return await getFullProfile(db, sub);
    },
    
    updateResearchInterests: async (sub, interestsArray) => {
        // 1. Remove existing interests
        await db.execute('DELETE FROM User_Research_Interests WHERE cognito_sub = ?', [sub]);
    
        // 2. Normalize + deduplicate input
        const normalizedInterests = [
            ...new Set(
                (interestsArray || [])
                    .map(interest => String(interest).trim())
                    .filter(Boolean)
            )
        ];
    
        // 3. Ensure each interest exists, then link it to the user
        for (const interest of normalizedInterests) {
            await db.execute(
                'INSERT IGNORE INTO Research_Interests (interest_name) VALUES (?)',
                [interest]
            );
    
            const [rows] = await db.execute(
                'SELECT interest_id FROM Research_Interests WHERE interest_name = ?',
                [interest]
            );
    
            if (rows.length > 0) {
                const interestId = rows[0].interest_id;
                await db.execute(
                    'INSERT INTO User_Research_Interests (cognito_sub, interest_id) VALUES (?, ?)',
                    [sub, interestId]
                );
            }
        }
    
        // 4. Return the fully populated profile
        return await getFullProfile(db, sub);
    },

    updateProfile: async (sub, data) => {
        const updates = [];
        const values = [];
    
        // Direct User table updates
        if (data.name !== undefined) {
            updates.push('name = ?');
            values.push(data.name);
        }
    
        if (data.email !== undefined) {
            updates.push('email = ?');
            values.push(data.email);
        }
    
        // Handle Institution relationship
        if (data.institute !== undefined) {
            const instituteValue = String(data.institute || '').trim();
    
            if (instituteValue) {
                await db.execute(
                    'INSERT IGNORE INTO Institutions (institution_name) VALUES (?)',
                    [instituteValue]
                );
    
                const [instRows] = await db.execute(
                    'SELECT institution_id FROM Institutions WHERE institution_name = ?',
                    [instituteValue]
                );
    
                if (instRows.length > 0) {
                    updates.push('institution_id = ?');
                    values.push(instRows[0].institution_id);
                }
            } else {
                updates.push('institution_id = ?');
                values.push(null);
            }
        }
    
        // Handle Country relationship
        let resolvedCountryId = null;
    
        if (data.country !== undefined) {
            const countryValue = String(data.country || '').trim();
    
            if (countryValue) {
                await db.execute(
                    'INSERT IGNORE INTO Countries (country_name) VALUES (?)',
                    [countryValue]
                );
    
                const [countryRows] = await db.execute(
                    'SELECT country_id FROM Countries WHERE country_name = ?',
                    [countryValue]
                );
    
                if (countryRows.length > 0) {
                    resolvedCountryId = countryRows[0].country_id;
                    updates.push('country_id = ?');
                    values.push(resolvedCountryId);
    
                    if (data.city === undefined) {
                        updates.push('city_id = ?');
                        values.push(null);
                    }
                }
            } else {
                resolvedCountryId = null;
                updates.push('country_id = ?');
                values.push(null);
                updates.push('city_id = ?');
                values.push(null);
            }
        }
    
        // Handle City relationship
        if (data.city !== undefined) {
            const cityValue = String(data.city || '').trim();
    
            if (!cityValue) {
                updates.push('city_id = ?');
                values.push(null);
            } else {
                let cityCountryId = resolvedCountryId;
    
                if (cityCountryId === null && data.country === undefined) {
                    const [userRows] = await db.execute(
                        'SELECT country_id FROM Users WHERE cognito_sub = ?',
                        [sub]
                    );
                    cityCountryId = userRows.length ? userRows[0].country_id : null;
                }
    
                if (!cityCountryId) {
                    throw new Error('Country must be set before city.');
                }
    
                await db.execute(
                    'INSERT IGNORE INTO Cities (city_name, country_id) VALUES (?, ?)',
                    [cityValue, cityCountryId]
                );
    
                const [cityRows] = await db.execute(
                    'SELECT city_id FROM Cities WHERE city_name = ? AND country_id = ?',
                    [cityValue, cityCountryId]
                );
    
                if (cityRows.length > 0) {
                    updates.push('city_id = ?');
                    values.push(cityRows[0].city_id);
                }
            }
        }

        // Handle Current Position + Position Field
        if (data.positionTitle !== undefined || data.positionField !== undefined) {
            const positionTitleValue = String(data.positionTitle || '').trim();
            const positionFieldValue = String(data.positionField || '').trim();

            if (!positionTitleValue && !positionFieldValue) {
                await db.execute(
                    'DELETE FROM User_Positions WHERE cognito_sub = ?',
                    [sub]
                );
            } else {
                if (!positionTitleValue) {
                    throw new Error('Current position title is required when position field is provided.');
                }

                // position field can be optional if you want roles like "Senior Engineer"
                await db.execute(
                    'INSERT IGNORE INTO Position_Titles (position_title_name) VALUES (?)',
                    [positionTitleValue]
                );

                const [positionTitleRows] = await db.execute(
                    'SELECT position_title_id FROM Position_Titles WHERE position_title_name = ?',
                    [positionTitleValue]
                );

                if (positionTitleRows.length === 0) {
                    throw new Error('Failed to resolve current position title.');
                }

                const positionTitleId = positionTitleRows[0].position_title_id;

                let positionFieldId = null;

                if (positionFieldValue) {
                    await db.execute(
                        'INSERT IGNORE INTO Position_Fields (position_field_name) VALUES (?)',
                        [positionFieldValue]
                    );

                    const [positionFieldRows] = await db.execute(
                        'SELECT position_field_id FROM Position_Fields WHERE position_field_name = ?',
                        [positionFieldValue]
                    );

                    if (positionFieldRows.length === 0) {
                        throw new Error('Failed to resolve current position field.');
                    }

                    positionFieldId = positionFieldRows[0].position_field_id;
                }

                await db.execute(
                    'DELETE FROM User_Positions WHERE cognito_sub = ?',
                    [sub]
                );

                await db.execute(
                    'INSERT INTO User_Positions (cognito_sub, position_title_id, position_field_id) VALUES (?, ?, ?)',
                    [sub, positionTitleId, positionFieldId]
                );
            }
        }
    
        // Handle Degree + Field relationship
        // degree => Titles.title_name
        // field  => Fields.field_name
        if (data.degree !== undefined || data.field !== undefined) {
            const degreeValue = String(data.degree || '').trim();
            const fieldValue = String(data.field || '').trim();
    
            // Clear existing education if both are empty
            if (!degreeValue && !fieldValue) {
                await db.execute(
                    'DELETE FROM User_Titles WHERE cognito_sub = ?',
                    [sub]
                );
            } else {
                if (!degreeValue) {
                    throw new Error('Education level is required when field is provided.');
                }
    
                if (!fieldValue) {
                    throw new Error('Field of study is required when education level is provided.');
                }
    
                // 1. Ensure title exists
                await db.execute(
                    'INSERT IGNORE INTO Titles (title_name) VALUES (?)',
                    [degreeValue]
                );
    
                const [titleRows] = await db.execute(
                    'SELECT title_id FROM Titles WHERE title_name = ?',
                    [degreeValue]
                );
    
                if (titleRows.length === 0) {
                    throw new Error('Failed to resolve education level.');
                }
    
                const titleId = titleRows[0].title_id;
    
                // 2. Ensure field exists
                await db.execute(
                    'INSERT IGNORE INTO Fields (field_name) VALUES (?)',
                    [fieldValue]
                );
    
                const [fieldRows] = await db.execute(
                    'SELECT field_id FROM Fields WHERE field_name = ?',
                    [fieldValue]
                );
    
                if (fieldRows.length === 0) {
                    throw new Error('Failed to resolve field of study.');
                }
    
                const fieldId = fieldRows[0].field_id;
    
                // 3. Replace user education
                await db.execute(
                    'DELETE FROM User_Titles WHERE cognito_sub = ?',
                    [sub]
                );
    
                await db.execute(
                    'INSERT INTO User_Titles (cognito_sub, title_id, field_id) VALUES (?, ?, ?)',
                    [sub, titleId, fieldId]
                );
            }
        }
    
        // Handle Links
        if (data.links !== undefined) {
            await db.execute(
                'DELETE FROM User_Links WHERE cognito_sub = ?',
                [sub]
            );
    
            const normalizedLinks = (data.links || [])
                .map(link => ({
                    text: String(link.text || '').trim(),
                    url: String(link.url || '').trim(),
                }))
                .filter(link => link.text && link.url);
    
            for (const link of normalizedLinks) {
                const [insertResult] = await db.execute(
                    'INSERT INTO Links (link_text, link_hyperlink) VALUES (?, ?)',
                    [link.text, link.url]
                );
    
                await db.execute(
                    'INSERT INTO User_Links (cognito_sub, link_id) VALUES (?, ?)',
                    [sub, insertResult.insertId]
                );
            }
        }
    
        // Handle Languages
        if (data.languages !== undefined) {
            await db.execute(
                'DELETE FROM User_Languages WHERE cognito_sub = ?',
                [sub]
            );
    
            const normalizedLanguages = [
                ...new Set(
                    (data.languages || [])
                        .map(language => String(language).trim().replace(/\s+/g, ' '))
                        .filter(Boolean)
                )
            ];
    
            for (const language of normalizedLanguages) {
                const [rows] = await db.execute(
                    'SELECT language_id FROM Languages WHERE LOWER(language_name) = LOWER(?)',
                    [language]
                );
    
                if (rows.length > 0) {
                    await db.execute(
                        'INSERT IGNORE INTO User_Languages (cognito_sub, language_id) VALUES (?, ?)',
                        [sub, rows[0].language_id]
                    );
                }
            }
        }
    
        // Execute User table update
        if (updates.length > 0) {
            const query = `UPDATE Users SET ${updates.join(', ')} WHERE cognito_sub = ?`;
            values.push(sub);
            await db.execute(query, values);
        }
    
        return await getFullProfile(db, sub);
    },

    createUser: async ({ cognitoId, email, name }) => {
        const query = `
        INSERT INTO Users (cognito_sub, email, name)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE
            email = VALUES(email),
            name = VALUES(name);
        `;

        try {
        const [results] = await db.execute(query, [cognitoId, email, name]);
        return results;
        } catch (error) {
        console.error("Database error in createUser:", error);
        throw error; // Rethrow so the Lambda handler knows the DB operation failed
        }
    },

    getLikedProjectsForUser: async (userId) => {
        console.log(userId);
        const query = `
        SELECT p.*
        FROM Projects p
        INNER JOIN User_Liked_Projects ulp
            ON p.project_id = ulp.project_id
        WHERE ulp.cognito_sub = ?
    `;
        // db is the pool we exported from db.js
        const [result] = await db.execute(query, [userId]);
        return result;
    },

    hasAppliedToProject: async(cognito_sub, projectId) => {
        const query = 'SELECT * FROM Project_Applications WHERE project_id = ? AND cognito_sub = ?';
        const [result] = await db.execute(query, [projectId, cognito_sub]);
        return result.length > 0;
    },

    hasLikedProject: async (userId, projectId) => {
        const query = 'SELECT 1 FROM User_Liked_Projects WHERE cognito_sub = ? AND project_id = ? LIMIT 1';
        const [rows] = await db.execute(query, [userId, projectId]);
        return rows.length > 0;
    },

    hasLikedPerson: async (userId, liked_user_sub) => {
        const query = 'SELECT 1 FROM User_Liked_Users WHERE cognito_sub = ? AND liked_user_sub = ? LIMIT 1';
        const [rows] = await db.execute(query, [userId, liked_user_sub]);
        return rows.length > 0;
    },

    getLikedPeopleForUser: async (userId) => {
        const query = `
            SELECT 
                u.cognito_sub AS id,
                u.name,
                u.email,
                u.bio,
                t.title_name AS title,
                i.institution_name AS institute,
                c.country_name AS country,
                ci.city_name AS city,
                u.avatar
            FROM Users u
            INNER JOIN User_Liked_Users ulu
                ON u.cognito_sub = ulu.liked_user_sub
            LEFT JOIN Institutions i
                ON u.institution_id = i.institution_id
            LEFT JOIN Countries c
                ON u.country_id = c.country_id
            LEFT JOIN User_Titles ut
                ON u.cognito_sub = ut.cognito_sub
            LEFT JOIN Titles t
                ON ut.title_id = t.title_id
            LEFT JOIN Cities ci
                ON u.city_id = ci.city_id
            WHERE ulu.cognito_sub = ?
        `;
        const [result] = await db.execute(query, [userId]);
        return result;
    },

    addCommentToPaper: async (userId, work_id, text, replyToId) => {
        const parentId = replyToId ?? null;
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toTimeString().split(' ')[0];
    
        // 1. Ensure the Paper exists in the Papers table
        // 'ON DUPLICATE KEY UPDATE paper_id = paper_id' is a no-op that prevents errors if it exists
        const ensurePaperQuery = `
            INSERT INTO Papers (paper_id) 
            VALUES (?) 
            ON DUPLICATE KEY UPDATE paper_id = paper_id
        `;
        
        // 2. Insert the actual comment
        const insertCommentQuery = `
            INSERT INTO User_Comments 
            (cognito_sub, paper_id, parent_comment_id, comment_text, date_created, time_created)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
    
        try {
            // Run both within the same method
            await db.execute(ensurePaperQuery, [work_id]);
            
            await db.execute(insertCommentQuery, [
                userId,
                work_id,
                parentId,
                text,
                dateStr,
                timeStr
            ]);
        } catch (error) {
            console.error("Error adding comment:", error);
            throw error;
        }
    },

    editComment: async (userId, commentId, newText) => {
        // 1. Update the comment only if the ID exists AND the userId matches
        const query = `
            UPDATE User_Comments 
            SET comment_text = ? 
            WHERE comment_id = ? AND cognito_sub = ?
        `;
    
        const [result] = await db.execute(query, [newText, commentId, userId]);
    
        // 2. Check if the update actually happened
        if (result.affectedRows === 0) {
            // This could mean the comment doesn't exist OR the user isn't the owner
            throw new Error("Unauthorized: You can only edit your own comments, or comment not found.");
        }
    
        return { success: true };
    },

    deleteComment: async (userId, commentId) => {
        const [result] = await db.execute(
            `
            DELETE FROM User_Comments
            WHERE comment_id = ? AND cognito_sub = ?
            `,
            [commentId, userId]
        );
    
        if (result.affectedRows === 0) {
            throw new Error("Unauthorized: You can only delete your own comments, or comment not found.");
        }
    
        return { success: true };
    },

    hasLikedPaper: async (userId, paperId) => { 
        const query = 'SELECT 1 FROM User_Liked_Papers WHERE cognito_sub = ? AND paper_id = ? LIMIT 1';
        const [rows] = await db.execute(query, [userId, paperId]);
        return rows.length > 0;
    },

    toggleLikePaper: async (userId, paperId, topics = []) => {
        const ensurePaperQuery = `
            INSERT INTO Papers (paper_id)
            VALUES (?)
            ON DUPLICATE KEY UPDATE paper_id = paper_id
        `;
    
        await db.execute(ensurePaperQuery, [paperId]);
    
        const normalizedTopics = (topics || [])
            .map((topic) => ({
                topic_id: Number(topic.topic_id),
                score: Number(topic.score) || 0,
            }))
            .filter((topic) =>
                Number.isFinite(topic.topic_id) &&
                topic.topic_id > 0 &&
                topic.score > 0
            );
    
        const alreadyIn = await userService.hasLikedPaper(userId, paperId);
    
        if (alreadyIn) {
            await db.execute(
                'DELETE FROM User_Liked_Papers WHERE cognito_sub = ? AND paper_id = ?',
                [userId, paperId]
            );
    
            for (const topic of normalizedTopics) {
                await db.execute(`
                    UPDATE User_Topic_Scores
                    SET score = score - ?
                    WHERE cognito_sub = ? AND topic_id = ?
                `, [topic.score, userId, topic.topic_id]);
            }
    
            await db.execute(`
                DELETE FROM User_Topic_Scores
                WHERE cognito_sub = ? AND score <= 0
            `, [userId]);
    
            return { liked: false };
        }
    
        await db.execute(
            'INSERT INTO User_Liked_Papers (cognito_sub, paper_id) VALUES (?, ?)',
            [userId, paperId]
        );
    
        for (const topic of normalizedTopics) {
            await db.execute(`
                INSERT INTO User_Topic_Scores (cognito_sub, topic_id, score)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    score = score + VALUES(score)
            `, [userId, topic.topic_id, topic.score]);
        }
    
        return { liked: true };
    },

    getLikedPapersForUser: async (userId) => { 
        const query = `
          SELECT ulp.paper_id
          FROM User_Liked_Papers ulp
          WHERE ulp.cognito_sub = ?
        `;
      
        const [rows] = await db.execute(query, [userId]);
      
        // Return array of strings
        return rows.map(r => r.paper_id);
    },

    toggleLikeProject: async (userId, projectId) => {
        const alreadyIn = await userService.hasLikedProject(userId, projectId);
      
        if (alreadyIn) {
          await db.execute(
            'DELETE FROM User_Liked_Projects WHERE cognito_sub = ? AND project_id = ?',
            [userId, projectId]
          );
          return { liked: false };
        } else {
          await db.execute(
            'INSERT INTO User_Liked_Projects (cognito_sub, project_id) VALUES (?, ?)',
            [userId, projectId]
          );
          return { liked: true };
        }
    },
    
    toggleLikePerson: async (userId, likedUserSub) => {
        // 1. Prevent liking yourself
        if (String(userId) === String(likedUserSub)) {
            return { liked: false };
        }
    
        // 2. Check whether the like already exists
        const [existingRows] = await db.execute(
            `
            SELECT 1
            FROM User_Liked_Users
            WHERE cognito_sub = ? AND liked_user_sub = ?
            LIMIT 1
            `,
            [userId, likedUserSub]
        );
    
        const alreadyLiked = existingRows.length > 0;
    
        // 3. Unlike if already liked
        if (alreadyLiked) {
            await db.execute(
                `
                DELETE FROM User_Liked_Users
                WHERE cognito_sub = ? AND liked_user_sub = ?
                `,
                [userId, likedUserSub]
            );
    
            return { liked: false };
        }
    
        // 4. Insert the like
        await db.execute(
            `
            INSERT INTO User_Liked_Users (cognito_sub, liked_user_sub)
            VALUES (?, ?)
            `,
            [userId, likedUserSub]
        );
    
        // 5. Check if this creates a mutual like
        const [mutualRows] = await db.execute(
            `
            SELECT 1
            FROM User_Liked_Users
            WHERE cognito_sub = ? AND liked_user_sub = ?
            LIMIT 1
            `,
            [likedUserSub, userId]
        );
    
        const isMutual = mutualRows.length > 0;
        console.log('testing mutual-ness:', isMutual);

        const [userRows] = await db.execute(
            `
            SELECT cognito_sub, name
            FROM Users
            WHERE cognito_sub IN (?, ?)
            `,
            [userId, likedUserSub]
        );

        const likingUser = userRows.find(u => String(u.cognito_sub) === String(userId));
        const likedUser = userRows.find(u => String(u.cognito_sub) === String(likedUserSub));

        // 6. If mutual, create notifications for both users
        if (isMutual) {
            if (likingUser && likedUser) {
                await notificationService.addNotification({
                    sub: likedUserSub,
                    originId: userId,
                    type: 'mutual_like',
                    message: `You and ${likingUser.name} are now connected!`,
                });
    
                await notificationService.addNotification({
                    sub: userId,
                    originId: likedUserSub,
                    type: 'mutual_like',
                    message: `You and ${likedUser.name} are now connected!`,
                });
            }
        } else { //else: create notification only for other user
            if (likingUser && likedUser) {
                await notificationService.addNotification({
                    sub: likedUserSub,
                    originId: userId,
                    type: 'like',
                    message: `${likingUser.name} likes you!`,
                });
            }
        }
    
        return { liked: true };
    },

    getPeople: async (authUserId, filters = {}) => {
        const {
            q = "",
            institution = "",
            location = "",
            interests = [],
            skills = [],
            page = 1,
            results_per_page = 20,
        } = filters;
    
        const parsedLocation = parseLocationFilter(location);
        const locationCity = parsedLocation.city;
        const locationCountry = parsedLocation.country;
        const rawLocation = parsedLocation.raw.toLowerCase();
    
        const safePage = Math.max(1, Number(page) || 1);
        const safeLimit = Math.max(1, Math.min(50, Number(results_per_page) || 20));
        const offset = (safePage - 1) * safeLimit;
    
        const lowerQuery = q ? `%${String(q).trim().toLowerCase()}%` : null;
    
        const normalizedInterests = [
            ...new Set(
                (interests || [])
                    .map((interest) => String(interest).trim())
                    .filter(Boolean)
            )
        ];
    
        const normalizedSkills = [
            ...new Set(
                (skills || [])
                    .map((skill) => String(skill).trim())
                    .filter(Boolean)
            )
        ];
    
        let whereClauses = [];
        let params = [];
    
        if (lowerQuery) {
            whereClauses.push(`
                (
                    LOWER(u.name) LIKE ?
                    OR LOWER(COALESCE(u.bio, '')) LIKE ?
                    OR LOWER(COALESCE(i.institution_name, '')) LIKE ?
                    OR LOWER(COALESCE(c.country_name, '')) LIKE ?
                    OR LOWER(COALESCE(ci.city_name, '')) LIKE ?
                    OR LOWER(COALESCE(pt.position_title_name, '')) LIKE ?
                    OR LOWER(COALESCE(pf.position_field_name, '')) LIKE ?
                    OR EXISTS (
                        SELECT 1
                        FROM User_Research_Interests uri
                        JOIN Research_Interests ri
                          ON uri.interest_id = ri.interest_id
                        WHERE uri.cognito_sub = u.cognito_sub
                          AND LOWER(ri.interest_name) LIKE ?
                    )
                    OR EXISTS (
                        SELECT 1
                        FROM User_Skills us
                        JOIN Skills s
                          ON us.skill_id = s.skill_id
                        WHERE us.cognito_sub = u.cognito_sub
                          AND LOWER(s.skill_name) LIKE ?
                    )
                )
            `);
            params.push(
                lowerQuery,
                lowerQuery,
                lowerQuery,
                lowerQuery,
                lowerQuery,
                lowerQuery,
                lowerQuery,
                lowerQuery,
                lowerQuery
            );
        }
    
        if (institution) {
            whereClauses.push(`i.institution_name = ?`);
            params.push(institution);
        }
    
        if (normalizedInterests.length > 0) {
            const interestPlaceholders = normalizedInterests.map(() => "?").join(",");
            whereClauses.push(`
                EXISTS (
                    SELECT 1
                    FROM User_Research_Interests uri
                    JOIN Research_Interests ri
                      ON uri.interest_id = ri.interest_id
                    WHERE uri.cognito_sub = u.cognito_sub
                      AND ri.interest_name IN (${interestPlaceholders})
                )
            `);
            params.push(...normalizedInterests);
        }
    
        if (normalizedSkills.length > 0) {
            const skillPlaceholders = normalizedSkills.map(() => "?").join(",");
            whereClauses.push(`
                EXISTS (
                    SELECT 1
                    FROM User_Skills us
                    JOIN Skills s
                      ON us.skill_id = s.skill_id
                    WHERE us.cognito_sub = u.cognito_sub
                      AND s.skill_name IN (${skillPlaceholders})
                )
            `);
            params.push(...normalizedSkills);
        }
    
        if (location) {
            if (locationCity && locationCountry) {
                whereClauses.push(`
                    LOWER(ci.city_name) = ?
                    AND LOWER(c.country_name) = ?
                `);
                params.push(
                    locationCity.toLowerCase(),
                    locationCountry.toLowerCase()
                );
            } else {
                whereClauses.push(`
                    (
                        LOWER(c.country_name) = ?
                        OR LOWER(ci.city_name) = ?
                    )
                `);
                params.push(rawLocation, rawLocation);
            }
        }
    
        const whereSql = whereClauses.length
            ? `WHERE ${whereClauses.join(" AND ")}`
            : "";
    
        const countQuery = `
            SELECT COUNT(DISTINCT u.cognito_sub) AS total
            FROM Users u
            LEFT JOIN Institutions i ON u.institution_id = i.institution_id
            LEFT JOIN Countries c ON u.country_id = c.country_id
            LEFT JOIN Cities ci ON u.city_id = ci.city_id
            LEFT JOIN User_Positions up ON u.cognito_sub = up.cognito_sub
            LEFT JOIN Position_Titles pt ON up.position_title_id = pt.position_title_id
            LEFT JOIN Position_Fields pf ON up.position_field_id = pf.position_field_id
            ${whereSql}
        `;
    
        const [countRows] = await db.execute(countQuery, params);
        const total_results = countRows[0]?.total || 0;
    
        const peopleQuery = `
            SELECT
                u.cognito_sub AS id,
                u.name,
                u.email,
                u.bio,
                u.avatar,
                i.institution_name AS institute,
                c.country_name AS country,
                ci.city_name AS city,
                pt.position_title_name AS positionTitle,
                pf.position_field_name AS positionField
            FROM Users u
            LEFT JOIN Institutions i ON u.institution_id = i.institution_id
            LEFT JOIN Countries c ON u.country_id = c.country_id
            LEFT JOIN Cities ci ON u.city_id = ci.city_id
            LEFT JOIN User_Positions up ON u.cognito_sub = up.cognito_sub
            LEFT JOIN Position_Titles pt ON up.position_title_id = pt.position_title_id
            LEFT JOIN Position_Fields pf ON up.position_field_id = pf.position_field_id
            ${whereSql}
            GROUP BY
                u.cognito_sub, u.name, u.email, u.bio, u.avatar,
                i.institution_name, c.country_name, ci.city_name,
                pt.position_title_name, pf.position_field_name
            ORDER BY
                CASE
                    WHEN u.name IS NULL THEN 1
                    ELSE 0
                END,
                u.name ASC
            LIMIT ? OFFSET ?
        `;
    
        const [rows] = await db.execute(
            peopleQuery,
            [...params, String(safeLimit), String(offset)]
        );
    
        if (rows.length === 0) {
            return {
                people: [],
                total_results: 0,
                page: safePage,
                results_per_page: safeLimit,
            };
        }
    
        const userIds = rows.map((r) => r.id);
        const placeholders = userIds.map(() => "?").join(",");
    
        const [skillRows] = await db.execute(`
            SELECT us.cognito_sub, s.skill_name
            FROM User_Skills us
            JOIN Skills s ON us.skill_id = s.skill_id
            WHERE us.cognito_sub IN (${placeholders})
            ORDER BY s.skill_name ASC
        `, userIds);
    
        const [interestRows] = await db.execute(`
            SELECT uri.cognito_sub, ri.interest_name
            FROM User_Research_Interests uri
            JOIN Research_Interests ri ON uri.interest_id = ri.interest_id
            WHERE uri.cognito_sub IN (${placeholders})
            ORDER BY ri.interest_name ASC
        `, userIds);
    
        const [likeRows] = await db.execute(`
            SELECT liked_user_sub, COUNT(*) AS like_count
            FROM User_Liked_Users
            WHERE liked_user_sub IN (${placeholders})
            GROUP BY liked_user_sub
        `, userIds);
    
        let likedSet = new Set();
        if (authUserId) {
            const [likedRows] = await db.execute(`
                SELECT liked_user_sub
                FROM User_Liked_Users
                WHERE cognito_sub = ?
                  AND liked_user_sub IN (${placeholders})
            `, [authUserId, ...userIds]);
    
            likedSet = new Set(likedRows.map((r) => r.liked_user_sub));
        }
    
        const skillsMap = new Map();
        for (const row of skillRows) {
            if (!skillsMap.has(row.cognito_sub)) skillsMap.set(row.cognito_sub, []);
            skillsMap.get(row.cognito_sub).push(row.skill_name);
        }
    
        const interestsMap = new Map();
        for (const row of interestRows) {
            if (!interestsMap.has(row.cognito_sub)) interestsMap.set(row.cognito_sub, []);
            interestsMap.get(row.cognito_sub).push(row.interest_name);
        }
    
        const likeMap = new Map(
            likeRows.map((r) => [r.liked_user_sub, Number(r.like_count) || 0])
        );
    
        const people = rows.map((row) => ({
            id: row.id,
            name: row.name,
            email: row.email,
            bio: row.bio,
            avatar: row.avatar,
            institute: row.institute,
            country: row.country,
            city: row.city,
            location: row.city && row.country
                ? `${row.city}, ${row.country}`
                : (row.city || row.country || null),
            positionTitle: row.positionTitle,
            positionField: row.positionField,
            skills: skillsMap.get(row.id) || [],
            interests: interestsMap.get(row.id) || [],
            likeCount: likeMap.get(row.id) || 0,
            hasLiked: likedSet.has(row.id),
        }));
    
        return {
            people,
            total_results,
            page: safePage,
            results_per_page: safeLimit,
        };
    },

    getConnections: async (userId) => {
        const [rows] = await db.execute(`
            SELECT DISTINCT
                u.cognito_sub AS id,
                u.name,
                u.email,
                u.bio,
                u.avatar,
                i.institution_name AS institution,
                c.country_name AS country,
                ci.city_name AS city,
                t.title_name AS degree
            FROM User_Liked_Users ulu_out
            INNER JOIN User_Liked_Users ulu_in
                ON ulu_out.liked_user_sub = ulu_in.cognito_sub
               AND ulu_out.cognito_sub = ulu_in.liked_user_sub
            INNER JOIN Users u
                ON u.cognito_sub = ulu_out.liked_user_sub
            LEFT JOIN Institutions i
                ON u.institution_id = i.institution_id
            LEFT JOIN Countries c
                ON u.country_id = c.country_id
            LEFT JOIN Cities ci
                ON u.city_id = ci.city_id
            LEFT JOIN User_Titles ut
                ON u.cognito_sub = ut.cognito_sub
            LEFT JOIN Titles t
                ON ut.title_id = t.title_id
            WHERE ulu_out.cognito_sub = ?
            ORDER BY u.name ASC
        `, [userId]);
    
        if (rows.length === 0) {
            return [];
        }
    
        const userIds = rows.map(r => r.id);
        const placeholders = userIds.map(() => "?").join(",");
    
        // Skills
        const [skillRows] = await db.execute(`
            SELECT us.cognito_sub, s.skill_name
            FROM User_Skills us
            JOIN Skills s ON us.skill_id = s.skill_id
            WHERE us.cognito_sub IN (${placeholders})
            ORDER BY s.skill_name ASC
        `, userIds);
    
        // Research interests
        const [interestRows] = await db.execute(`
            SELECT uri.cognito_sub, ri.interest_name
            FROM User_Research_Interests uri
            JOIN Research_Interests ri ON uri.interest_id = ri.interest_id
            WHERE uri.cognito_sub IN (${placeholders})
            ORDER BY ri.interest_name ASC
        `, userIds);
    
        // Like counts
        const [likeRows] = await db.execute(`
            SELECT liked_user_sub, COUNT(*) AS like_count
            FROM User_Liked_Users
            WHERE liked_user_sub IN (${placeholders})
            GROUP BY liked_user_sub
        `, userIds);
    
        const skillsMap = new Map();
        for (const row of skillRows) {
            if (!skillsMap.has(row.cognito_sub)) {
                skillsMap.set(row.cognito_sub, []);
            }
            skillsMap.get(row.cognito_sub).push(row.skill_name);
        }
    
        const interestsMap = new Map();
        for (const row of interestRows) {
            if (!interestsMap.has(row.cognito_sub)) {
                interestsMap.set(row.cognito_sub, []);
            }
            interestsMap.get(row.cognito_sub).push(row.interest_name);
        }
    
        const likeMap = new Map(
            likeRows.map(r => [r.liked_user_sub, Number(r.like_count) || 0])
        );
    
        return rows.map(row => ({
            id: row.id,
            name: row.name,
            email: row.email,
            bio: row.bio,
            avatar: row.avatar,
            institution: row.institution,
            country: row.country,
            city: row.city,
            location: row.city && row.country
                ? `${row.city}, ${row.country}`
                : (row.city || row.country || null),
            degree: row.degree,
            skills: skillsMap.get(row.id) || [],
            researchInterests: interestsMap.get(row.id) || [],
            likeCount: likeMap.get(row.id) || 0,
            hasLiked: true,
        }));
    },

    searchMyProjectApplications: async (userId, filters = {}) => {
        const {
            sortBy = 'date_newest',
            page = 1,
            query = '',
            location = '',
            institute = '',
            published_before = '',
            published_after = '',
            keywords = [],
            skills = [],
            types = [],
            results_per_page = 10,
        } = filters;
    
        const parsedLocation = parseLocationFilter(location);
        const locationCity = parsedLocation.city;
        const locationCountry = parsedLocation.country;
        const rawLocation = parsedLocation.raw.toLowerCase();

        const safePage = Math.max(1, Number(page) || 1);
        const safeLimit = Math.max(1, Math.min(100, Number(results_per_page) || 10));
        const offset = (safePage - 1) * safeLimit;
    
        const lowerQuery = query ? `%${String(query).toLowerCase().trim()}%` : null;
    
        let selectClause = `
            SELECT DISTINCT
                p.*,
                c.country_name,
                ci.city_name,
                i.institution_name,
                pa.application_id,
                pa.status AS application_status,
                pa.created_at AS application_created_at,
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
            FROM Project_Applications pa
            INNER JOIN Projects p ON pa.project_id = p.project_id
            LEFT JOIN Countries c ON p.country_id = c.country_id
            LEFT JOIN Cities ci ON p.city_id = ci.city_id
            LEFT JOIN Institutions i ON p.institution_id = i.institution_id
        `;
    
        let whereClauses = [`pa.cognito_sub = ?`];
        let queryParams = [userId];
    
        if (lowerQuery) {
            whereClauses.push(`
                (
                    LOWER(p.title) LIKE ?
                    OR LOWER(p.short_description) LIKE ?
                    OR LOWER(p.long_description) LIKE ?
                )
            `);
            queryParams.push(lowerQuery, lowerQuery, lowerQuery);
        }
    
        if (location) {
            if (locationCity && locationCountry) {
                whereClauses.push(`
                    LOWER(ci.city_name) = ?
                    AND LOWER(c.country_name) = ?
                `);
                queryParams.push(
                    locationCity.toLowerCase(),
                    locationCountry.toLowerCase()
                );
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
            whereClauses.push(`
                EXISTS (
                    SELECT 1
                    FROM Project_Topics pt
                    JOIN Topics t ON pt.topic_id = t.topic_id
                    WHERE pt.project_id = p.project_id
                      AND t.topic_name IN (${placeholders})
                )
            `);
            queryParams.push(...keywords);
        }
    
        if (skills && skills.length > 0) {
            const placeholders = skills.map(() => '?').join(',');
            whereClauses.push(`
                EXISTS (
                    SELECT 1
                    FROM Project_Skills ps
                    JOIN Skills s ON ps.skill_id = s.skill_id
                    WHERE ps.project_id = p.project_id
                      AND s.skill_name IN (${placeholders})
                )
            `);
            queryParams.push(...skills);
        }
    
        if (types && types.length > 0) {
            const placeholders = types.map(() => '?').join(',');
            whereClauses.push(`
                EXISTS (
                    SELECT 1
                    FROM Project_Types pt
                    JOIN Types t ON pt.type_id = t.type_id
                    WHERE pt.project_id = p.project_id
                      AND t.type_name IN (${placeholders})
                )
            `);
            queryParams.push(...types);
        }
    
        const whereString = `WHERE ${whereClauses.join(' AND ')}`;
    
        const countSql = `
            SELECT COUNT(DISTINCT p.project_id) AS total
            ${fromClause}
            ${whereString}
        `;
        const [countRows] = await db.execute(countSql, queryParams);
        const total_results = countRows[0]?.total || 0;
    
        let orderByClause = '';
        if (sortBy === 'recommended') {
            orderByClause = 'ORDER BY relevance_score ASC, p.published DESC';
        } else if (sortBy === 'date_oldest') {
            orderByClause = 'ORDER BY p.published ASC';
        } else {
            orderByClause = 'ORDER BY p.published DESC';
        }
    
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
            String(safeLimit),
            String(offset),
        ];
    
        const [projects] = await db.execute(
            paginatedSql,
            finalParams.map(p => p !== null ? p.toString() : null)
        );
    
        if (projects.length === 0) {
            return {
                projects: [],
                total_results: 0,
                page: safePage,
                results_per_page: safeLimit,
            };
        }
    
        const projectIds = projects.map(p => p.project_id);
        const placeholders = projectIds.map(() => '?').join(',');
    
        const [skillsRows] = await db.execute(`
            SELECT ps.project_id, s.skill_name
            FROM Project_Skills ps
            JOIN Skills s ON ps.skill_id = s.skill_id
            WHERE ps.project_id IN (${placeholders})
        `, projectIds);
    
        const [topicsRows] = await db.execute(`
            SELECT pt.project_id, t.topic_name
            FROM Project_Topics pt
            JOIN Topics t ON pt.topic_id = t.topic_id
            WHERE pt.project_id IN (${placeholders})
        `, projectIds);
    
        const [docsRows] = await db.execute(`
            SELECT document_id, project_id, document_label, document_type, document_required
            FROM Documents
            WHERE project_id IN (${placeholders})
        `, projectIds);
    
        const [allowedInstRows] = await db.execute(`
            SELECT pvi.project_id, i.institution_name
            FROM Project_Visible_For_Institutions pvi
            JOIN Institutions i ON pvi.institution_id = i.institution_id
            WHERE pvi.project_id IN (${placeholders})
        `, projectIds);
    
        const [authorRows] = await db.execute(`
            SELECT p.project_id, u.name
            FROM Users u
            JOIN Projects p ON p.cognito_sub = u.cognito_sub
            WHERE p.project_id IN (${placeholders})
        `, projectIds);
    
        const [typesRows] = await db.execute(`
            SELECT pt.project_id, t.type_name
            FROM Project_Types pt
            JOIN Types t ON pt.type_id = t.type_id
            WHERE pt.project_id IN (${placeholders})
        `, projectIds);
    
        const formattedProjects = projects.map((p) => {
            const projSkills = skillsRows
                .filter(r => r.project_id === p.project_id)
                .map(r => r.skill_name);
    
            const projTopics = topicsRows
                .filter(r => r.project_id === p.project_id)
                .map(r => r.topic_name);
    
            const projAllowedInstitutes = allowedInstRows
                .filter(r => r.project_id === p.project_id)
                .map(r => r.institution_name);
    
            const projDocs = docsRows
                .filter(d => d.project_id === p.project_id)
                .map(d => ({
                    id: String(d.document_id),
                    label: d.document_label,
                    type: d.document_type,
                    required: !!d.document_required,
                }));
    
            const author_display_name =
                authorRows.find(r => r.project_id === p.project_id)?.name || '';
    
            const projTypes = typesRows
                .filter(r => r.project_id === p.project_id)
                .map(r => r.type_name);
    
            return {
                id: p.project_id,
                application_id: p.application_id,
                application_status: p.application_status,
                application_created_at: p.application_created_at instanceof Date
                    ? p.application_created_at.toISOString()
                    : p.application_created_at,
                author: p.cognito_sub,
                author_display_name,
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
                visibility: {
                    onlyInstitute: !!p.only_same_institute,
                    onlyCity: !!p.only_same_city,
                    onlyCountry: !!p.only_same_country,
                    allowedInstitutes: projAllowedInstitutes,
                },
                requiredDocuments: projDocs,
                published: p.published instanceof Date
                    ? p.published.toISOString().split('T')[0]
                    : p.published,
                relevant_field: p.relevant_field,
            };
        });
    
        return {
            projects: formattedProjects,
            total_results,
            page: safePage,
            results_per_page: safeLimit,
        };
    },

    getRecommendations: async (userId) => {
        const [rows] = await db.execute(`
            SELECT
                ur.score,
                ur.topic_score,
                ur.minilm_score,
                ur.match_rank,
                ur.summary,
                u.cognito_sub AS id,
                u.name,
                u.avatar,
                i.institution_name AS institution,
                c.country_name AS country
            FROM User_Recommendations ur
            JOIN Users u ON ur.recommended_cognito_sub = u.cognito_sub
            LEFT JOIN Institutions i ON u.institution_id = i.institution_id
            LEFT JOIN Countries c ON u.country_id = c.country_id
            WHERE ur.cognito_sub = ?
            ORDER BY ur.match_rank ASC
        `, [userId]);
    
        return rows.map(row => ({
            id: row.id,
            name: row.name,
            avatar: row.avatar,
            institution: row.institution,
            country: row.country,
            score: row.score,
            topic_score: row.topic_score,
            minilm_score: row.minilm_score,
            match_rank: row.match_rank,
            summary: row.summary,
        }));
    },
    
    saveOpenAlexProfile: async (sub, openAlexId, openAlexProfile, papers, topicStats, coauthors) => {
        console.log('Saving openAlex profile');

        try {
            resetProfile(db, sub);
        } catch (err) {
            console.warn('Failed to reset user:', err.message);
        }
    
        // ── 1. Save openalex_id to Users ─────────────────────────────────────
        try {
            await db.execute(
                'UPDATE Users SET openalex_id = ? WHERE cognito_sub = ?',
                [openAlexId, sub]
            );
        } catch (err) {
            console.warn('openalex_id column missing:', err.message);
        }
    
        // ── 2. Sync institution ──────────────────────────────────────────────
        if (openAlexProfile.institution) {
            await db.execute(
                'INSERT IGNORE INTO Institutions (institution_name) VALUES (?)',
                [openAlexProfile.institution]
            );
            const [instRows] = await db.execute(
                'SELECT institution_id FROM Institutions WHERE institution_name = ?',
                [openAlexProfile.institution]
            );
            if (instRows.length > 0) {
                await db.execute(
                    'UPDATE Users SET institution_id = ? WHERE cognito_sub = ?',
                    [instRows[0].institution_id, sub]
                );
            }
        }
    
        // ── 3. Sync top topics as research interests ─────────────────────────
        if (openAlexProfile.topTopics?.length > 0) {
            await db.execute(
                'DELETE FROM User_Research_Interests WHERE cognito_sub = ?',
                [sub]
            );
            for (const topic of openAlexProfile.topTopics) {
                await db.execute(
                    'INSERT IGNORE INTO Research_Interests (interest_name) VALUES (?)',
                    [topic.name]
                );
                const [rows] = await db.execute(
                    'SELECT interest_id FROM Research_Interests WHERE interest_name = ?',
                    [topic.name]
                );
                if (rows.length > 0) {
                    await db.execute(
                        'INSERT INTO User_Research_Interests (cognito_sub, interest_id) VALUES (?, ?)',
                        [sub, rows[0].interest_id]
                    );
                }
            }
        }
    
        // ── 4. Save top 5 papers ─────────────────────────────────────────────
        for (const paper of (papers || [])) {
            if (!paper.paper_id) continue;
            console.log('Saving paper:', paper.paper_id);
    
            let pubDate = null;
            if (paper.date_published) {
                const d = new Date(paper.date_published);
                pubDate = isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
            }
    
            const title = paper.title ? paper.title.substring(0, 255) : null;
            await db.execute(`
                INSERT INTO Papers (paper_id, title, date_published, source)
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    title          = VALUES(title),
                    date_published = VALUES(date_published),
                    source         = VALUES(source)
            `, [paper.paper_id, title, pubDate, paper.source ? paper.source.substring(0, 255) : null]);
    
            if (paper.abstract) {
                await db.execute(`
                    INSERT INTO Papers_Abstracts (paper_id, abstract)
                    VALUES (?, ?)
                    ON DUPLICATE KEY UPDATE abstract = VALUES(abstract)
                `, [paper.paper_id, paper.abstract]);
            }
    
            await db.execute(`
                INSERT IGNORE INTO Authorships (openalex_id, paper_id)
                VALUES (?, ?)
            `, [openAlexId, paper.paper_id]);
    
            for (const topic of (paper.topics || [])) {
                if (!topic.topic_id || isNaN(topic.topic_id)) continue;
                try {
                    await db.execute(`
                        INSERT INTO Topics (topic_id, topic_name, subfield_id, field_id, subfield_name, field_name)
                        VALUES (?, ?, ?, ?, ?, ?)
                        ON DUPLICATE KEY UPDATE
                            topic_name    = VALUES(topic_name),
                            subfield_name = VALUES(subfield_name),
                            field_name    = VALUES(field_name)
                    `, [
                        topic.topic_id,
                        topic.topic_name ? topic.topic_name.substring(0, 255) : null,
                        topic.subfield_id || null,
                        topic.field_id || null,
                        topic.subfield_name ? topic.subfield_name.substring(0, 64) : null,
                        topic.field_name ? topic.field_name.substring(0, 64) : null,
                    ]);
    
                    await db.execute(`
                        INSERT INTO Works_Topics (paper_id, topic_id, is_primary)
                        VALUES (?, ?, ?)
                        ON DUPLICATE KEY UPDATE is_primary = VALUES(is_primary)
                    `, [paper.paper_id, topic.topic_id, topic.is_primary]);
    
                } catch (topicErr) {
                    console.warn(`Skipping topic ${topic.topic_id}:`, topicErr.message);
                }
            }
        }
    
        // ── 5. Save User_Topic_Stats (bulk) ──────────────────────────────────
        if (topicStats?.length > 0) {
            await db.execute(
                'DELETE FROM User_Topic_Stats WHERE openalex_id = ?',
                [openAlexId]
            );
            const validStats = topicStats.filter(s => s.topic_id && !isNaN(s.topic_id));
            if (validStats.length > 0) {
                const placeholders = validStats.map(() => '(?, ?, ?)').join(', ');
                const values = validStats.flatMap(s => [openAlexId, s.topic_id, s.count]);
                await db.execute(
                    `INSERT INTO User_Topic_Stats (openalex_id, topic_id, count)
                     VALUES ${placeholders}
                     ON DUPLICATE KEY UPDATE count = VALUES(count)`,
                    values
                );
            }
        }
    
        // ── 6. Save Coauthor_Graph (bulk) ────────────────────────────────────
        if (coauthors?.length > 0) {
            const validCoauthors = coauthors.filter(id => !!id);
            if (validCoauthors.length > 0) {
                const placeholders = validCoauthors.map(() => '(?, ?, 1)').join(', ');
                const values = validCoauthors.flatMap(id => [openAlexId, id]);
                await db.execute(
                    `INSERT INTO Coauthor_Graph (author1_id, author2_id, shared_count)
                     VALUES ${placeholders}
                     ON DUPLICATE KEY UPDATE shared_count = shared_count + 1`,
                    values
                );
            }
        }
    
        console.log('saveOpenAlexProfile complete');
        return await getFullProfile(db, sub);
    },

    saveManualProfile: async (sub, manualForm) => {

        try {
            resetProfile(db, sub);
        } catch (err) {
            console.warn('Failed to reset user:', err.message);
        }

        // 1. Name
        if (manualForm.name) {
            await db.execute(
                'UPDATE Users SET name = ? WHERE cognito_sub = ?',
                [manualForm.name.trim(), sub]
            );
        }
    
        // 2. Institution
        if (manualForm.institution) {
            await db.execute(
                'INSERT IGNORE INTO Institutions (institution_name) VALUES (?)',
                [manualForm.institution.trim()]
            );
            const [instRows] = await db.execute(
                'SELECT institution_id FROM Institutions WHERE institution_name = ?',
                [manualForm.institution.trim()]
            );
            if (instRows.length > 0) {
                await db.execute(
                    'UPDATE Users SET institution_id = ? WHERE cognito_sub = ?',
                    [instRows[0].institution_id, sub]
                );
            }
        }
    
        // 3. Country
        if (manualForm.country) {
            await db.execute(
                'INSERT IGNORE INTO Countries (country_name) VALUES (?)',
                [manualForm.country]
            );
            const [countryRows] = await db.execute(
                'SELECT country_id FROM Countries WHERE country_name = ?',
                [manualForm.country]
            );
            if (countryRows.length > 0) {
                await db.execute(
                    'UPDATE Users SET country_id = ? WHERE cognito_sub = ?',
                    [countryRows[0].country_id, sub]
                );
            }
        }
    
        // 4. Degree
        if (manualForm.degree) {
            await db.execute(
                'INSERT IGNORE INTO Titles (title_name) VALUES (?)',
                [manualForm.degree]
            );
            const [titleRows] = await db.execute(
                'SELECT title_id FROM Titles WHERE title_name = ?',
                [manualForm.degree]
            );
            if (titleRows.length > 0) {
                const titleId = titleRows[0].title_id;
                const defaultFieldId = 1;
                await db.execute(
                    'DELETE FROM User_Titles WHERE cognito_sub = ?',
                    [sub]
                );
                await db.execute(
                    'INSERT INTO User_Titles (cognito_sub, title_id, field_id) VALUES (?, ?, ?)',
                    [sub, titleId, defaultFieldId]
                );
            }
        }
    
        // 5. Research interests (Array of strings from CreatableTagInput)
        if (manualForm.interests && Array.isArray(manualForm.interests)) {
            await db.execute(
                'DELETE FROM User_Research_Interests WHERE cognito_sub = ?',
                [sub]
            );
            
            // Filter out empty items and trim
            const interestList = manualForm.interests
                .filter(Boolean)
                .map(i => String(i).trim())
                .filter(i => i.length > 0);
    
            for (const interest of interestList) {
                await db.execute(
                    'INSERT IGNORE INTO Research_Interests (interest_name) VALUES (?)',
                    [interest]
                );
                const [rows] = await db.execute(
                    'SELECT interest_id FROM Research_Interests WHERE interest_name = ?',
                    [interest]
                );
                if (rows.length > 0) {
                    await db.execute(
                        'INSERT IGNORE INTO User_Research_Interests (cognito_sub, interest_id) VALUES (?, ?)',
                        [sub, rows[0].interest_id]
                    );
                }
            }
        }
    
        // 6. Skills (Array of strings from CreatableTagInput)
        if (manualForm.skills && Array.isArray(manualForm.skills)) {
            await db.execute(
                'DELETE FROM User_Skills WHERE cognito_sub = ?',
                [sub]
            );

            // Filter out empty items and trim
            const skillList = manualForm.skills
                .filter(Boolean)
                .map(s => String(s).trim())
                .filter(s => s.length > 0);

            for (const skill of skillList) {
                await db.execute(
                    'INSERT IGNORE INTO Skills (skill_name) VALUES (?)',
                    [skill]
                );
                const [rows] = await db.execute(
                    'SELECT skill_id FROM Skills WHERE skill_name = ?',
                    [skill]
                );
                if (rows.length > 0) {
                    await db.execute(
                        'INSERT IGNORE INTO User_Skills (cognito_sub, skill_id) VALUES (?, ?)',
                        [sub, rows[0].skill_id]
                    );
                }
            }
        }

        // 7. Languages
        if (manualForm.languages && Array.isArray(manualForm.languages)) {
            await db.execute(
                'DELETE FROM User_Languages WHERE cognito_sub = ?',
                [sub]
            );

            const languageList = [
                ...new Set(
                    manualForm.languages
                        .filter(Boolean)
                        .map(l => String(l).trim().replace(/\s+/g, ' '))
                        .filter(l => l.length > 0)
                )
            ];

            for (const language of languageList) {
                const [rows] = await db.execute(
                    'SELECT language_id FROM Languages WHERE language_name = ?',
                    [language]
                );

                if (rows.length > 0) {
                    await db.execute(
                        'INSERT IGNORE INTO User_Languages (cognito_sub, language_id) VALUES (?, ?)',
                        [sub, rows[0].language_id]
                    );
                }
            }
        }
    
        return await getFullProfile(db, sub);
    },
    
    getLikedContentForUser: async (userId) => {
        // 1. Run the 4 primary data fetches in parallel
        const [
            [projectRows],
            [peopleRows],
            [paperRows],
            [postRows]
        ] = await Promise.all([
            db.execute(`
                SELECT p.* FROM Projects p
                INNER JOIN User_Liked_Projects ulp ON p.project_id = ulp.project_id
                WHERE ulp.cognito_sub = ?
            `, [userId]),
            db.execute(`
                SELECT 
                    u.cognito_sub AS id, u.name, u.email, u.bio,
                    t.title_name AS title, i.institution_name AS institute,
                    c.country_name AS country, ci.city_name AS city, u.avatar
                FROM Users u
                INNER JOIN User_Liked_Users ulu ON u.cognito_sub = ulu.liked_user_sub
                LEFT JOIN Institutions i ON u.institution_id = i.institution_id
                LEFT JOIN Countries c ON u.country_id = c.country_id
                LEFT JOIN User_Titles ut ON u.cognito_sub = ut.cognito_sub
                LEFT JOIN Titles t ON ut.title_id = t.title_id
                LEFT JOIN Cities ci ON u.city_id = ci.city_id
                WHERE ulu.cognito_sub = ?
            `, [userId]),
            db.execute(`
                SELECT paper_id FROM User_Liked_Papers WHERE cognito_sub = ?
            `, [userId]),
            db.execute(`
                SELECT p.*, u.name AS author_display_name
                FROM Posts p
                INNER JOIN User_Liked_Posts ulp ON p.post_id = ulp.post_id
                LEFT JOIN Users u ON p.author_id = u.cognito_sub
                WHERE ulp.cognito_sub = ?
                ORDER BY p.created_at DESC
            `, [userId])
        ]);
    
        // 2. Process Paper IDs into a simple array
        const paperIds = paperRows.map(r => r.paper_id);
    
        // 3. Process Posts and fetch Topics (Post logic requires a second hop)
        let formattedPosts = [];
        if (postRows.length > 0) {
            const postIds = postRows.map(r => r.post_id);
            const placeholders = postIds.map(() => '?').join(',');
    
            const [topicRows] = await db.execute(`
                SELECT ptm.post_id, pt.topic_name
                FROM Post_Topic_Map ptm
                JOIN Post_Topics pt ON ptm.topic_id = pt.post_topic_id
                WHERE ptm.post_id IN (${placeholders})
                ORDER BY pt.topic_name ASC
            `, postIds);
    
            formattedPosts = postRows.map((p) => ({
                id: p.post_id,
                author: p.author_id,
                author_display_name: p.author_display_name || '',
                title: p.title,
                short_text: p.short_text,
                text: p.text,
                preview_text: typeof getPreviewText === 'function' ? getPreviewText(p) : p.short_text,
                post_topics: topicRows
                    .filter(r => r.post_id === p.post_id)
                    .map(r => r.topic_name),
                created_at: p.created_at instanceof Date ? p.created_at.toISOString() : p.created_at,
                updated_at: p.updated_at instanceof Date ? p.updated_at.toISOString() : p.updated_at,
            }));
        }
    
        // 4. Return the consolidated object
        return {
            projects: projectRows,
            people: peopleRows,
            paperIds: paperIds,
            posts: formattedPosts
        };
    },

    getLanguages: async () => {
        const [rows] = await db.execute(`
            SELECT language_id, language_name
            FROM Languages
            ORDER BY language_name ASC
        `);
        return rows;
    },
    
    updateLanguages: async (sub, languagesArray) => {
        // 1. Remove existing links
        await db.execute('DELETE FROM User_Languages WHERE cognito_sub = ?', [sub]);
    
        // 2. Normalize + deduplicate input
        const normalizedLanguages = [
            ...new Set(
                (languagesArray || [])
                    .map(language => String(language).trim().replace(/\s+/g, ' '))
                    .filter(Boolean)
            )
        ];
    
        // 3. Only link languages that exist in Languages table
        //    since you said Languages is already a defined table
        for (const language of normalizedLanguages) {
            const [rows] = await db.execute(
                'SELECT language_id FROM Languages WHERE language_name = ?',
                [language]
            );
    
            if (rows.length > 0) {
                const languageId = rows[0].language_id;
                await db.execute(
                    'INSERT IGNORE INTO User_Languages (cognito_sub, language_id) VALUES (?, ?)',
                    [sub, languageId]
                );
            }
        }
    
        return await getFullProfile(db, sub);
    },

    getTitles: async () => {
        const [rows] = await db.execute(`
            SELECT title_id, title_name
            FROM Titles
            ORDER BY title_name ASC
        `);
        return rows;
    },

    getFields: async () => {
        const [rows] = await db.execute(`
            SELECT field_id, field_name
            FROM Fields
            ORDER BY field_name ASC
        `);
        return rows;
    },

    getPositionTitles: async () => {
        const [rows] = await db.execute(`
            SELECT position_title_id, position_title_name
            FROM Position_Titles
            ORDER BY position_title_name ASC
        `);
        return rows;
    },
    
    getPositionFields: async () => {
        const [rows] = await db.execute(`
            SELECT position_field_id, position_field_name
            FROM Position_Fields
            ORDER BY position_field_name ASC
        `);
        return rows;
    },

    getLikedUserIdsForUser: async (userId) => {
        const [rows] = await db.execute(
            `
            SELECT liked_user_sub AS id
            FROM User_Liked_Users
            WHERE cognito_sub = ?
            `,
            [userId]
        );
    
        return rows.map((r) => r.id);
    },
    
    getProfileFormOptions: async () => {
        const [
            [topicsRows],
            [skillsRows],
            [languagesRows],
            [titlesRows],
            [fieldsRows],
            [positionTitleRows],
            [positionFieldRows],
        ] = await Promise.all([
            db.execute(`
                SELECT topic_id, topic_name
                FROM Topics
                ORDER BY topic_name ASC
            `),
            db.execute(`
                SELECT skill_id, skill_name
                FROM Skills
                ORDER BY skill_name ASC
            `),
            db.execute(`
                SELECT language_id, language_name
                FROM Languages
                ORDER BY language_name ASC
            `),
            db.execute(`
                SELECT title_id, title_name
                FROM Titles
                ORDER BY title_name ASC
            `),
            db.execute(`
                SELECT field_id, field_name
                FROM Fields
                ORDER BY field_name ASC
            `),
            db.execute(`
                SELECT position_title_id, position_title_name
                FROM Position_Titles
                ORDER BY position_title_name ASC
            `),
            db.execute(`
                SELECT position_field_id, position_field_name
                FROM Position_Fields
                ORDER BY position_field_name ASC
            `),
        ]);
    
        return {
            topics: topicsRows,
            skills: skillsRows,
            languages: languagesRows,
            titles: titlesRows,
            fields: fieldsRows,
            positionTitles: positionTitleRows,
            positionFields: positionFieldRows,
        };
    },
    
    getUserPageData: async (viewerSub, profileSub) => {
        const [profile, likedUserIds] = await Promise.all([
            getFullProfile(db, profileSub),
            viewerSub ? userService.getLikedUserIdsForUser(viewerSub) : Promise.resolve([]),
        ]);
    
        if (!profile) {
            return null;
        }
    
        return {
            profile,
            likedUserIds,
            isOwnProfile: viewerSub ? String(viewerSub) === String(profileSub) : false,
        };
    },

    getLikedUserIdsForUser: async (userId) => {
        const [rows] = await db.execute(`
            SELECT liked_user_sub AS id
            FROM User_Liked_Users
            WHERE cognito_sub = ?
        `, [userId]);
    
        return rows.map(row => row.id);
    },

    getAllRequiredInformationForUserPage: async (viewerSub, profileSub) => {
        try {
            console.log('getAllRequiredInformationForUserPage start', { viewerSub, profileSub });
    
            const profile = await getFullProfile(db, profileSub);
            console.log('profile loaded');
    
            if (!profile) {
                return null;
            }
    
            const likedUserIds = await userService.getLikedUserIdsForUser(viewerSub);
            console.log('liked user ids loaded');
    
            const [topics] = await db.execute(`
                SELECT topic_id, topic_name
                FROM Topics
                ORDER BY topic_name ASC
            `);
            console.log('topics loaded');
    
            const [skills] = await db.execute(`
                SELECT skill_id, skill_name
                FROM Skills
                ORDER BY skill_name ASC
            `);
            console.log('skills loaded');
    
            const languages = await userService.getLanguages();
            console.log('languages loaded');
    
            const titles = await userService.getTitles();
            console.log('titles loaded');
    
            const fields = await userService.getFields();
            console.log('fields loaded');
    
            const positionTitles = await userService.getPositionTitles();
            console.log('position titles loaded');
    
            const positionFields = await userService.getPositionFields();
            console.log('position fields loaded');
    
            return {
                profile,
                likedUserIds,
                formOptions: {
                    topics,
                    skills,
                    languages,
                    titles,
                    fields,
                    positionTitles,
                    positionFields,
                }
            };
    
        } catch (err) {
            console.error('getAllRequiredInformationForUserPage failed:', err);
            throw err;
        }
    },

    getTopTopicScores: async (userId, limit = 10) => {
        const safeLimit = Math.max(1, Math.min(50, Number(limit) || 10));
    
        const [rows] = await db.execute(`
            SELECT topic_id, score
            FROM User_Topic_Scores
            WHERE cognito_sub = ?
            ORDER BY score DESC, topic_id ASC
            LIMIT ${safeLimit}
        `, [userId]);
    
        return rows;
    },

    createReport: async (reporterId, reportedItemType, reportedItemId, reportNote) => {
        const allowedTypes = new Set([
            'post',
            'project',
            'event',
            'paper',
            'post_comment',
            'paper_comment',
            'user',
            'other',
        ]);
    
        const normalizedType = String(reportedItemType || '').trim();
        const normalizedItemId = String(reportedItemId || '').trim();
        const normalizedNote = String(reportNote || '').trim();
    
        if (!normalizedType || !allowedTypes.has(normalizedType)) {
            throw new Error('Invalid reported item type.');
        }
    
        if (normalizedType !== 'other' && !normalizedItemId) {
            throw new Error('Reported item id is required.');
        }
    
        if (!normalizedNote) {
            throw new Error('Report note is required.');
        }
    
        if (normalizedNote.length > 2000) {
            throw new Error('Report note is too long.');
        }
    
        const query = `
            INSERT INTO Reports (
                reporter_id,
                reported_item_type,
                reported_item_id,
                report_note
            )
            VALUES (?, ?, ?, ?)
        `;
    
        const [result] = await db.execute(query, [
            reporterId,
            normalizedType,
            normalizedItemId || null,
            normalizedNote,
        ]);
    
        return {
            success: true,
            reportId: result.insertId,
        };
    },

};

export default userService;