import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { notificationAPI, watchlistAPI, usersAPI } from '../api';
import './NotificationPane.css';
import { getImageUrl } from '../utils/imageUtils';

const notificationTypes = [
    { value: 'all', label: 'All Types' },
    { value: 'assignment', label: 'Task Assignments' },
    { value: 'task_edit', label: 'Task Updates' },
    { value: 'team_change', label: 'Team Changes' },
    { value: 'chat', label: 'Chat Messages' },
    { value: 'status_change', label: 'Status Changes' }
];

const NotificationPane = () => {
    const { isEmployee, user } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('unread');
    const [priorityTab, setPriorityTab] = useState('primary');
    const dropdownRef = useRef(null);
    const navigate = useNavigate();

    // Watchlist state
    const [watchlistOpen, setWatchlistOpen] = useState(false);
    const [allUsers, setAllUsers] = useState([]);
    const [myWatchers, setMyWatchers] = useState([]); // Users I've granted access to
    const [canWatchUsers, setCanWatchUsers] = useState([]); // Users who granted me access
    const [watchedUser, setWatchedUser] = useState(null);
    const [typeFilter, setTypeFilter] = useState('all');
    const watchlistRef = useRef(null);

    // User config popup state
    const [configUser, setConfigUser] = useState(null);
    const [configTypes, setConfigTypes] = useState(['all']);
    const [saving, setSaving] = useState(false);

    // Watched user notifications (displayed inside watchlist panel)
    const [watchedNotifications, setWatchedNotifications] = useState([]);
    const [loadingWatched, setLoadingWatched] = useState(false);

    // Pagination state
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        if (tab !== 'history') {
            setPriorityTab('primary');
        }
    };

    const fetchNotifications = async (pageNum = 1, isLoadMore = false) => {
        if (loading) return; // Prevent multiple calls

        try {
            setLoading(true);
            const params = { page: pageNum, limit: 10 };
            if (watchedUser) params.userId = watchedUser.ownerId;
            if (typeFilter !== 'all') params.type = typeFilter;

            const { data } = await notificationAPI.getAll(params);

            if (isLoadMore) {
                setNotifications(prev => {
                    // Filter out duplicates based on _id
                    const newNotifs = data.notifications.filter(
                        newN => !prev.some(existingN => existingN._id === newN._id)
                    );
                    return [...prev, ...newNotifs];
                });
            } else {
                setNotifications(data.notifications || []);
            }

            setHasMore(data.hasMore);
            if (pageNum === 1) setPage(1);
            else setPage(pageNum);

        } catch (error) {
            console.error("Failed to fetch notifications", error);
            if (error.response?.status === 403) {
                setWatchedUser(null);
            }
        } finally {
            setLoading(false);
        }
    };

    const fetchAllData = async () => {
        try {
            const [usersRes, settingsRes, canWatchRes] = await Promise.all([
                usersAPI.getAll(),
                watchlistAPI.getMySettings(),
                watchlistAPI.getWhoICanWatch()
            ]);
            console.log("[DEBUG] All users:", usersRes.data.users?.length);
            console.log("[DEBUG] My watchers:", settingsRes.data.watchers);
            console.log("[DEBUG] Can watch users:", canWatchRes.data.canWatch);
            setAllUsers(usersRes.data.users || []);
            setMyWatchers(settingsRes.data.watchers || []);
            setCanWatchUsers(canWatchRes.data.canWatch || []);
        } catch (error) {
            console.error("Failed to fetch data", error);
        }
    };

    useEffect(() => {
        fetchNotifications(1);
        fetchAllData();
        const interval = setInterval(() => {
            // Only poll page 1 if we haven't loaded more pages to avoid overwriting scroll state
            if (page === 1) fetchNotifications(1);
        }, 30000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        setNotifications([]); // Clear old notifications immediately when context changes
        setPage(1);
        setHasMore(true);
        fetchNotifications(1);
    }, [watchedUser, typeFilter]);

    // [MANUAL PAGINATION] Handler to load next batch
    const handleLoadMore = () => {
        if (hasMore && !loading) {
            fetchNotifications(page + 1, true);
        }
    };

    // [MANUAL PAGINATION] Handler to remove last batch
    const handleShowLess = () => {
        if (page > 1) {
            // Revert to previous page count (e.g. 18 -> 10, 30 -> 20)
            const targetCount = (page - 1) * 10;
            setNotifications(prev => prev.slice(0, targetCount));
            setPage(prev => prev - 1);
            setHasMore(true);
        }
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
            if (watchlistRef.current && !watchlistRef.current.contains(event.target)) {
                setWatchlistOpen(false);
                setConfigUser(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleMarkAllRead = async (e) => {
        e.stopPropagation();
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

    // Check if a user is in my watchlist
    const isUserInMyWatchlist = (userId) => {
        return myWatchers.some(w => w.userId === userId || w.userId?.toString() === userId);
    };

    // Get watcher config for a user
    const getWatcherConfig = (userId) => {
        return myWatchers.find(w => w.userId === userId || w.userId?.toString() === userId);
    };

    // When user clicks on a member to configure
    const handleUserClick = (clickedUser) => {
        const existing = getWatcherConfig(clickedUser._id);
        setConfigUser(clickedUser);
        setConfigTypes(existing?.allowedTypes || ['all']);
    };

    // Toggle type in config
    const handleTypeToggle = (type) => {
        let newTypes = [...configTypes];

        if (type === 'all') {
            newTypes = newTypes.includes('all') ? [] : ['all'];
        } else {
            newTypes = newTypes.filter(t => t !== 'all');
            if (newTypes.includes(type)) {
                newTypes = newTypes.filter(t => t !== type);
            } else {
                newTypes.push(type);
            }
            if (newTypes.length === 5) {
                newTypes = ['all'];
            }
        }

        if (newTypes.length === 0) {
            newTypes = ['all'];
        }

        setConfigTypes(newTypes);
    };

    // Save watcher config
    const handleSaveWatcher = async () => {
        if (!configUser) return;
        setSaving(true);
        try {
            const newWatchers = myWatchers.filter(w =>
                w.userId !== configUser._id && w.userId?.toString() !== configUser._id
            );
            newWatchers.push({
                userId: configUser._id,
                allowedTypes: configTypes
            });

            await watchlistAPI.update(newWatchers);
            await fetchAllData();
            setConfigUser(null);
        } catch (err) {
            console.error("Failed to save watcher", err);
        } finally {
            setSaving(false);
        }
    };

    // Remove from watchlist
    const handleRemoveWatcher = async () => {
        if (!configUser) return;
        setSaving(true);
        try {
            const newWatchers = myWatchers.filter(w =>
                w.userId !== configUser._id && w.userId?.toString() !== configUser._id
            );
            await watchlistAPI.update(newWatchers);
            await fetchAllData();
            setConfigUser(null);
        } catch (err) {
            console.error("Failed to remove watcher", err);
        } finally {
            setSaving(false);
        }
    };

    const handleClearWatchlist = () => {
        setWatchedUser(null);
        setWatchedNotifications([]);
        setTypeFilter('all');
    };

    const handleSelectWatchedUser = async (selectedUser) => {
        setWatchedUser(selectedUser);
        setLoadingWatched(true);
        try {
            const { data } = await notificationAPI.getAll({ userId: selectedUser.ownerId });
            setWatchedNotifications(data.notifications || []);
        } catch (error) {
            console.error("Failed to fetch watched user notifications", error);
            setWatchedNotifications([]);
        } finally {
            setLoadingWatched(false);
        }
    };

    const getWatchedUserAllowedTypes = () => {
        if (!watchedUser) return notificationTypes;
        const hasAll = watchedUser.allowedTypes?.includes('all');
        if (hasAll) return notificationTypes;
        return notificationTypes.filter(t =>
            t.value === 'all' || watchedUser.allowedTypes?.includes(t.value)
        );
    };

    const renderNotificationItem = (n) => {
        const isUnread = activeTab === 'unread' || (!n.isRead && activeTab === 'history');
        const formattedDate = new Date(n.createdAt).toLocaleDateString();
        const formattedTime = new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        return (
            <div
                key={n._id}
                className={`notification-item ${isUnread ? 'unread' : ''}`}
                onClick={() => handleContentClick(n)}
            >
                <div className="notif-icon-wrapper">
                    <i className={`fas ${getCategoryIcon(n.type)}`}></i>
                </div>
                <div className="notif-content">
                    <p className="notif-message">{n.message}</p>
                    <span className="notif-time">{formattedDate} • {formattedTime}</span>
                </div>
                {!watchedUser && (activeTab === 'unread' || activeTab === 'read') && (
                    <button
                        className="mark-action-btn"
                        onClick={(e) => toggleReadStatus(n, e)}
                        title={n.isRead ? "Mark as unread" : "Mark as read"}
                    >
                        <i className={`fas ${n.isRead ? 'fa-envelope' : 'fa-check'}`}></i>
                    </button>
                )}
            </div>
        );
    };

    const filteredNotifications = notifications.filter(n => {
        if (watchedUser) return true; // Show all for watched users
        if (activeTab === 'history') return true;

        // Filter by read/unread
        const matchesReadStatus = activeTab === 'read' ? n.isRead : !n.isRead;
        if (!matchesReadStatus) return false;

        // Filter by priority
        if (isEmployee) {
            return priorityTab === 'primary' ? n.priority === 'primary' : n.priority === 'secondary';
        }

        return true;
    });

    const unreadCount = notifications.filter(n => !n.isRead).length;

    const allowedTypes = getWatchedUserAllowedTypes();

    return (
        <div className="notification-container">
            {/* Watchlist Wrapper */}
            <div className="watchlist-wrapper">
                {/* Watchlist Toggle Button */}
                {!watchedUser && (
                    <button
                        className={`watchlist-toggle-btn ${watchlistOpen ? 'active' : ''}`}
                        onClick={() => setWatchlistOpen(!watchlistOpen)}
                        title="Manage Watchlist"
                    >
                        <i className="fas fa-eye"></i>
                    </button>
                )}

                {/* Watchlist Dropdown */}
                {watchlistOpen && (
                    <div className="watchlist-dropdown" ref={watchlistRef}>
                        {configUser ? (
                            <div className="watchlist-config">
                                <div className="config-header">
                                    <button className="back-btn" onClick={() => setConfigUser(null)}>
                                        <i className="fas fa-arrow-left"></i>
                                    </button>
                                    <span>Configure Access</span>
                                </div>

                                <div className="config-user-info">
                                    {configUser.profilePicture ? (
                                        <img src={getImageUrl(configUser.profilePicture)} alt="Avatar" className="user-avatar-img large" style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }} />
                                    ) : (
                                        <span className="user-avatar large">{configUser.name?.[0]?.toUpperCase()}</span>
                                    )}
                                    <div className="user-details">
                                        <span className="name">{configUser.name || configUser.email}</span>
                                        <span className="email">{configUser.email}</span>
                                    </div>
                                </div>

                                <div className="config-types">
                                    <h5>Allowed Notification Types:</h5>
                                    {notificationTypes.map(type => (
                                        <label key={type.value} className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={configTypes.includes(type.value)}
                                                onChange={() => handleTypeToggle(type.value)}
                                            />
                                            {type.label}
                                        </label>
                                    ))}
                                </div>

                                <div className="config-actions">
                                    <button className="btn-save" onClick={handleSaveWatcher} disabled={saving}>
                                        {saving ? 'Saving...' : 'Save Access'}
                                    </button>
                                    <button className="btn-remove" onClick={handleRemoveWatcher} disabled={saving}>
                                        Remove Access
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="watchlist-header">
                                    <h4>Watchlist</h4>
                                </div>

                                {/* Section: View Others' Notifications */}
                                {canWatchUsers.length > 0 && (
                                    <div className="watchlist-section">
                                        <div className="section-header">
                                            <i className="fas fa-eye"></i> You Can View
                                        </div>
                                        {canWatchUsers.map(u => (
                                            <div
                                                key={u.ownerId}
                                                className="watchlist-user-item"
                                                onClick={() => handleSelectWatchedUser(u)}
                                            >
                                                {u.profilePicture ? (
                                                    <img src={getImageUrl(u.profilePicture)} alt="Avatar" className="user-avatar-img" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                                                ) : (
                                                    <span className="user-avatar">{u.name?.[0]?.toUpperCase() || u.email?.[0]?.toUpperCase()}</span>
                                                )}
                                                <div className="user-info">
                                                    <span className="user-name">{u.name || u.email}</span>
                                                    <span className="user-role">{u.role}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Section: Grant Access to Others */}
                                <div className="watchlist-section">
                                    <div className="section-header">
                                        <i className="fas fa-user-plus"></i> Grant Access (click to configure)
                                    </div>
                                    <div className="watchlist-users">
                                        {allUsers
                                            .filter(u => u._id !== user?.id)
                                            .map(u => (
                                                <div
                                                    key={u._id}
                                                    className={`watchlist-user-item ${isUserInMyWatchlist(u._id) ? 'granted' : ''}`}
                                                    onClick={() => handleUserClick(u)}
                                                >
                                                    {u.profilePicture ? (
                                                        <img src={getImageUrl(u.profilePicture)} alt="Avatar" className="user-avatar-img" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                                                    ) : (
                                                        <span className="user-avatar">{u.name?.[0]?.toUpperCase() || u.email?.[0]?.toUpperCase()}</span>
                                                    )}
                                                    <div className="user-info">
                                                        <span className="user-name">{u.name || u.email}</span>
                                                        <span className="user-role">{u.role}</span>
                                                        {isUserInMyWatchlist(u._id) && (
                                                            <span className="access-badge">
                                                                <i className="fas fa-check"></i> Access Granted
                                                            </span>
                                                        )}
                                                    </div>
                                                    <i className="fas fa-chevron-right config-arrow"></i>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            </>
                        )}
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

                        <div
                            className="notification-list"
                        >
                            {loading && page === 1 && notifications.length === 0 ? (
                                <div className="notification-empty">Loading...</div>
                            ) : filteredNotifications.length > 0 ? (
                                <>
                                    {filteredNotifications.map(renderNotificationItem)}

                                    {/* Manual Pagination Controls */}
                                    <div style={{ display: 'flex', gap: '10px', padding: '10px', justifyContent: 'center' }}>
                                        {page > 1 && (
                                            <button
                                                onClick={handleShowLess}
                                                style={{
                                                    padding: '6px 12px',
                                                    borderRadius: '6px',
                                                    border: '1px solid #e5e7eb',
                                                    background: 'var(--bg-color, #fff)',
                                                    cursor: 'pointer',
                                                    fontSize: '0.8rem',
                                                    color: 'var(--text-primary, #374151)'
                                                }}
                                            >
                                                ⬆️ Show Less
                                            </button>
                                        )}

                                        {hasMore && (
                                            <button
                                                onClick={handleLoadMore}
                                                disabled={loading}
                                                style={{
                                                    padding: '6px 12px',
                                                    borderRadius: '6px',
                                                    border: 'none',
                                                    background: 'var(--primary-color, #4f46e5)',
                                                    color: 'white',
                                                    cursor: loading ? 'wait' : 'pointer',
                                                    fontSize: '0.8rem'
                                                }}
                                            >
                                                {loading ? 'Loading...' : '⬇️ Load 10 More'}
                                            </button>
                                        )}
                                    </div>
                                </>
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
        </div >
    );
}

export default NotificationPane;