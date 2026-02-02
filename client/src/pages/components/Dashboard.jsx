import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { dashboardAPI } from '../../api';
import Navbar from '../../components/Navbar';
import '../styles/Dashboard.css';

const Dashboard = () => {
    const { user, isAdmin, isSubadmin, isEmployee } = useAuth();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

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

    return (
        <div className="dashboard-layout">
            <Navbar />
            <main className="dashboard-main">
                <div className="dashboard-header">
                    <div className="welcome-section">
                        <h1>Welcome back, <span className="user-name">{user?.email?.split('@')[0]}</span>!</h1>
                        <p className="welcome-subtitle">Here's an overview of your workspace</p>
                    </div>
                    <div className="header-actions">
                        {(isAdmin || isSubadmin) && (
                            <Link to="/assign" className="btn btn-primary">
                                <i className="fas fa-plus"></i>
                                Create Task
                            </Link>
                        )}
                    </div>
                </div>

                {error && <div className="error-banner">{error}</div>}

                <div className="stats-grid">
                    {isAdmin && (
                        <>
                            <div className="stat-card stat-primary">
                                <div className="stat-icon">
                                    <i className="fas fa-user-shield"></i>
                                </div>
                                <div className="stat-content">
                                    <span className="stat-value">{stats?.subadminCount || 0}</span>
                                    <span className="stat-label">Sub-Admins</span>
                                </div>
                            </div>
                            <div className="stat-card stat-secondary">
                                <div className="stat-icon">
                                    <i className="fas fa-users"></i>
                                </div>
                                <div className="stat-content">
                                    <span className="stat-value">{stats?.empCount || 0}</span>
                                    <span className="stat-label">Employees</span>
                                </div>
                            </div>
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
        </div>
    );
};

export default Dashboard;
