import db from '../db.js';

const generalService = {

    getCommentsForPaper: async (work_id) => {
        const query = `
            SELECT 
                c.comment_id as id,
                c.cognito_sub as userId,
                u.name as userName,
                i.institution_name as userInst,
                c.comment_text as text,
                c.date_created,
                c.time_created,
                c.parent_comment_id
            FROM User_Comments c
            JOIN Users u ON c.cognito_sub = u.cognito_sub
            LEFT JOIN Institutions i ON u.institution_id = i.institution_id
            WHERE c.paper_id = ?
            ORDER BY c.date_created ASC, c.time_created ASC
        `;
        
        const [rows] = await db.execute(query, [work_id]);
    
        const commentMap = {};
        const roots = [];
    
        // First pass: Create objects and format dates
        rows.forEach(row => {
            // Format date/time into a single string: "YYYY-MM-DD HH:MM:SS"
            const formattedDate = `${row.date_created.toISOString().split('T')[0]} ${row.time_created}`;
    
            commentMap[row.id] = {
                id: row.id,
                userId: row.userId,
                userName: row.userName,
                userInst: row.userInst || "Independent Researcher",
                date: formattedDate,
                text: row.text,
                replies: []
            };
        });
    
        // Second pass: Link children to parents
        rows.forEach(row => {
            if (row.parent_comment_id && commentMap[row.parent_comment_id]) {
                commentMap[row.parent_comment_id].replies.push(commentMap[row.id]);
            } else if (!row.parent_comment_id) {
                roots.push(commentMap[row.id]);
            }
        });
    
        return roots;
    },

    getPaperMetaBatch: async (userId, paperIds) => {
        // 1. Guard clause for empty input
        if (!paperIds || paperIds.length === 0) {
            return { likeCounts: [], hasLiked: [], commentCounts: [] };
        }
    
        const authId = userId ?? null;
    
        // 2. Fetch Aggregations (Independent of user status)
        const [likeRows] = await db.query(
            `SELECT paper_id, COUNT(*) as count FROM User_Liked_Papers WHERE paper_id IN (?) GROUP BY paper_id`,
            [paperIds]
        );
    
        const [commentRows] = await db.query(
            `SELECT paper_id, COUNT(*) as count FROM User_Comments WHERE paper_id IN (?) GROUP BY paper_id`,
            [paperIds]
        );
    
        // 3. Fetch User-Specific Data (Only if logged in)
        let userLikeSet = new Set();
        if (authId) {
            const [userLikes] = await db.query(
                `SELECT paper_id FROM User_Liked_Papers WHERE cognito_sub = ? AND paper_id IN (?)`,
                [authId, paperIds]
            );
            userLikeSet = new Set(userLikes.map(r => r.paper_id));
        }
    
        // 4. Create lookup maps for O(1) efficiency
        const likeMap = new Map(likeRows.map(r => [r.paper_id, r.count]));
        const commentMap = new Map(commentRows.map(r => [r.paper_id, r.count]));
    
        // 5. Build the ordered arrays
        return {
            likeCounts: paperIds.map(id => likeMap.get(id) || 0),
            hasLiked: paperIds.map(id => userLikeSet.has(id)), // Correctly returns false if userLikeSet is empty
            commentCounts: paperIds.map(id => commentMap.get(id) || 0)
        };
    },

    getWorkTypes: async () => {
        const [rows] = await db.execute(`
            SELECT openalex_id AS id, display_name AS label
            FROM OpenAlex_Work_Types
            ORDER BY display_name ASC
        `);
        return rows;
    },

    getSubtopics: async (query = '', topicId = null) => {
        const normalized = `%${String(query || '').trim().toLowerCase()}%`;
    
        if (topicId) {
            const [rows] = await db.execute(`
                SELECT DISTINCT
                    s.openalex_id AS id,
                    s.display_name AS label
                FROM OpenAlex_Subtopics s
                JOIN OpenAlex_Topics t
                  ON t.subtopic_openalex_id = s.openalex_id
                WHERE t.openalex_id = ?
                  AND LOWER(s.display_name) LIKE ?
                ORDER BY s.display_name ASC
                LIMIT 50
            `, [topicId, normalized]);
    
            return rows;
        }
    
        const [rows] = await db.execute(`
            SELECT
                openalex_id AS id,
                display_name AS label
            FROM OpenAlex_Subtopics
            WHERE LOWER(display_name) LIKE ?
            ORDER BY display_name ASC
            LIMIT 50
        `, [normalized]);
    
        return rows;
    },


    getTopics: async (subtopicId = null, query = '') => {
        const normalized = `%${String(query || '').trim().toLowerCase()}%`;
    
        if (subtopicId) {
            const [rows] = await db.execute(`
                SELECT
                    openalex_id AS id,
                    display_name AS label
                FROM OpenAlex_Topics
                WHERE subtopic_openalex_id = ?
                  AND LOWER(display_name) LIKE ?
                ORDER BY display_name ASC
                LIMIT 100
            `, [subtopicId, normalized]);
    
            return rows;
        }
    
        const [rows] = await db.execute(`
            SELECT
                openalex_id AS id,
                display_name AS label
            FROM OpenAlex_Topics
            WHERE LOWER(display_name) LIKE ?
            ORDER BY display_name ASC
            LIMIT 100
        `, [normalized]);
    
        return rows;
    },

    getTopicSiblings: async (topicId) => {
        const [rows] = await db.execute(`
            SELECT
                t.openalex_id AS id,
                t.display_name AS label
            FROM OpenAlex_Topic_Siblings s
            JOIN OpenAlex_Topics t
              ON s.sibling_openalex_id = t.openalex_id
            WHERE s.topic_openalex_id = ?
            ORDER BY t.display_name ASC
        `, [topicId]);
    
        return rows;
    },

};

export default generalService;