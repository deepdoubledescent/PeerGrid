import db from '../db.js';
import notificationService from './notificationService.js';

const normalizeTopics = (topics) => {
    return [
        ...new Set(
            (topics || [])
                .map(t => String(t).trim())
                .filter(Boolean)
        )
    ];
};

const formatLocationLabel = (cityName, countryName) => {
    if (cityName && countryName) return `${cityName}, ${countryName}`;
    if (countryName) return countryName;
    return '';
};

const resolveLocationIds = async (locationLabel, executor = db) => {
    const value = String(locationLabel || '').trim();

    if (!value) {
        return { city_id: null, country_id: null };
    }

    const parts = value
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);

    if (parts.length === 1) {
        const [countryRows] = await executor.execute(
            `
                SELECT country_id
                FROM Countries
                WHERE country_name = ?
                LIMIT 1
            `,
            [parts[0]]
        );

        if (!countryRows.length) {
            throw new Error('Invalid location. Please select a valid country or city.');
        }

        return {
            city_id: null,
            country_id: countryRows[0].country_id,
        };
    }

    if (parts.length === 2) {
        const [rows] = await executor.execute(
            `
                SELECT ci.city_id, co.country_id
                FROM Cities ci
                JOIN Countries co ON ci.country_id = co.country_id
                WHERE ci.city_name = ? AND co.country_name = ?
                LIMIT 1
            `,
            [parts[0], parts[1]]
        );

        if (!rows.length) {
            throw new Error('Invalid location. Please select a valid city/country.');
        }

        return {
            city_id: rows[0].city_id,
            country_id: rows[0].country_id,
        };
    }

    throw new Error('Invalid location format. Use "Country" or "City, Country".');
};

const formatEventRow = (e, extra = {}) => {
    const eventDateIso =
        e.event_date instanceof Date
            ? e.event_date.toISOString()
            : e.event_date;

    const now = new Date();
    const completed =
        !!e.completed ||
        (eventDateIso ? new Date(eventDateIso) < now : false);

    return {
        id: e.event_id,
        author: e.cognito_sub,
        author_display_name: extra.author_display_name || '',
        title: e.title,
        details: e.details,
        location: extra.location || '',
        country_id: e.country_id ?? null,
        city_id: e.city_id ?? null,
        place: e.place,
        is_online: !!e.is_online,
        event_date: eventDateIso,
        allow_application_count_visible: !!e.allow_application_count_visible,
        allow_applicants_visible: !!e.allow_applicants_visible,
        created_at: e.created_at instanceof Date ? e.created_at.toISOString() : e.created_at,
        updated_at: e.updated_at instanceof Date ? e.updated_at.toISOString() : e.updated_at,
        registration_count: Number(extra.registration_count || 0),
        topics: extra.topics || [],
        registrants: extra.registrants || [],
        completed,
        is_creator: !!extra.is_creator,
        can_edit: !!extra.can_edit,
    };
};

