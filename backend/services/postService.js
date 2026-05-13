import db from '../db.js';

const normalizeTopics = (topics) => {
    return [
        ...new Set(
            (topics || [])
                .map(t => String(t).trim())
                .filter(Boolean)
        )
    ];
};

const getPreviewText = (post) => {
    if (post.short_text && String(post.short_text).trim()) {
        return String(post.short_text).trim();
    }

    const fullText = String(post.text || '').trim();
    if (fullText.length <= 180) return fullText;

    return fullText.slice(0, 180).trim() + '...';
};

const postService = {
    getPostTopics: async () => {
        const [rows] = await db.execute(`
            SELECT post_topic_id, topic_name
            FROM Post_Topics
            ORDER BY topic_name ASC
        `);

        return rows;
    },

    createPost: async (authorId, postData) => {
        const title = String(postData?.title || '').trim();
        const shortText = postData?.short_text ? String(postData.short_text).trim() : null;
        const text = String(postData?.text || '').trim();
        const topics = normalizeTopics(postData?.post_topics);

        if (!title) {
            throw new Error('Post title is required');
        }

        if (!text) {
            throw new Error('Post text is required');
        }

        const connection = await db.getConnection();

        try {
            await connection.beginTransaction();

            const [insertResult] = await connection.execute(`
                INSERT INTO Posts (
                    author_id,
                    title,
                    short_text,
                    text
                ) VALUES (?, ?, ?, ?)
            `, [
                authorId,
                title,
                shortText || null,
                text
            ]);

            const postId = insertResult.insertId;

            for (const topic of topics) {
                await connection.execute(
                    `INSERT IGNORE INTO Post_Topics (topic_name) VALUES (?)`,
                    [topic]
                );

                const [topicRows] = await connection.execute(
                    `SELECT post_topic_id FROM Post_Topics WHERE topic_name = ?`,
                    [topic]
                );

                if (topicRows.length > 0) {
                    await connection.execute(
                        `
                        INSERT IGNORE INTO Post_Topic_Map (post_id, topic_id)
                        VALUES (?, ?)
                        `,
                        [postId, topicRows[0].post_topic_id]
                    );
                }
            }

            await connection.commit();

            return { id: postId };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    },

    searchPosts: async (authUserId, filter = {}) => {
        const {
            page = 1,
            query = '',
            topics = [],
            results_per_page = 10,
            sortBy = 'date_newest',
        } = filter;

        const safePage = Math.max(1, Number(page) || 1);
        const safeLimit = Math.max(1, Math.min(50, Number(results_per_page) || 10));
        const offset = (safePage - 1) * safeLimit;

        const lowerQuery = query ? `%${String(query).toLowerCase().trim()}%` : null;
        const normalizedTopics = normalizeTopics(topics);

        let selectClause = `
            SELECT DISTINCT
                p.*,
                u.name AS author_display_name,
                CASE
                    WHEN ? IS NOT NULL AND LOWER(p.title) LIKE ? THEN 'title'
                    WHEN ? IS NOT NULL AND LOWER(COALESCE(p.short_text, '')) LIKE ? THEN 'short_text'
                    WHEN ? IS NOT NULL AND LOWER(p.text) LIKE ? THEN 'text'
                    ELSE ''
                END AS relevant_field,
                CASE
                    WHEN ? IS NOT NULL AND LOWER(p.title) LIKE ? THEN 1
                    WHEN ? IS NOT NULL AND LOWER(COALESCE(p.short_text, '')) LIKE ? THEN 2
                    WHEN ? IS NOT NULL AND LOWER(p.text) LIKE ? THEN 3
                    ELSE 4
                END AS relevance_score
        `;

        const selectParams = Array(12).fill(lowerQuery);

        let fromClause = `
            FROM Posts p
            LEFT JOIN Users u ON p.author_id = u.cognito_sub
        `;

        let whereClauses = [];
        let queryParams = [];

        if (lowerQuery) {
            whereClauses.push(`
                (
                    LOWER(p.title) LIKE ?
                    OR LOWER(COALESCE(p.short_text, '')) LIKE ?
                    OR LOWER(p.text) LIKE ?
                )
            `);
            queryParams.push(lowerQuery, lowerQuery, lowerQuery);
        }

        if (normalizedTopics.length > 0) {
            const placeholders = normalizedTopics.map(() => '?').join(',');
            whereClauses.push(`
                EXISTS (
                    SELECT 1
                    FROM Post_Topic_Map ptm
                    JOIN Post_Topics pt
                      ON ptm.topic_id = pt.post_topic_id
                    WHERE ptm.post_id = p.post_id
                      AND pt.topic_name IN (${placeholders})
                )
            `);
            queryParams.push(...normalizedTopics);
        }

        const whereSql = whereClauses.length
            ? `WHERE ${whereClauses.join(' AND ')}`
            : '';

        const countSql = `
            SELECT COUNT(DISTINCT p.post_id) AS total
            ${fromClause}
            ${whereSql}
        `;

        const [countRows] = await db.execute(countSql, queryParams);
        const total_results = countRows[0]?.total || 0;

        let orderByClause = '';
        if (sortBy === 'recommended' && lowerQuery) {
            orderByClause = 'ORDER BY relevance_score ASC, p.created_at DESC';
        } else if (sortBy === 'date_oldest') {
            orderByClause = 'ORDER BY p.created_at ASC';
        } else {
            orderByClause = 'ORDER BY p.created_at DESC';
        }

        const paginatedSql = `
            ${selectClause}
            ${fromClause}
            ${whereSql}
            ${orderByClause}
            LIMIT ? OFFSET ?
        `;

        const finalParams = [
            ...selectParams,
            ...queryParams,
            String(safeLimit),
            String(offset),
        ];

        const [posts] = await db.execute(
            paginatedSql,
            finalParams.map(p => p !== null ? p.toString() : null)
        );

        if (posts.length === 0) {
            return {
                posts: [],
                total_results: 0,
                page: safePage,
                results_per_page: safeLimit,
            };
        }

        const postIds = posts.map(p => p.post_id);
        const placeholders = postIds.map(() => '?').join(',');

        const [topicRows] = await db.execute(`
            SELECT ptm.post_id, pt.topic_name
            FROM Post_Topic_Map ptm
            JOIN Post_Topics pt ON ptm.topic_id = pt.post_topic_id
            WHERE ptm.post_id IN (${placeholders})
            ORDER BY pt.topic_name ASC
        `, postIds);

        const formattedPosts = posts.map((p) => {
            const postTopics = topicRows
                .filter(r => r.post_id === p.post_id)
                .map(r => r.topic_name);

            return {
                id: p.post_id,
                author: p.author_id,
                author_display_name: p.author_display_name || '',
                title: p.title,
                short_text: p.short_text,
                text: p.text,
                preview_text: getPreviewText(p),
                post_topics: postTopics,
                created_at: p.created_at instanceof Date
                    ? p.created_at.toISOString()
                    : p.created_at,
                updated_at: p.updated_at instanceof Date
                    ? p.updated_at.toISOString()
                    : p.updated_at,
                relevant_field: p.relevant_field,
            };
        });

        return {
            posts: formattedPosts,
            total_results,
            page: safePage,
            results_per_page: safeLimit,
        };
    },

    listUserPosts: async (userId) => {
        const [rows] = await db.execute(`
            SELECT
                p.post_id,
                p.author_id,
                p.title,
                p.short_text,
                p.text,
                p.created_at,
                p.updated_at,
                u.name AS author_display_name
            FROM Posts p
            LEFT JOIN Users u ON p.author_id = u.cognito_sub
            WHERE p.author_id = ?
            ORDER BY p.created_at DESC
        `, [userId]);

        if (rows.length === 0) return [];

        const postIds = rows.map(r => r.post_id);
        const placeholders = postIds.map(() => '?').join(',');

        const [topicRows] = await db.execute(`
            SELECT ptm.post_id, pt.topic_name
            FROM Post_Topic_Map ptm
            JOIN Post_Topics pt ON ptm.topic_id = pt.post_topic_id
            WHERE ptm.post_id IN (${placeholders})
            ORDER BY pt.topic_name ASC
        `, postIds);

        return rows.map((p) => ({
            id: p.post_id,
            author: p.author_id,
            author_display_name: p.author_display_name || '',
            title: p.title,
            short_text: p.short_text,
            text: p.text,
            preview_text: getPreviewText(p),
            post_topics: topicRows
                .filter(r => r.post_id === p.post_id)
                .map(r => r.topic_name),
            created_at: p.created_at instanceof Date
                ? p.created_at.toISOString()
                : p.created_at,
            updated_at: p.updated_at instanceof Date
                ? p.updated_at.toISOString()
                : p.updated_at,
        }));
    },

    getFeedPosts: async (userId, filter = {}) => {
        const {
            page = 1,
            results_per_page = 10,
        } = filter;

        const safePage = Math.max(1, Number(page) || 1);
        const safeLimit = Math.max(1, Math.min(50, Number(results_per_page) || 10));
        const offset = (safePage - 1) * safeLimit;

        const [countRows] = await db.execute(`
            SELECT COUNT(*) AS total
            FROM Posts p
            INNER JOIN User_Liked_Users ulu
                ON ulu.liked_user_sub = p.author_id
            WHERE ulu.cognito_sub = ?
        `, [userId]);

        const total_results = countRows[0]?.total || 0;

        const [rows] = await db.execute(`
            SELECT
                p.post_id,
                p.author_id,
                p.title,
                p.short_text,
                p.text,
                p.created_at,
                p.updated_at,
                u.name AS author_display_name
            FROM Posts p
            INNER JOIN User_Liked_Users ulu
                ON ulu.liked_user_sub = p.author_id
            LEFT JOIN Users u
                ON u.cognito_sub = p.author_id
            WHERE ulu.cognito_sub = ?
            ORDER BY p.created_at DESC
            LIMIT ? OFFSET ?
        `, [userId, String(safeLimit), String(offset)]);

        if (rows.length === 0) {
            return {
                posts: [],
                total_results: 0,
                page: safePage,
                results_per_page: safeLimit,
            };
        }

        const postIds = rows.map(r => r.post_id);
        const placeholders = postIds.map(() => '?').join(',');

        const [topicRows] = await db.execute(`
            SELECT ptm.post_id, pt.topic_name
            FROM Post_Topic_Map ptm
            JOIN Post_Topics pt ON ptm.topic_id = pt.post_topic_id
            WHERE ptm.post_id IN (${placeholders})
            ORDER BY pt.topic_name ASC
        `, postIds);

        const posts = rows.map((p) => ({
            id: p.post_id,
            author: p.author_id,
            author_display_name: p.author_display_name || '',
            title: p.title,
            short_text: p.short_text,
            text: p.text,
            preview_text: getPreviewText(p),
            post_topics: topicRows
                .filter(r => r.post_id === p.post_id)
                .map(r => r.topic_name),
            created_at: p.created_at instanceof Date
                ? p.created_at.toISOString()
                : p.created_at,
            updated_at: p.updated_at instanceof Date
                ? p.updated_at.toISOString()
                : p.updated_at,
        }));

        return {
            posts,
            total_results,
            page: safePage,
            results_per_page: safeLimit,
        };
    },

    getPost: async (authUserId, postId) => {
        const [rows] = await db.execute(`
            SELECT
                p.post_id,
                p.author_id,
                p.title,
                p.short_text,
                p.text,
                p.created_at,
                p.updated_at,
                u.name AS author_display_name
            FROM Posts p
            LEFT JOIN Users u ON p.author_id = u.cognito_sub
            WHERE p.post_id = ?
        `, [postId]);
    
        if (rows.length === 0) return null;
    
        const p = rows[0];
    
        const [topicRows] = await db.execute(`
            SELECT pt.topic_name
            FROM Post_Topic_Map ptm
            JOIN Post_Topics pt ON ptm.topic_id = pt.post_topic_id
            WHERE ptm.post_id = ?
            ORDER BY pt.topic_name ASC
        `, [postId]);
    
        return {
            id: p.post_id,
            author: p.author_id,
            author_display_name: p.author_display_name || '',
            title: p.title,
            short_text: p.short_text,
            text: p.text,
            preview_text: getPreviewText(p),
            post_topics: topicRows.map(r => r.topic_name),
            created_at: p.created_at instanceof Date ? p.created_at.toISOString() : p.created_at,
            updated_at: p.updated_at instanceof Date ? p.updated_at.toISOString() : p.updated_at,
            can_edit: authUserId && String(authUserId) === String(p.author_id),
        };
    },
    
    updatePost: async (authorId, postId, postData) => {
        const title = String(postData?.title || '').trim();
        const shortText = postData?.short_text ? String(postData.short_text).trim() : null;
        const text = String(postData?.text || '').trim();
        const topics = normalizeTopics(postData?.post_topics);
    
        if (!title) throw new Error('Post title is required');
        if (!text) throw new Error('Post text is required');
    
        const [ownedRows] = await db.execute(
            `SELECT post_id FROM Posts WHERE post_id = ? AND author_id = ?`,
            [postId, authorId]
        );
    
        if (ownedRows.length === 0) {
            throw new Error('Post not found or you do not have permission to edit it.');
        }
    
        const connection = await db.getConnection();
    
        try {
            await connection.beginTransaction();
    
            await connection.execute(`
                UPDATE Posts
                SET title = ?, short_text = ?, text = ?
                WHERE post_id = ? AND author_id = ?
            `, [title, shortText || null, text, postId, authorId]);
    
            await connection.execute(
                `DELETE FROM Post_Topic_Map WHERE post_id = ?`,
                [postId]
            );
    
            for (const topic of topics) {
                await connection.execute(
                    `INSERT IGNORE INTO Post_Topics (topic_name) VALUES (?)`,
                    [topic]
                );
    
                const [topicRows] = await connection.execute(
                    `SELECT post_topic_id FROM Post_Topics WHERE topic_name = ?`,
                    [topic]
                );
    
                if (topicRows.length > 0) {
                    await connection.execute(`
                        INSERT IGNORE INTO Post_Topic_Map (post_id, topic_id)
                        VALUES (?, ?)
                    `, [postId, topicRows[0].post_topic_id]);
                }
            }
    
            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    
        return await postService.getPost(authorId, postId);
    },
    
    deletePost: async (authorId, postId) => {
        const [ownedRows] = await db.execute(
            `SELECT post_id FROM Posts WHERE post_id = ? AND author_id = ?`,
            [postId, authorId]
        );
    
        if (ownedRows.length === 0) {
            return {
                success: false,
                message: "Post not found or you do not have permission to delete it."
            };
        }
    
        await db.execute(
            `DELETE FROM Posts WHERE post_id = ? AND author_id = ?`,
            [postId, authorId]
        );
    
        return {
            success: true,
            deleted_post_id: postId
        };
    },

    hasLikedPost: async (userId, postId) => {
        const [rows] = await db.execute(
            `SELECT 1 FROM User_Liked_Posts WHERE cognito_sub = ? AND post_id = ? LIMIT 1`,
            [userId, postId]
        );
        return rows.length > 0;
    },
    
    toggleLikePost: async (userId, postId) => {
        const alreadyIn = await postService.hasLikedPost(userId, postId);
    
        if (alreadyIn) {
            await db.execute(
                `DELETE FROM User_Liked_Posts WHERE cognito_sub = ? AND post_id = ?`,
                [userId, postId]
            );
            return { liked: false };
        } else {
            await db.execute(
                `INSERT INTO User_Liked_Posts (cognito_sub, post_id) VALUES (?, ?)`,
                [userId, postId]
            );
            return { liked: true };
        }
    },
    
    getPostMetaBatch: async (authUserId, postIds = []) => {
        if (!postIds.length) {
            return { likeCounts: [], hasLiked: [], commentCounts: [] };
        }
    
        const placeholders = postIds.map(() => '?').join(',');
    
        const [likeRows] = await db.execute(`
            SELECT post_id, COUNT(*) AS like_count
            FROM User_Liked_Posts
            WHERE post_id IN (${placeholders})
            GROUP BY post_id
        `, postIds);
    
        const [commentRows] = await db.execute(`
            SELECT post_id, COUNT(*) AS comment_count
            FROM Post_Comments
            WHERE post_id IN (${placeholders})
            GROUP BY post_id
        `, postIds);
    
        let likedRows = [];
        if (authUserId) {
            const [rows] = await db.execute(`
                SELECT post_id
                FROM User_Liked_Posts
                WHERE cognito_sub = ?
                  AND post_id IN (${placeholders})
            `, [authUserId, ...postIds]);
            likedRows = rows;
        }
    
        const likeMap = new Map(
            likeRows.map(r => [String(r.post_id), Number(r.like_count) || 0])
        );
        const commentMap = new Map(
            commentRows.map(r => [String(r.post_id), Number(r.comment_count) || 0])
        );
        const likedSet = new Set(likedRows.map(r => String(r.post_id)));
    
        return {
            likeCounts: postIds.map(id => likeMap.get(String(id)) || 0),
            hasLiked: postIds.map(id => likedSet.has(String(id))),
            commentCounts: postIds.map(id => commentMap.get(String(id)) || 0),
        };
    },
    
    addCommentToPost: async (userId, postId, text, replyToId = null) => {
        const cleanText = String(text || '').trim();
        if (!cleanText) throw new Error("Comment text is required");
    
        await db.execute(`
            INSERT INTO Post_Comments (cognito_sub, post_id, parent_comment_id, comment_text)
            VALUES (?, ?, ?, ?)
        `, [userId, postId, replyToId ?? null, cleanText]);
    
        return { success: true };
    },
    
    getCommentsForPost: async (postId) => {
        const [rows] = await db.execute(`
            SELECT
                pc.comment_id,
                pc.post_id,
                pc.parent_comment_id,
                pc.comment_text,
                pc.created_at,
                u.cognito_sub AS userId,
                u.name AS userName
            FROM Post_Comments pc
            JOIN Users u ON pc.cognito_sub = u.cognito_sub
            WHERE pc.post_id = ?
            ORDER BY pc.created_at ASC
        `, [postId]);
    
        const map = new Map();
        const roots = [];
    
        rows.forEach((row) => {
            map.set(row.comment_id, {
                id: row.comment_id,
                postId: row.post_id,
                userId: row.userId,
                userName: row.userName,
                text: row.comment_text,
                date: row.created_at instanceof Date
                    ? row.created_at.toISOString()
                    : row.created_at,
                replies: [],
            });
        });
    
        rows.forEach((row) => {
            const node = map.get(row.comment_id);
            if (row.parent_comment_id && map.has(row.parent_comment_id)) {
                map.get(row.parent_comment_id).replies.push(node);
            } else {
                roots.push(node);
            }
        });
    
        return roots;
    },

    getLikedPostsForUser: async (userId) => {
        const [rows] = await db.execute(`
            SELECT
                p.post_id,
                p.author_id,
                p.title,
                p.short_text,
                p.text,
                p.created_at,
                p.updated_at,
                u.name AS author_display_name
            FROM Posts p
            INNER JOIN User_Liked_Posts ulp
                ON p.post_id = ulp.post_id
            LEFT JOIN Users u
                ON p.author_id = u.cognito_sub
            WHERE ulp.cognito_sub = ?
            ORDER BY p.created_at DESC
        `, [userId]);
    
        if (rows.length === 0) return [];
    
        const postIds = rows.map(r => r.post_id);
        const placeholders = postIds.map(() => '?').join(',');
    
        const [topicRows] = await db.execute(`
            SELECT ptm.post_id, pt.topic_name
            FROM Post_Topic_Map ptm
            JOIN Post_Topics pt
                ON ptm.topic_id = pt.post_topic_id
            WHERE ptm.post_id IN (${placeholders})
            ORDER BY pt.topic_name ASC
        `, postIds);
    
        return rows.map((p) => ({
            id: p.post_id,
            author: p.author_id,
            author_display_name: p.author_display_name || '',
            title: p.title,
            short_text: p.short_text,
            text: p.text,
            preview_text: getPreviewText(p),
            post_topics: topicRows
                .filter(r => r.post_id === p.post_id)
                .map(r => r.topic_name),
            created_at: p.created_at instanceof Date
                ? p.created_at.toISOString()
                : p.created_at,
            updated_at: p.updated_at instanceof Date
                ? p.updated_at.toISOString()
                : p.updated_at,
        }));
    },

    editCommentOnPost: async (userId, commentId, text) => {
        const cleanText = String(text || '').trim();
        if (!cleanText) throw new Error("Comment text is required");
    
        const [result] = await db.execute(`
            UPDATE Post_Comments
            SET comment_text = ?
            WHERE comment_id = ? AND cognito_sub = ?
        `, [cleanText, commentId, userId]);
    
        if (result.affectedRows === 0) {
            throw new Error("Unauthorized: You can only edit your own comments, or comment not found.");
        }
    
        return { success: true };
    },

    deleteCommentFromPost: async (userId, commentId) => {
        const [result] = await db.execute(`
            DELETE FROM Post_Comments
            WHERE comment_id = ? AND cognito_sub = ?
        `, [commentId, userId]);
    
        if (result.affectedRows === 0) {
            throw new Error("Unauthorized: You can only delete your own comments, or comment not found.");
        }
    
        return { success: true };
    },
};

export default postService;