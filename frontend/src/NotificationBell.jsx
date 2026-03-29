import { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from "./notificationContext";
import { useNavigate } from 'react-router-dom';
import './NotificationBell.css';
import { markNotificationRead } from './Controller';

const NotificationBell = ({ user }) => {
    // These come from your Global Context now
    const { notifications, unreadCount, markLocalAsRead } = useNotifications();
    
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);
    const navigate = useNavigate();

    // Click outside logic (unchanged)
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        if (isOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const handleNotificationClick = async (notification) => {
        if (!notification.read) {
            // Call your actual backend markAsRead endpoint
            await markNotificationRead(notification.notification_id);
            
            // Update the global state immediately so the dot vanishes
            markLocalAsRead(notification.notification_id);
        }
        
        setIsOpen(false);

        // Navigation logic using your new SQL fields
        if (notification.project_id) {
            navigate(`/projects/${notification.project_id}`);
        } else if (notification.application_id) {
            navigate(`/applications/${notification.application_id}`);
        }
    };

    const getTimeAgo = (timestamp) => {
        const now = new Date();
        const notificationTime = new Date(timestamp);
        const diffInMs = now - notificationTime;
        const diffInMins = Math.floor(diffInMs / 60000);
        const diffInHours = Math.floor(diffInMins / 60);
        const diffInDays = Math.floor(diffInHours / 24);

        if (diffInMins < 1) return 'just now';
        if (diffInMins < 60) return `${diffInMins}m ago`;
        if (diffInHours < 24) return `${diffInHours}h ago`;
        if (diffInDays < 7) return `${diffInDays}d ago`;
        return notificationTime.toLocaleDateString();
    };

    const getNotificationIcon = (type) => {
        switch (type) {
            case 'project_application': return '👤';
            case 'project_like': return '❤️';
            case 'application_accepted': return '🤝'; // Updated to match your SQL ENUM
            case 'application_rejected': return '❌'; // Updated to match your SQL ENUM
            case 'system': return '⚙️';
            default: return '🔔';
        }
    };

    if (!user) return null;

    return (
        <div className="notification-bell-container" ref={dropdownRef}>
            <button
                className="notification-bell-button"
                onClick={() => setIsOpen(!isOpen)}
                aria-label="Notifications"
            >
                <Bell size={18} />
                {unreadCount > 0 && (
                    <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
            </button>

            {isOpen && (
                <div className="notification-dropdown">
                    <div className="notification-header">
                        <h3>Notifications</h3>
                        {unreadCount > 0 && (
                            <span className="unread-count">{unreadCount} new</span>
                        )}
                    </div>

                    <div className="notification-list">
                        {notifications.length === 0 ? (
                            <div className="notification-empty">
                                <span>No notifications yet</span>
                            </div>
                        ) : (
                            notifications.map((notification) => (
                                <div
                                    key={notification.notification_id}
                                    className={`notification-item ${!notification.read ? 'unread' : ''}`}
                                    onClick={() => handleNotificationClick(notification)}
                                >
                                    <div className="notification-icon">
                                        {getNotificationIcon(notification.type)}
                                    </div>
                                    <div className="notification-content">
                                        <p className="notification-message">{notification.message}</p>
                                        <span className="notification-time">
                                            {getTimeAgo(notification.created_at)}
                                        </span>
                                    </div>
                                    {!notification.read && <div className="unread-dot"></div>}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationBell;