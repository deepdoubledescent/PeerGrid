import db from '../db.js';

const notificationService = {
    getNotifications: async (sub) => {
        const query = `
            SELECT 
                notification_id, 
                created_at, 
                is_read AS 'read', 
                notification_type AS type, 
                message, 
                origin_id, 
                project_id 
            FROM Notifications 
            WHERE cognito_sub = ? 
            ORDER BY created_at DESC
        `;
        
        // Unpacking the first element (rows) from the db.execute array
        const [rows] = await db.execute(query, [sub]);
        return rows;
    },

    getUnreadNotifications: async (sub) => {
        const query = `
            SELECT 
                notification_id, 
                created_at, 
                is_read AS 'read', 
                notification_type AS type, 
                message, 
                origin_id, 
                project_id 
            FROM Notifications 
            WHERE cognito_sub = ? AND is_read = 0
            ORDER BY created_at DESC
        `;
        
        const [rows] = await db.execute(query, [sub]);
        return rows;
    },

    markAsRead: async (sub, notificationId) => {
        const query = `
            UPDATE Notifications 
            SET is_read = 1 
            WHERE notification_id = ? AND cognito_sub = ?
        `;
        
        const [result] = await db.execute(query, [notificationId, sub]);
        
        // result.affectedRows will be 1 if updated, 0 if ID mismatch or already read
        return result.affectedRows > 0;
    },

    markAllAsRead: async (sub) => {
        const query = `
            UPDATE Notifications 
            SET is_read = 1 
            WHERE cognito_sub = ? AND is_read = 0
        `;
        
        const [result] = await db.execute(query, [sub]);
        return result.affectedRows; // Returns how many notifications were cleared
    },

    addNotification: async ({ 
        sub, 
        originId, 
        type, 
        message, 
        projectId = null, 
        applicationId = null 
    }) => {
        try {
            // 1. Check for an existing unread notification of the same type/origin
            // This prevents "Like/Unlike" spam.
            const checkQuery = `
                SELECT notification_id FROM Notifications 
                WHERE cognito_sub = ? 
                AND origin_id = ? 
                AND notification_type = ? 
                AND is_read = 0
                ${projectId ? 'AND project_id = ?' : 'AND project_id IS NULL'}
                LIMIT 1
            `;
            
            const checkParams = [sub, originId, type];
            if (projectId) checkParams.push(projectId);

            const [existing] = await db.execute(checkQuery, checkParams);

            if (existing.length > 0) {
                // 2. BUMP: If it exists and is unread, just update the timestamp
                // This brings the notification back to the top of the user's list.
                const updateQuery = `
                    UPDATE Notifications 
                    SET created_at = CURRENT_TIMESTAMP, message = ?
                    WHERE notification_id = ?
                `;
                await db.execute(updateQuery, [message, existing[0].notification_id]);
                return existing[0].notification_id;
            }

            // 3. CREATE: If no unread duplicate exists, insert a new one
            const insertQuery = `
                INSERT INTO Notifications (
                    cognito_sub, origin_id, notification_type, 
                    message, project_id, application_id
                ) VALUES (?, ?, ?, ?, ?, ?)
            `;
            const [result] = await db.execute(insertQuery, [
                sub, originId, type, message, projectId, applicationId
            ]);

            return result.insertId;

        } catch (error) {
            // SILENT FAIL: Log the error for you, but don't throw it.
            // This ensures the user's "Like" or "Apply" still finishes successfully.
            console.error("CRITICAL: Notification failed to send:", error);
            return null; 
        }
    }
};

export default notificationService;