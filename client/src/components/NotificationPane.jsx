import { useState, useEffect, useRef } from 'react';
import { notificationAPI, usersAPI } from '../api';
import './NotificationPane.css';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NotificationPane = () => {
    const { isEmployee, user } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('unread'); // 'unread', 'read', 'history'
    const [priorityTab, setPriorityTab] = useState('primary'); // 'primary', 'secondary' - for employee only
    const dropdownRef = useRef(null);
    const navigate = useNavigate();

    // Watchlist state
    const [watchlistOpen, setWatchlistOpen] = useState(false);
    const [allUsers, setAllUsers] = useState([]);
    const [watchedUser, setWatchedUser] = useState(null); // null = watching self
    const [typeFilter, setTypeFilter] = useState('all'); // 'all', 'assignment', 'task_edit', 'team_change', 'chat', 'status_change'
    const watchlistRef = useRef(null);

    const notificationTypes = [
        { value: 'all', label: 'All Types' },
        { value: 'assignment', label: 'Task Assignments' },
        { value: 'task_edit', label: 'Task Updates' },
        { value: 'team_change', label: 'Team Changes' },
        { value: 'chat', label: 'Chat Messages' },
        { value: 'status_change', label: 'Status Changes' }
    ];

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        // Reset priority tab to 'primary' when switching main tabs
        if (tab !== 'history') {
            setPriorityTab('primary');
        }
    };

    const fetchNotifications = async () => {
        try {
            if (notifications.length === 0) setLoading(true);
            const params = {};
            if (watchedUser) params.userId = watchedUser._id;
            if (typeFilter !== 'all') params.type = typeFilter;

            const { data } = await notificationAPI.getAll(params);
            setNotifications(data.notifications || []);
        } catch (error) {
            console.error("Failed to fetch notifications", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        try {
            const { data } = await usersAPI.getAll();
            setAllUsers(data.users || []);
        } catch (error) {
            console.error("Failed to fetch users", error);
        }
    };

    useEffect(() => {
        fetchNotifications();
        fetchUsers();
        const interval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(interval);
    }, []);

    // Refetch when watched user or type filter changes
    useEffect(() => {
        fetchNotifications();
    }, [watchedUser, typeFilter]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
            if (watchlistRef.current && !watchlistRef.current.contains(event.target)) {
                setWatchlistOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleMarkAllRead = async (e) => {
        e.stopPropagation();
        // Only allow marking all read for own notifications
        if (watchedUser) return;
        try {
            await notificationAPI.markAllRead();
            setNotifications(prev => prev.map(n => ({
                ...n,
                isRead: true,
                readAt: new Date().toISOString()
            })));
        } catch (error) {
            console.error("Failed to mark all read", error);
        }
    };

    const toggleReadStatus = async (n, e) => {
        e.stopPropagation();
        // Only allow toggling for own notifications
        if (watchedUser) return;
        try {
            const newStatus = !n.isRead;
            if (newStatus) {
                await notificationAPI.markRead(n._id);
            } else {
                await notificationAPI.markUnread(n._id);
            }

            setNotifications(prev => prev.map(item =>
                item._id === n._id ? {
                    ...item,
                    isRead: newStatus,
                    readAt: newStatus ? new Date().toISOString() : null
                } : item
            ));
        } catch (err) {
            console.error("Failed to toggle status", err);
        }
    };

    const handleContentClick = (n) => {
        setIsOpen(false);
        if (n.task) {
            navigate(`/tasks/${n.task}`);
        }
    };

    const getCategoryIcon = (category) => {
        const iconMap = {
            chat: 'fa-comment',
            task_edit: 'fa-edit',
            team_change: 'fa-users',
            status_change: 'fa-sync-alt',
            assignment: 'fa-tasks'
        };
        return iconMap[category] || 'fa-info-circle';
    };

    const handleSelectUser = (selectedUser) => {
        if (selectedUser._id === user?.id) {
            setWatchedUser(null); // Watching self
        } else {
            setWatchedUser(selectedUser);
        }
        setWatchlistOpen(false);
    };

    const handleClearWatchlist = () => {
        setWatchedUser(null);
        setTypeFilter('all');
        setWatchlistOpen(false);
    };

    const unreadCount = notifications.filter(n => !n.isRead).length;

    const getFilteredNotifications = () => {
        let filtered;
        switch (activeTab) {
            case 'unread':
                filtered = notifications.filter(n => !n.isRead);
                break;
            case 'read':
                filtered = notifications.filter(n => n.isRead);
                break;
            case 'history':
                filtered = notifications;
                break;
            default:
                filtered = [];
        }

        // Further filter by priority for employees when not in history tab (only for own notifications)
        if (isEmployee && activeTab !== 'history' && !watchedUser) {
            if (priorityTab === 'primary') {
                filtered = filtered.filter(n => n.priority === 'primary' || !n.priority);
            } else if (priorityTab === 'secondary') {
                filtered = filtered.filter(n => n.priority === 'secondary');
            }
        }

        return filtered;
    };

    const groupByPriority = (notifs) => {
        const primary = notifs.filter(n => n.priority === 'primary' || !n.priority);
        const secondary = notifs.filter(n => n.priority === 'secondary');
        return { primary, secondary };
    };

    const filteredNotifications = getFilteredNotifications();
    const { primary, secondary } = activeTab !== 'history'
        ? groupByPriority(filteredNotifications)
        : { primary: [], secondary: [] };

    const renderNotificationItem = (n) => (
        <div
            key={n._id}
            className={`notification-item ${!n.isRead ? 'unread' : ''} ${n.priority === 'secondary' ? 'secondary' : ''}`}
        >
            <div className="notification-icon">
                <i className={`fas ${getCategoryIcon(n.category)}`}></i>
            </div>
            <div className="notification-content">
                <p onClick={() => handleContentClick(n)}>{n.message}</p>
                <span className="notification-time">
                    {new Date(n.createdAt).toLocaleString()}
                </span>
                {activeTab === 'history' && n.isRead && n.readAt && (
                    <span className="history-meta">
                        Seen: {new Date(n.readAt).toLocaleString()}
                    </span>
                )}
            </div>
            {!watchedUser && (
                <div className="notification-actions">
                    <button
                        className="icon-btn"
                        title={n.isRead ? "Mark as Unread" : "Mark as Read"}
                        onClick={(e) => toggleReadStatus(n, e)}
                    >
                        <i className={`fas ${n.isRead ? 'fa-envelope-open' : 'fa-envelope'}`}></i>
                    </button>
                </div>
            )}
        </div>
    );

    return (
        <div className="notification-area">
            {/* Watchlist Button */}
            <div className="watchlist-wrapper" ref={watchlistRef}>
                <button
                    className={`watchlist-btn ${watchedUser ? 'active' : ''}`}
                    onClick={() => setWatchlistOpen(!watchlistOpen)}
                    title="Watch another user's notifications"
                >
                    <i className="fas fa-eye"></i>
                    {watchedUser && <span className="watchlist-indicator"></span>}
                </button>

                {watchlistOpen && (
                    <div className="watchlist-dropdown">
                        <div className="watchlist-header">
                            <h4>Watchlist</h4>
                            {watchedUser && (
                                <button className="clear-watchlist-btn" onClick={handleClearWatchlist}>
                                    Clear
                                </button>
                            )}
                        </div>

                        {/* Type Filter */}
                        <div className="watchlist-filter">
                            <label>Filter by Type:</label>
                            <select
                                value={typeFilter}
                                onChange={(e) => setTypeFilter(e.target.value)}
                            >
                                {notificationTypes.map(t => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* User List */}
                        <div className="watchlist-users">
                            <div
                                className={`watchlist-user-item ${!watchedUser ? 'active' : ''}`}
                                onClick={handleClearWatchlist}
                            >
                                <span className="user-avatar">Me</span>
                                <span className="user-name">My Notifications</span>
                            </div>
                            {allUsers
                                .filter(u => u._id !== user?.id)
                                .map(u => (
                                    <div
                                        key={u._id}
                                        className={`watchlist-user-item ${watchedUser?._id === u._id ? 'active' : ''}`}
                                        onClick={() => handleSelectUser(u)}
                                    >
                                        <span className="user-avatar">{u.name?.[0]?.toUpperCase() || u.email?.[0]?.toUpperCase()}</span>
                                        <div className="user-info">
                                            <span className="user-name">{u.name || u.email.split('@')[0]}</span>
                                            <span className="user-role">{u.role}</span>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Notification Button */}
            <div className="notification-wrapper" ref={dropdownRef}>
                <button
                    className="notification-btn"
                    onClick={() => setIsOpen(!isOpen)}
                    title="Notifications"
                >
                    <i className="fas fa-bell"></i>
                    {unreadCount > 0 && !watchedUser && (
                        <span className="notification-badge">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </button>

                {isOpen && (
                    <div className="notification-dropdown">
                        {/* Watching banner */}
                        {watchedUser && (
                            <div className="watching-banner">
                                <i className="fas fa-eye"></i>
                                Watching: <strong>{watchedUser.name || watchedUser.email}</strong>
                            </div>
                        )}

                        <div className="notification-tabs">
                            <button
                                className={`tab-btn ${activeTab === 'unread' ? 'active' : ''}`}
                                onClick={() => handleTabChange('unread')}
                            >
                                Unread ({unreadCount})
                            </button>
                            <button
                                className={`tab-btn ${activeTab === 'read' ? 'active' : ''}`}
                                onClick={() => handleTabChange('read')}
                            >
                                Read
                            </button>
                            <button
                                className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                                onClick={() => handleTabChange('history')}
                            >
                                History
                            </button>
                        </div>

                        {/* Priority Sub-Tabs - Employee Only in Unread/Read, only for own notifications */}
                        {isEmployee && activeTab !== 'history' && !watchedUser && (
                            <div className="notification-tabs priority-tabs">
                                <button
                                    className={`tab-btn ${priorityTab === 'primary' ? 'active' : ''}`}
                                    onClick={() => setPriorityTab('primary')}
                                >
                                    Primary
                                </button>
                                <button
                                    className={`tab-btn ${priorityTab === 'secondary' ? 'active' : ''}`}
                                    onClick={() => setPriorityTab('secondary')}
                                >
                                    Secondary
                                </button>
                            </div>
                        )}

                        {activeTab === 'unread' && unreadCount > 0 && !watchedUser && (
                            <button className="mark-read-btn" onClick={handleMarkAllRead}>
                                Mark all as read
                            </button>
                        )}


                        <div className="notification-list">
                            {loading && notifications.length === 0 ? (
                                <div className="notification-empty">Loading...</div>
                            ) : filteredNotifications.length > 0 ? (
                                filteredNotifications.map(renderNotificationItem)
                            ) : (
                                <div className="notification-empty">
                                    <i className="far fa-bell-slash"></i>
                                    <p>No notifications</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NotificationPane;