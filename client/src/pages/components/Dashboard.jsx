import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { dashboardAPI } from '../../api';
import Navbar from '../../components/Navbar';
import '../styles/Dashboard.css';
import SpotlightCard from '../../components/Rbits/Spotlight';
import ClickSpark from '../../components/Rbits/ClickSpark';
import FadeContent from '../../components/Rbits/Fade';
import NotificationPane from '../../components/NotificationPane';
import { getImageUrl } from '../../utils/imageUtils';
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
    BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';

const CHART_COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6'];

const Dashboard = () => {
    const { user, isAdmin, isSubadmin, isEmployee } = useAuth();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [theme, setTheme] = useState(() => {
        const attrTheme = document.documentElement.getAttribute('data-theme');
        if (attrTheme === 'dark' || attrTheme === 'light') return attrTheme;

        const saved = localStorage.getItem('theme');
        return saved === 'dark' ? 'dark' : 'light';
    });

    useEffect(() => {
        const savedTheme = localStorage.getItem('theme');
        const nextTheme = savedTheme === 'dark' ? 'dark' : 'light';
        setTheme(nextTheme);
        document.documentElement.setAttribute('data-theme', nextTheme);
    }, []);

    useEffect(() => {
        // Keep theme state in sync if something else toggles data-theme (e.g., Navbar)
        const el = document.documentElement;
        const observer = new MutationObserver(() => {
            const attrTheme = el.getAttribute('data-theme');
            if (attrTheme === 'dark' || attrTheme === 'light') {
                setTheme(attrTheme);
            }
        });

        observer.observe(el, { attributes: true, attributeFilter: ['data-theme'] });
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                const response = await dashboardAPI.getStats();
                setStats(response.data);
            } catch (err) {
                setError('Failed to load dashboard data');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboard();
    }, []);

    // Prepare chart data from taskBreakdown
    const getChartData = () => {
        if (!stats?.taskBreakdown) return [];
        const { pending, inProgress, completed, backlog } = stats.taskBreakdown;
        return [
            { name: 'Pending', value: pending, color: '#f59e0b' },
            { name: 'In Progress', value: inProgress, color: '#3b82f6' },
            { name: 'Completed', value: completed, color: '#10b981' },
            { name: 'Backlog', value: backlog, color: '#8b5cf6' },
        ].filter(d => d.value > 0);
    };

    const getCompletionRate = () => {
        if (!stats?.taskBreakdown) return 0;
        const { pending, inProgress, completed, backlog } = stats.taskBreakdown;
        const total = pending + inProgress + completed + backlog;
        if (total === 0) return 0;
        return Math.round((completed / total) * 100);
    };

    const getStatusBadgeClass = (status) => {
        switch (status) {
            case 'Completed': return 'status-completed';
            case 'In Progress': return 'status-inprogress';
            case 'Pending': return 'status-pending';
            default: return 'status-na';
        }
    };

    const formatTimeAgo = (dateStr) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    };

    if (loading) {
        return (
            <div className="dashboard-layout">
                <Navbar />
                <main className="dashboard-main">
                    <div className="loading-container">
                        <div className="spinner"></div>
                        <p>Loading dashboard...</p>
                    </div>
                </main>
            </div>
        );
    }

    const chartData = getChartData();
    const completionRate = getCompletionRate();

    return (
        <div className="dashboard-layout">
            <ClickSpark
                sparkColor={theme === 'dark' ? '#ffffff' : '#000000'}
                sparkSize={10}
                sparkRadius={15}
                sparkCount={8}
                duration={400}
            >
                <Navbar />
                <main className="dashboard-main">
                    <div className="dashboard-header">
                        <div className="welcome-section">
                            <h1>Welcome back, <span className="user-name">{user.fullName}</span>!</h1>
                            <p className="welcome-subtitle">Here's an overview of your workspace</p>
                        </div>
                        <div className="header-actions">
                            {(isAdmin || isSubadmin || isEmployee) && <NotificationPane />}
                            <Link to="/profile" className="profile-icon-btn" title="Profile">
                                {user?.profilePicture ? (
                                    <img
                                        src={getImageUrl(user.profilePicture)}
                                        alt="Profile"
                                        className="profile-avatar-img"
                                        style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                                    />
                                ) : (
                                    <span className="profile-avatar">{user.email?.[0]?.toUpperCase()}</span>
                                )}
                            </Link>
                            <Link to="/assign" className="btn btn-primary">
                                <i className="fas fa-plus"></i>
                                Task
                            </Link>
                        </div>
                    </div>

                    {error && <div className="error-banner">{error}</div>}

                    {/* Completion Progress Bar */}
                    <div className="completion-bar-section">
                        <div className="completion-header">
                            <span className="completion-label">Overall Completion</span>
                            <span className="completion-percentage">{completionRate}%</span>
                        </div>
                        <div className="completion-track">
                            <div
                                className="completion-fill"
                                style={{ width: `${completionRate}%` }}
                            ></div>
                        </div>
                    </div>

                    {/* Stats Cards */}
                    <div className="stats-grid">
                        {isAdmin && (
                            <>
                                <SpotlightCard className="stat-card stat-primary" spotlightColor="rgba(0, 229, 255, 0.2)">
                                    <div className="stat-icon">
                                        <i className="fas fa-user-shield"></i>
                                    </div>
                                    <div className="stat-content">
                                        <span className="stat-value">{stats?.subadminCount || 0}</span>
                                        <span className="stat-label">Sub-Admins</span>
                                    </div>
                                </SpotlightCard>
                                <FadeContent blur={true} duration={1000} easing="ease-out" initialOpacity={0}>
                                    <div className="stat-card stat-secondary">
                                        <div className="stat-icon">
                                            <i className="fas fa-users"></i>
                                        </div>
                                        <div className="stat-content">
                                            <span className="stat-value">{stats?.empCount || 0}</span>
                                            <span className="stat-label">Employees</span>
                                        </div>
                                    </div>
                                </FadeContent>
                                <div className="stat-card stat-accent">
                                    <div className="stat-icon">
                                        <i className="fas fa-tasks"></i>
                                    </div>
                                    <div className="stat-content">
                                        <span className="stat-value">{stats?.taskCount || 0}</span>
                                        <span className="stat-label">Total Tasks</span>
                                    </div>
                                </div>
                                <div className="stat-card stat-success">
                                    <div className="stat-icon">
                                        <i className="fas fa-user-friends"></i>
                                    </div>
                                    <div className="stat-content">
                                        <span className="stat-value">{stats?.teamCount || 0}</span>
                                        <span className="stat-label">Teams</span>
                                    </div>
                                </div>
                            </>
                        )}

                        {isSubadmin && (
                            <>
                                <div className="stat-card stat-secondary">
                                    <div className="stat-icon">
                                        <i className="fas fa-users"></i>
                                    </div>
                                    <div className="stat-content">
                                        <span className="stat-value">{stats?.empCount || 0}</span>
                                        <span className="stat-label">My Employees</span>
                                    </div>
                                </div>
                                <div className="stat-card stat-accent">
                                    <div className="stat-icon">
                                        <i className="fas fa-tasks"></i>
                                    </div>
                                    <div className="stat-content">
                                        <span className="stat-value">{stats?.taskCount || 0}</span>
                                        <span className="stat-label">Active Tasks</span>
                                    </div>
                                </div>
                                <div className="stat-card stat-success">
                                    <div className="stat-icon">
                                        <i className="fas fa-user-friends"></i>
                                    </div>
                                    <div className="stat-content">
                                        <span className="stat-value">{stats?.teams?.length || 0}</span>
                                        <span className="stat-label">My Teams</span>
                                    </div>
                                </div>
                            </>
                        )}

                        {isEmployee && (
                            <>
                                <div className="stat-card stat-primary">
                                    <div className="stat-icon">
                                        <i className="fas fa-clipboard-list"></i>
                                    </div>
                                    <div className="stat-content">
                                        <span className="stat-value">{stats?.individualTaskCount || 0}</span>
                                        <span className="stat-label">My Tasks</span>
                                    </div>
                                </div>
                                <div className="stat-card stat-secondary">
                                    <div className="stat-icon">
                                        <i className="fas fa-users-cog"></i>
                                    </div>
                                    <div className="stat-content">
                                        <span className="stat-value">{stats?.teamTaskCount || 0}</span>
                                        <span className="stat-label">Team Tasks</span>
                                    </div>
                                </div>
                                <div className="stat-card stat-success">
                                    <div className="stat-icon">
                                        <i className="fas fa-user-friends"></i>
                                    </div>
                                    <div className="stat-content">
                                        <span className="stat-value">{stats?.teams?.length || 0}</span>
                                        <span className="stat-label">My Teams</span>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Charts + Recent Activity Row */}
                    <div className="dashboard-panels">
                        {/* Task Status Chart */}
                        <div className="panel chart-panel">
                            <h3 className="panel-title">
                                <i className="fas fa-chart-pie"></i> Task Distribution
                            </h3>
                            {chartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={250}>
                                    <PieChart>
                                        <Pie
                                            data={chartData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={55}
                                            outerRadius={90}
                                            paddingAngle={4}
                                            dataKey="value"
                                            stroke="none"
                                        >
                                            {chartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{
                                                background: 'var(--bg-secondary)',
                                                border: '1px solid var(--border-color)',
                                                borderRadius: '8px',
                                                color: 'var(--text-primary)'
                                            }}
                                        />
                                        <Legend
                                            wrapperStyle={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="empty-chart">
                                    <i className="fas fa-chart-pie"></i>
                                    <p>No tasks yet</p>
                                </div>
                            )}
                        </div>

                        {/* Task Status Bar Chart */}
                        <div className="panel chart-panel">
                            <h3 className="panel-title">
                                <i className="fas fa-chart-bar"></i> Status Overview
                            </h3>
                            {chartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={250}>
                                    <BarChart data={chartData} barSize={36}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                                        <XAxis
                                            dataKey="name"
                                            tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                                            axisLine={{ stroke: 'var(--border-color)' }}
                                        />
                                        <YAxis
                                            tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                                            axisLine={{ stroke: 'var(--border-color)' }}
                                            allowDecimals={false}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                background: 'var(--bg-secondary)',
                                                border: '1px solid var(--border-color)',
                                                borderRadius: '8px',
                                                color: 'var(--text-primary)'
                                            }}
                                        />
                                        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                                            {chartData.map((entry, index) => (
                                                <Cell key={`bar-${index}`} fill={entry.color} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="empty-chart">
                                    <i className="fas fa-chart-bar"></i>
                                    <p>No tasks yet</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Recent Activity + Upcoming Deadlines Row */}
                    <div className="dashboard-panels">
                        {/* Recent Activity */}
                        <div className="panel activity-panel">
                            <h3 className="panel-title">
                                <i className="fas fa-history"></i> Recent Activity
                            </h3>
                            {stats?.recentTasks?.length > 0 ? (
                                <div className="activity-list">
                                    {stats.recentTasks.map((task) => (
                                        <Link
                                            to={`/tasks/${task._id}`}
                                            key={task._id}
                                            className="activity-item"
                                        >
                                            <div className="activity-dot-wrapper">
                                                <span className={`activity-dot ${getStatusBadgeClass(task.status)}`}></span>
                                            </div>
                                            <div className="activity-content">
                                                <span className="activity-title">{task.title}</span>
                                                <div className="activity-meta">
                                                    <span className={`status-badge ${getStatusBadgeClass(task.status)}`}>
                                                        {task.status}
                                                    </span>
                                                    {task.assigneeEmail && (
                                                        <span className="activity-assignee">
                                                            <i className="fas fa-user"></i>
                                                            {task.assigneeEmail.split('@')[0]}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <span className="activity-time">{formatTimeAgo(task.updatedAt)}</span>
                                        </Link>
                                    ))}
                                </div>
                            ) : (
                                <div className="empty-panel">
                                    <i className="fas fa-inbox"></i>
                                    <p>No recent activity</p>
                                </div>
                            )}
                        </div>

                        {/* Upcoming Deadlines */}
                        <div className="panel deadlines-panel">
                            <h3 className="panel-title">
                                <i className="fas fa-calendar-alt"></i> Due This Week
                            </h3>
                            {stats?.upcomingDeadlines?.length > 0 ? (
                                <div className="deadline-list">
                                    {stats.upcomingDeadlines.map((task) => {
                                        const daysLeft = Math.ceil(
                                            (new Date(task.endDate) - new Date()) / (1000 * 60 * 60 * 24)
                                        );
                                        return (
                                            <Link
                                                to={`/tasks/${task._id}`}
                                                key={task._id}
                                                className={`deadline-item ${daysLeft <= 1 ? 'urgent' : ''}`}
                                            >
                                                <div className="deadline-info">
                                                    <span className="deadline-title">{task.title}</span>
                                                    <span className="deadline-assignee">
                                                        {task.assigneeEmail?.split('@')[0] || 'Unassigned'}
                                                    </span>
                                                </div>
                                                <span className={`deadline-badge ${daysLeft <= 1 ? 'badge-urgent' : daysLeft <= 3 ? 'badge-warning' : 'badge-ok'}`}>
                                                    {daysLeft <= 0 ? 'Today' : `${daysLeft}d left`}
                                                </span>
                                            </Link>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="empty-panel">
                                    <i className="fas fa-calendar-check"></i>
                                    <p>No upcoming deadlines</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="quick-actions">
                        <h2>Quick Actions</h2>
                        <div className="actions-grid">
                            <Link to="/tasks" className="action-card">
                                <i className="fas fa-list-check"></i>
                                <span>View All Tasks</span>
                            </Link>
                            <Link to="/taskboard" className="action-card">
                                <i className="fas fa-columns"></i>
                                <span>Task Board</span>
                            </Link>
                            {(isAdmin || isSubadmin) && (
                                <>
                                    <Link to="/members" className="action-card">
                                        <i className="fas fa-users"></i>
                                        <span>View Members</span>
                                    </Link>
                                    <Link to="/team-management" className="action-card">
                                        <i className="fas fa-user-friends"></i>
                                        <span>Manage Teams</span>
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>
                </main>
            </ClickSpark>
        </div>
    );
};

export default Dashboard;
