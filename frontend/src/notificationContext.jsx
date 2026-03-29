import { createContext, useContext, useState, useCallback, useMemo } from 'react';

// 1. THE BRIDGE: A plain object accessible outside of React
export const notificationApi = {
    update: () => {
        // Initial placeholder to avoid errors before React mounts
        console.warn("notificationApi.update called before Provider was initialized.");
    }
};

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
    const [notifications, setNotifications] = useState([]);

    // The logic to update notifications
    const updateNotifications = useCallback((newNotifications) => {
        if (!Array.isArray(newNotifications)) return;
        setNotifications(newNotifications);
    }, []);

    // 2. THE LINK: Connect the React state-setter to our plain object
    // This happens every time the Provider renders.
    notificationApi.update = updateNotifications;

    const unreadCount = useMemo(() => 
        notifications.filter(n => !n.read).length, 
    [notifications]);

    const markLocalAsRead = useCallback((id) => {
        setNotifications(prev => 
            prev.map(n => n.notification_id === id ? { ...n, read: true } : n)
        );
    }, []);

    const value = {
        notifications,
        unreadCount,
        updateNotifications,
        markLocalAsRead
    };

    return (
        <NotificationContext.Provider value={value}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error("useNotifications must be used within a NotificationProvider");
    }
    return context;
};