const eventService = {
    getEventTopics: async () => {
        const [rows] = await db.execute(`
            SELECT topic_id, topic_name
            FROM Topics
            ORDER BY topic_name ASC
        `);

        return rows;
    },

    createEvent: async (userSub, eventData) => {
        const title = String(eventData?.title || '').trim();
        const details = String(eventData?.details || '').trim();
        const location = String(eventData?.location || '').trim();
        const place = eventData?.place ? String(eventData.place).trim() : null;
        const isOnline = !!eventData?.is_online;
        const eventDate = eventData?.event_date;
        const topics = normalizeTopics(eventData?.topics);

        if (!title) throw new Error('Event title is required');
        if (!details) throw new Error('Event details are required');
        if (!eventDate) throw new Error('Event date is required');
        if (!isOnline && !location) {
            throw new Error('Location is required for non-online events');
        }

        let cityId = null;
        let countryId = null;

        if (!isOnline) {
            const resolved = await resolveLocationIds(location);
            cityId = resolved.city_id;
            countryId = resolved.country_id;
        }

        const [result] = await db.execute(`
            INSERT INTO Events (
                cognito_sub,
                title,
                details,
                country_id,
                city_id,
                place,
                is_online,
                event_date,
                allow_application_count_visible,
                allow_applicants_visible,
                completed
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        `, [
            userSub,
            title,
            details,
            isOnline ? null : countryId,
            isOnline ? null : cityId,
            isOnline ? null : place,
            isOnline ? 1 : 0,
            eventDate,
            eventData?.allow_application_count_visible ? 1 : 0,
            eventData?.allow_applicants_visible ? 1 : 0,
        ]);

        const eventId = result.insertId;

        for (const topic of topics) {
            await db.execute(
                `INSERT IGNORE INTO Topics (topic_name) VALUES (?)`,
                [topic]
            );

            const [topicRows] = await db.execute(
                `SELECT topic_id FROM Topics WHERE topic_name = ?`,
                [topic]
            );

            if (topicRows.length > 0) {
                await db.execute(`
                    INSERT IGNORE INTO Event_Topics (event_id, topic_id)
                    VALUES (?, ?)
                `, [eventId, topicRows[0].topic_id]);
            }
        }

        return { id: eventId };
    },

    searchEvents: async (authUserId, filter = {}) => {
        const {
            page = 1,
            query = '',
            location = '',
            start_date = '',
            end_date = '',
            topics = [],
            results_per_page = 10,
            sortBy = 'date_asc',
            status = 'upcoming',
            is_online = null,
        } = filter;
    
        const safePage = Math.max(1, Number(page) || 1);
        const safeLimit = Math.max(1, Math.min(50, Number(results_per_page) || 10));
        const offset = (safePage - 1) * safeLimit;
    
        const trimmedQuery = String(query || '').trim();
        const trimmedLocation = String(location || '').trim();
    
        const lowerQuery = trimmedQuery ? `%${trimmedQuery.toLowerCase()}%` : null;
        const lowerLocation = trimmedLocation ? `%${trimmedLocation.toLowerCase()}%` : null;
        const normalizedTopics = normalizeTopics(topics);
    
        const fromClause = `
            FROM Events e
            LEFT JOIN Users u ON e.cognito_sub = u.cognito_sub
            LEFT JOIN Cities ci ON e.city_id = ci.city_id
            LEFT JOIN Countries co ON e.country_id = co.country_id
        `;
    
        const whereClauses = [];
        const queryParams = [];
    
        if (lowerQuery) {
            whereClauses.push(`
                (
                    LOWER(e.title) LIKE ?
                    OR LOWER(e.details) LIKE ?
                    OR LOWER(COALESCE(ci.city_name, '')) LIKE ?
                    OR LOWER(COALESCE(co.country_name, '')) LIKE ?
                    OR LOWER(COALESCE(e.place, '')) LIKE ?
                    OR (? = '%online%' AND e.is_online = 1)
                )
            `);
            queryParams.push(lowerQuery, lowerQuery, lowerQuery, lowerQuery, lowerQuery, lowerQuery);
        }
    
        if (lowerLocation) {
            whereClauses.push(`
                (
                    LOWER(COALESCE(ci.city_name, '')) LIKE ?
                    OR LOWER(COALESCE(co.country_name, '')) LIKE ?
                )
            `);
            queryParams.push(lowerLocation, lowerLocation);
        }
    
        if (start_date) {
            whereClauses.push(`DATE(e.event_date) >= ?`);
            queryParams.push(start_date);
        }
    
        if (end_date) {
            whereClauses.push(`DATE(e.event_date) <= ?`);
            queryParams.push(end_date);
        }
    
        if (status === 'upcoming') {
            whereClauses.push(`e.event_date >= NOW()`);
        } else if (status === 'completed') {
            whereClauses.push(`e.event_date < NOW()`);
        }
    
        if (typeof is_online === 'boolean') {
            whereClauses.push(`e.is_online = ?`);
            queryParams.push(is_online ? 1 : 0);
        }
    
        if (normalizedTopics.length > 0) {
            const topicPlaceholders = normalizedTopics.map(() => '?').join(',');
            whereClauses.push(`
                EXISTS (
                    SELECT 1
                    FROM Event_Topics et
                    JOIN Topics t ON et.topic_id = t.topic_id
                    WHERE et.event_id = e.event_id
                      AND t.topic_name IN (${topicPlaceholders})
                )
            `);
            queryParams.push(...normalizedTopics);
        }
    
        const whereSql = whereClauses.length
            ? `WHERE ${whereClauses.join(' AND ')}`
            : '';
    
        const countSql = `
            SELECT COUNT(DISTINCT e.event_id) AS total
            ${fromClause}
            ${whereSql}
        `;
    
        const [countRows] = await db.execute(countSql, queryParams);
        const total_results = Number(countRows[0]?.total || 0);
    
        let orderByClause = 'ORDER BY e.event_date ASC';
        if (sortBy === 'date_desc') {
            orderByClause = 'ORDER BY e.event_date DESC';
        } else if (sortBy === 'title_asc') {
            orderByClause = 'ORDER BY e.title ASC';
        }
    
        const paginatedSql = `
            SELECT DISTINCT
                e.*,
                u.name AS author_display_name,
                ci.city_name,
                co.country_name
            ${fromClause}
            ${whereSql}
            ${orderByClause}
            LIMIT ${safeLimit} OFFSET ${offset}
        `;
    
        const [rows] = await db.query(paginatedSql, queryParams);
    
        if (rows.length === 0) {
            return {
                events: [],
                total_results: 0,
                page: safePage,
                results_per_page: safeLimit,
            };
        }
    
        const eventIds = rows.map((r) => r.event_id);
        const eventPlaceholders = eventIds.map(() => '?').join(',');
    
        const [topicRows] = await db.execute(`
            SELECT et.event_id, t.topic_name
            FROM Event_Topics et
            JOIN Topics t ON et.topic_id = t.topic_id
            WHERE et.event_id IN (${eventPlaceholders})
            ORDER BY t.topic_name ASC
        `, eventIds);
    
        const [registrationRows] = await db.execute(`
            SELECT event_id, COUNT(*) AS registration_count
            FROM Event_Registrations
            WHERE event_id IN (${eventPlaceholders})
            GROUP BY event_id
        `, eventIds);
    
        const topicMap = new Map();
        for (const row of topicRows) {
            if (!topicMap.has(row.event_id)) topicMap.set(row.event_id, []);
            topicMap.get(row.event_id).push(row.topic_name);
        }
    
        const registrationMap = new Map(
            registrationRows.map((r) => [r.event_id, Number(r.registration_count) || 0])
        );
    
        const events = rows.map((e) =>
            formatEventRow(e, {
                author_display_name: e.author_display_name || '',
                location: formatLocationLabel(e.city_name, e.country_name),
                topics: topicMap.get(e.event_id) || [],
                registration_count: registrationMap.get(e.event_id) || 0,
                is_creator: !!(authUserId && String(authUserId) === String(e.cognito_sub)),
                can_edit: !!(authUserId && String(authUserId) === String(e.cognito_sub)),
            })
        );
    
        return {
            events,
            total_results,
            page: safePage,
            results_per_page: safeLimit,
        };
    },

    getEvent: async (authUserId, eventId) => {
        const [rows] = await db.execute(`
            SELECT
                e.*,
                u.name AS author_display_name,
                ci.city_name,
                co.country_name
            FROM Events e
            LEFT JOIN Users u ON e.cognito_sub = u.cognito_sub
            LEFT JOIN Cities ci ON e.city_id = ci.city_id
            LEFT JOIN Countries co ON e.country_id = co.country_id
            WHERE e.event_id = ?
        `, [eventId]);

        if (rows.length === 0) return null;

        const e = rows[0];

        const [topicRows] = await db.execute(`
            SELECT t.topic_name
            FROM Event_Topics et
            JOIN Topics t ON et.topic_id = t.topic_id
            WHERE et.event_id = ?
            ORDER BY t.topic_name ASC
        `, [eventId]);

        const [registrationCountRows] = await db.execute(`
            SELECT COUNT(*) AS registration_count
            FROM Event_Registrations
            WHERE event_id = ?
        `, [eventId]);

        const isOwner = authUserId && String(authUserId) === String(e.cognito_sub);

        let registrants = [];
        if (isOwner || !!e.allow_applicants_visible) {
            const [registrantRows] = await db.execute(`
                SELECT
                    er.cognito_sub AS user_id,
                    u.name AS display_name,
                    er.created_at AS registered_at
                FROM Event_Registrations er
                JOIN Users u ON er.cognito_sub = u.cognito_sub
                WHERE er.event_id = ?
                ORDER BY er.created_at ASC
            `, [eventId]);

            registrants = registrantRows.map(r => ({
                user_id: r.user_id,
                display_name: r.display_name,
                registered_at: r.registered_at instanceof Date
                    ? r.registered_at.toISOString()
                    : r.registered_at,
            }));
        }

        return formatEventRow(e, {
            author_display_name: e.author_display_name || '',
            location: formatLocationLabel(e.city_name, e.country_name),
            topics: topicRows.map(r => r.topic_name),
            registration_count: registrationCountRows[0]?.registration_count || 0,
            registrants,
            is_creator: !!isOwner,
            can_edit: !!isOwner,
        });
    },

    updateEvent: async (userSub, eventId, eventData) => {
        const [ownedRows] = await db.execute(`
            SELECT event_id
            FROM Events
            WHERE event_id = ? AND cognito_sub = ?
        `, [eventId, userSub]);

        if (ownedRows.length === 0) {
            throw new Error('Event not found or you do not have permission to edit it.');
        }

        const title = String(eventData?.title || '').trim();
        const details = String(eventData?.details || '').trim();
        const location = String(eventData?.location || '').trim();
        const place = eventData?.place ? String(eventData.place).trim() : null;
        const isOnline = !!eventData?.is_online;
        const eventDate = eventData?.event_date;
        const topics = normalizeTopics(eventData?.topics);

        if (!title) throw new Error('Event title is required');
        if (!details) throw new Error('Event details are required');
        if (!eventDate) throw new Error('Event date is required');
        if (!isOnline && !location) {
            throw new Error('Location is required for non-online events');
        }

        let cityId = null;
        let countryId = null;

        if (!isOnline) {
            const resolved = await resolveLocationIds(location);
            cityId = resolved.city_id;
            countryId = resolved.country_id;
        }

        const connection = await db.getConnection();

        try {
            await connection.beginTransaction();

            await connection.execute(`
                UPDATE Events
                SET
                    title = ?,
                    details = ?,
                    country_id = ?,
                    city_id = ?,
                    place = ?,
                    is_online = ?,
                    event_date = ?,
                    allow_application_count_visible = ?,
                    allow_applicants_visible = ?,
                    completed = CASE WHEN ? < NOW() THEN 1 ELSE 0 END
                WHERE event_id = ? AND cognito_sub = ?
            `, [
                title,
                details,
                isOnline ? null : countryId,
                isOnline ? null : cityId,
                isOnline ? null : place,
                isOnline ? 1 : 0,
                eventDate,
                eventData?.allow_application_count_visible ? 1 : 0,
                eventData?.allow_applicants_visible ? 1 : 0,
                eventDate,
                eventId,
                userSub,
            ]);

            await connection.execute(
                `DELETE FROM Event_Topics WHERE event_id = ?`,
                [eventId]
            );

            for (const topic of topics) {
                await connection.execute(
                    `INSERT IGNORE INTO Topics (topic_name) VALUES (?)`,
                    [topic]
                );

                const [topicRows] = await connection.execute(
                    `SELECT topic_id FROM Topics WHERE topic_name = ?`,
                    [topic]
                );

                if (topicRows.length > 0) {
                    await connection.execute(`
                        INSERT IGNORE INTO Event_Topics (event_id, topic_id)
                        VALUES (?, ?)
                    `, [eventId, topicRows[0].topic_id]);
                }
            }

            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

        return await eventService.getEvent(userSub, eventId);
    },

    deleteEvent: async (userSub, eventId) => {
        const [ownedRows] = await db.execute(`
            SELECT event_id
            FROM Events
            WHERE event_id = ? AND cognito_sub = ?
        `, [eventId, userSub]);

        if (ownedRows.length === 0) {
            return {
                success: false,
                message: 'Event not found or you do not have permission to delete it.'
            };
        }

        const connection = await db.getConnection();

        try {
            await connection.beginTransaction();

            await connection.execute(
                `DELETE FROM Event_Registrations WHERE event_id = ?`,
                [eventId]
            );

            await connection.execute(
                `DELETE FROM Event_Topics WHERE event_id = ?`,
                [eventId]
            );

            await connection.execute(
                `DELETE FROM Events WHERE event_id = ? AND cognito_sub = ?`,
                [eventId, userSub]
            );

            await connection.commit();

            return {
                success: true,
                deleted_event_id: eventId,
            };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    },

    registerForEvent: async (userSub, eventId) => {
        const [eventRows] = await db.execute(`
            SELECT event_id, cognito_sub, title, event_date
            FROM Events
            WHERE event_id = ?
        `, [eventId]);

        if (eventRows.length === 0) {
            throw new Error('Event not found');
        }

        const eventRow = eventRows[0];

        if (String(eventRow.cognito_sub) === String(userSub)) {
            throw new Error('You cannot register for your own event');
        }

        if (new Date(eventRow.event_date) < new Date()) {
            throw new Error('This event has already passed');
        }

        const [existingRows] = await db.execute(`
            SELECT registration_id
            FROM Event_Registrations
            WHERE event_id = ? AND cognito_sub = ?
            LIMIT 1
        `, [eventId, userSub]);

        if (existingRows.length > 0) {
            return { success: true, alreadyRegistered: true };
        }

        const [insertResult] = await db.execute(`
            INSERT INTO Event_Registrations (event_id, cognito_sub)
            VALUES (?, ?)
        `, [eventId, userSub]);

        try {
            const [userRows] = await db.execute(
                `SELECT name FROM Users WHERE cognito_sub = ?`,
                [userSub]
            );

            const userName = userRows[0]?.name || 'Someone';

            await notificationService.addNotification({
                sub: eventRow.cognito_sub,
                originId: userSub,
                type: 'event_registration',
                message: `${userName} registered for your event “${eventRow.title}”.`,
            });
        } catch (err) {
            console.error(err);
        }

        return {
            success: true,
            registrationId: insertResult.insertId,
        };
    },

    unregisterFromEvent: async (userSub, eventId) => {
        await db.execute(`
            DELETE FROM Event_Registrations
            WHERE event_id = ? AND cognito_sub = ?
        `, [eventId, userSub]);

        return { success: true };
    },

    hasUserRegisteredToEvent: async (userSub, eventId) => {
        const [rows] = await db.execute(`
            SELECT 1
            FROM Event_Registrations
            WHERE event_id = ? AND cognito_sub = ?
            LIMIT 1
        `, [eventId, userSub]);

        return rows.length > 0;
    },

    listMyEvents: async (userSub) => {
        const [rows] = await db.execute(`
            SELECT
                e.*,
                u.name AS author_display_name,
                ci.city_name,
                co.country_name
            FROM Events e
            LEFT JOIN Users u ON e.cognito_sub = u.cognito_sub
            LEFT JOIN Cities ci ON e.city_id = ci.city_id
            LEFT JOIN Countries co ON e.country_id = co.country_id
            WHERE e.cognito_sub = ?
            ORDER BY e.event_date ASC
        `, [userSub]);

        if (!rows.length) return [];

        const eventIds = rows.map(r => r.event_id);
        const placeholders = eventIds.map(() => '?').join(',');

        const [topicRows] = await db.execute(`
            SELECT et.event_id, t.topic_name
            FROM Event_Topics et
            JOIN Topics t ON et.topic_id = t.topic_id
            WHERE et.event_id IN (${placeholders})
            ORDER BY t.topic_name ASC
        `, eventIds);

        const [registrationRows] = await db.execute(`
            SELECT event_id, COUNT(*) AS registration_count
            FROM Event_Registrations
            WHERE event_id IN (${placeholders})
            GROUP BY event_id
        `, eventIds);

        const topicMap = new Map();
        for (const row of topicRows) {
            if (!topicMap.has(row.event_id)) topicMap.set(row.event_id, []);
            topicMap.get(row.event_id).push(row.topic_name);
        }

        const registrationMap = new Map(
            registrationRows.map(r => [r.event_id, Number(r.registration_count) || 0])
        );

        return rows.map(e =>
            formatEventRow(e, {
                author_display_name: e.author_display_name || '',
                location: formatLocationLabel(e.city_name, e.country_name),
                topics: topicMap.get(e.event_id) || [],
                registration_count: registrationMap.get(e.event_id) || 0,
                is_creator: true,
                can_edit: true,
            })
        );
    },

    listRegisteredEvents: async (userSub) => {
        const [rows] = await db.execute(`
            SELECT
                e.*,
                u.name AS author_display_name,
                ci.city_name,
                co.country_name,
                er.created_at AS registered_at
            FROM Event_Registrations er
            JOIN Events e ON er.event_id = e.event_id
            LEFT JOIN Users u ON e.cognito_sub = u.cognito_sub
            LEFT JOIN Cities ci ON e.city_id = ci.city_id
            LEFT JOIN Countries co ON e.country_id = co.country_id
            WHERE er.cognito_sub = ?
            ORDER BY e.event_date ASC
        `, [userSub]);

        if (!rows.length) return [];

        const eventIds = rows.map(r => r.event_id);
        const placeholders = eventIds.map(() => '?').join(',');

        const [topicRows] = await db.execute(`
            SELECT et.event_id, t.topic_name
            FROM Event_Topics et
            JOIN Topics t ON et.topic_id = t.topic_id
            WHERE et.event_id IN (${placeholders})
            ORDER BY t.topic_name ASC
        `, eventIds);

        const [registrationRows] = await db.execute(`
            SELECT event_id, COUNT(*) AS registration_count
            FROM Event_Registrations
            WHERE event_id IN (${placeholders})
            GROUP BY event_id
        `, eventIds);

        const topicMap = new Map();
        for (const row of topicRows) {
            if (!topicMap.has(row.event_id)) topicMap.set(row.event_id, []);
            topicMap.get(row.event_id).push(row.topic_name);
        }

        const registrationMap = new Map(
            registrationRows.map(r => [r.event_id, Number(r.registration_count) || 0])
        );

        return rows.map(e => ({
            ...formatEventRow(e, {
                author_display_name: e.author_display_name || '',
                location: formatLocationLabel(e.city_name, e.country_name),
                topics: topicMap.get(e.event_id) || [],
                registration_count: registrationMap.get(e.event_id) || 0,
                is_creator: false,
                can_edit: false,
            }),
            registered_at: e.registered_at instanceof Date
                ? e.registered_at.toISOString()
                : e.registered_at,
        }));
    },

    refreshCompletedFlags: async () => {
        await db.execute(`
            UPDATE Events
            SET completed = CASE WHEN event_date < NOW() THEN 1 ELSE 0 END
        `);

        return { success: true };
    },

    listUserEvents: async (authUserId, targetUserId) => {
        const [rows] = await db.execute(`
            SELECT
                e.*,
                u.name AS author_display_name,
                ci.city_name,
                co.country_name
            FROM Events e
            LEFT JOIN Users u ON e.cognito_sub = u.cognito_sub
            LEFT JOIN Cities ci ON e.city_id = ci.city_id
            LEFT JOIN Countries co ON e.country_id = co.country_id
            WHERE e.cognito_sub = ?
            ORDER BY e.event_date ASC
        `, [targetUserId]);

        if (!rows.length) return [];

        const eventIds = rows.map(r => r.event_id);
        const placeholders = eventIds.map(() => '?').join(',');

        const [topicRows] = await db.execute(`
            SELECT et.event_id, t.topic_name
            FROM Event_Topics et
            JOIN Topics t ON et.topic_id = t.topic_id
            WHERE et.event_id IN (${placeholders})
            ORDER BY t.topic_name ASC
        `, eventIds);

        const [registrationRows] = await db.execute(`
            SELECT event_id, COUNT(*) AS registration_count
            FROM Event_Registrations
            WHERE event_id IN (${placeholders})
            GROUP BY event_id
        `, eventIds);

        const topicMap = new Map();
        for (const row of topicRows) {
            if (!topicMap.has(row.event_id)) topicMap.set(row.event_id, []);
            topicMap.get(row.event_id).push(row.topic_name);
        }

        const registrationMap = new Map(
            registrationRows.map(r => [r.event_id, Number(r.registration_count) || 0])
        );

        return rows.map(e => {
            const isOwner =
                authUserId && String(authUserId) === String(e.cognito_sub);

            return formatEventRow(e, {
                author_display_name: e.author_display_name || '',
                location: formatLocationLabel(e.city_name, e.country_name),
                topics: topicMap.get(e.event_id) || [],
                registration_count: registrationMap.get(e.event_id) || 0,
                is_creator: !!isOwner,
                can_edit: !!isOwner,
            });
        });
    },
};

export default eventService;