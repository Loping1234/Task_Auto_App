import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';
import { getImageUrl } from '../utils/imageUtils';

const Navbar = () => {
    const { user, logout, isAdmin, isSubadmin, isEmployee } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    // Initialize from localStorage or default to true
    const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
        const saved = localStorage.getItem('sidebarOpen');
        return saved !== null ? JSON.parse(saved) : true;
    });

    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };

    // Update CSS variable for layout and save to localStorage
    useEffect(() => {
        localStorage.setItem('sidebarOpen', JSON.stringify(isSidebarOpen));
        const width = isSidebarOpen ? '240px' : '72px';
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
        <nav className={`navbar ${!isSidebarOpen ? 'collapsed' : ''}`}>
            {/* Header: Hamburger + Logo */}
            <div className="navbar-header">
                <button
                    className="menu-btn"
                    onClick={toggleSidebar}
                    title={isSidebarOpen ? "Collapse" : "Expand"}
                >
                    <i className="fas fa-bars"></i>
                </button>
                <div className="logo-container">
                    <Link to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', color: 'inherit' }}>
                        <span className="logo-icon">📋</span>
                        <span className="logo-text">TaskFlow</span>
                    </Link>
                </div>
            </div>
            {/* User Profile (Bottom Pinned) */}
            <div className="user-profile-section">
                {(isAdmin || isSubadmin || isEmployee) && user && (
                    <Link to="/profile" className="user-profile-link" title="Profile">
                        {user.profilePicture ? (
                            <img src={getImageUrl(user.profilePicture)} alt="User" className="user-avatar-mini" />
                        ) : (
                            <div className="user-avatar-placeholder-mini">
                                {user.email?.[0]?.toUpperCase()}
                            </div>
                        )}
                        <div className="user-info-mini">
                            <span className="user-name">{user.fullName || user.email?.split('@')[0]}</span>
                            <span className="user-role">{isAdmin ? 'Admin' : isSubadmin ? 'Sub-Admin' : 'Employee'}</span>
                        </div>
                    </Link>
                )}
            </div>

            {/* Scrollable Content */}
            <div className="navbar-content">

                {/* Main Navigation */}
                <div className="nav-section">
                    <Link to="/dashboard" className={`nav-item ${isActive('/dashboard') ? 'active' : ''}`} title="Dashboard">
                        <i className="fas fa-home"></i>
                        <span className="nav-text">Dashboard</span>
                    </Link>
                    <Link to="/tasks" className={`nav-item ${location.pathname === '/tasks' ? 'active' : ''}`} title="Tasks">
                        <i className="fas fa-tasks"></i>
                        <span className="nav-text">Tasks</span>
                    </Link>
                    <Link to="/taskboard" className={`nav-item ${isActive('/taskboard') ? 'active' : ''}`} title="Board">
                        <i className="fas fa-columns"></i>
                        <span className="nav-text">Board</span>
                    </Link>
                </div>

                <div className="divider"></div>

                {/* Employee Links */}
                {isEmployee && (
                    <>
                        <div className="nav-section">
                            <div className="section-title">Team</div>
                            <Link to="/team-tasks" className={`nav-item ${isActive('/team-tasks') ? 'active' : ''}`} title="Team Tasks">
                                <i className="fas fa-users"></i>
                                <span className="nav-text">Team Tasks</span>
                            </Link>
                            <Link to="/team-chat" className={`nav-item ${isActive('/team-chat') ? 'active' : ''}`} title="Team Chat">
                                <i className="fas fa-comments"></i>
                                <span className="nav-text">Team Chat</span>
                            </Link>
                        </div>
                        <div className="divider"></div>
                    </>
                )}

                {/* Admin/Subadmin Links */}
                {(isAdmin || isSubadmin) && (
                    <>
                        <div className="nav-section">
                            <div className="section-title">Management</div>
                            <Link to="/assign" className={`nav-item ${isActive('/assign') ? 'active' : ''}`} title="Create Task">
                                <i className="fas fa-plus-circle"></i>
                                <span className="nav-text">Create</span>
                            </Link>
                            <Link to="/members" className={`nav-item ${isActive('/members') ? 'active' : ''}`} title="Members">
                                <i className="fas fa-users"></i>
                                <span className="nav-text">Members</span>
                            </Link>
                            <Link to="/admin-chat" className={`nav-item ${isActive('/admin-chat') ? 'active' : ''}`} title="Chat">
                                <i className="fas fa-comments"></i>
                                <span className="nav-text">Chat</span>
                            </Link>
                            <Link to="/projects" className={`nav-item ${isActive('/projects') ? 'active' : ''}`} title="Projects">
                                <i className="fas fa-projects"></i>
                                <span className="nav-text">Projects</span>                                
                            </Link>
                            {isAdmin && (
                                <Link to="/team-management" className={`nav-item ${isActive('/team-management') ? 'active' : ''}`} title="Manage Teams">
                                    <i className="fas fa-users-cog"></i>
                                    <span className="nav-text">Manage Teams</span>
                                </Link>
                            )}
                        </div>
                        <div className="divider"></div>
                    </>
                )}

                {/* Bottom Actions: Theme & Logout (Above Profile) */}
                <div className="nav-section">
                    <button onClick={toggleDarkMode} className="nav-item theme-btn" title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
                        <i className={darkMode ? 'fas fa-sun' : 'fas fa-moon'}></i>
                        <span className="nav-text">{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
                    </button>
                    <button onClick={handleLogout} className="nav-item logout-btn" title="Logout">
                        <i className="fas fa-sign-out-alt"></i>
                        <span className="nav-text">Logout</span>
                    </button>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
