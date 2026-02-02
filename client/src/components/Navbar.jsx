import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

const Navbar = () => {
    const { user, logout, isAdmin, isSubadmin, isEmployee } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [darkMode, setDarkMode] = useState(false);

    // Load theme preference on mount
    useEffect(() => {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            setDarkMode(true);
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
        }
    }, []);

    // Toggle dark mode
    const toggleDarkMode = () => {
        const newMode = !darkMode;
        setDarkMode(newMode);

        if (newMode) {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
            localStorage.setItem('theme', 'light');
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

    return (
        <nav className="navbar">
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
                            <span>Assign</span>
                        </Link>

                        <Link to="/members" className={isActive('/members') ? 'active' : ''}>
                            <i className="fas fa-users"></i>
                            <span>Members</span>
                        </Link>
{/*
                        <Link to="/teams" className={isActive('/teams') ? 'active' : ''}>
                            <i className="fas fa-user-friends"></i>
                            <span>Teams</span>
                        </Link>*/}

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
                <div className="user-info">
                    <span className="user-role">{user?.role}</span>
                    <span className="user-email">{user?.email}</span>
                </div>
                <button onClick={toggleDarkMode} className="theme-toggle-btn" title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
                    <i className={darkMode ? 'fas fa-sun' : 'fas fa-moon'}></i>
                </button>
                <button onClick={handleLogout} className="logout-btn">
                    <i className="fas fa-sign-out-alt"></i>
                    <span>Logout</span>
                </button>
            </div>
        </nav>
    );
};

export default Navbar;
