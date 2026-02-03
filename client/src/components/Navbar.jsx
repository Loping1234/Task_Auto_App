import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

const Navbar = () => {
    const { user, logout, isAdmin, isSubadmin, isEmployee } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    // Toggle sidebar
    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };

    // Update CSS variable for layout
    useEffect(() => {
        const width = isSidebarOpen ? '260px' : '80px';
        document.documentElement.style.setProperty('--sidebar-width', width);
    }, [isSidebarOpen]);

    const [darkMode, setDarkMode] = useState(() => {
        return localStorage.getItem('theme') === 'dark';
    });

    useEffect(() => {
        if (darkMode) {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
            localStorage.setItem('theme', 'light');
        }
    }, [darkMode]);

    const toggleDarkMode = () => {
        setDarkMode(!darkMode);
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

    return (
        <>
            <button
                className="sidebar-toggle-btn"
                onClick={toggleSidebar}
                style={{
                    position: 'fixed',
                    left: isSidebarOpen ? '220px' : '20px',
                    top: '20px',
                    zIndex: 1001,
                    transition: 'left 0.3s ease',
                    background: 'var(--primary)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '8px 12px',
                    cursor: 'pointer'
                }}
                title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
            >
                <i className={isSidebarOpen ? "fas fa-times" : "fas fa-bars"}></i>
            </button>

            <nav className={`navbar ${!isSidebarOpen ? 'collapsed' : ''}`}>
                <div className="navbar-brand">
                    <Link to="/dashboard">
                        <span className="logo">📋</span>
                        <span className="brand-text">TaskFlow</span>
                    </Link>
                </div>

                <div className="navbar-links">
                    <Link to="/dashboard" className={isActive('/dashboard') ? 'active' : ''}>
                        <i className="fas fa-home"></i>
                        <span>Dashboard</span>
                    </Link>

                    <Link to="/tasks" className={location.pathname === '/tasks' ? 'active' : ''}>
                        <i className="fas fa-tasks"></i>
                        <span>Tasks</span>
                    </Link>

                    <Link to="/taskboard" className={isActive('/taskboard') ? 'active' : ''}>
                        <i className="fas fa-columns"></i>
                        <span>Board</span>
                    </Link>

                    {/* Employee-only links */}
                    {isEmployee && (
                        <>
                            <Link to="/team-tasks" className={isActive('/team-tasks') ? 'active' : ''}>
                                <i className="fas fa-users"></i>
                                <span>Team Tasks</span>
                            </Link>

                            <Link to="/team-chat" className={isActive('/team-chat') ? 'active' : ''}>
                                <i className="fas fa-comments"></i>
                                <span>Team Chat</span>
                            </Link>
                        </>
                    )}

                    {/* Admin & Subadmin links */}
                    {(isAdmin || isSubadmin) && (
                        <>
                            <Link to="/assign" className={isActive('/assign') ? 'active' : ''}>
                                <i className="fas fa-plus-circle"></i>
                                <span>Create</span>
                            </Link>

                            <Link to="/members" className={isActive('/members') ? 'active' : ''}>
                                <i className="fas fa-users"></i>
                                <span>Members</span>
                            </Link>
                            <Link to="/admin-chat" className={isActive('/admin-chat') ? 'active' : ''}>
                                <i className="fas fa-comments"></i>
                                <span>Chat</span>
                            </Link>
                        </>
                    )}

                    {/* Admin-only links */}
                    {isAdmin && (
                        <>
                            <Link to="/team-management" className={isActive('/team-management') ? 'active' : ''}>
                                <i className="fas fa-users-cog"></i>
                                <span>Manage Teams</span>
                            </Link>
                        </>
                    )}
                </div>

                <div className="navbar-user">
                    <button onClick={toggleDarkMode} className="theme-toggle-btn" style={{ marginBottom: '70px', width: '100%', justifyContent: 'flex-start' }} title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
                        <i className={darkMode ? 'fas fa-sun' : 'fas fa-moon'}></i>
                        <span>{darkMode ? 'Light' : 'Dark'} Mode</span>
                    </button>
                    <button onClick={handleLogout} className="logout-btn">
                        <i className="fas fa-sign-out-alt"></i>
                        <span>Logout</span>
                    </button>
                </div>
            </nav>
        </>
    );
};

export default Navbar;
