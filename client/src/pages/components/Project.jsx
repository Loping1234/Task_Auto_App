import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { projectsAPI } from '../../api';
import Navbar from '../../components/Navbar';
import '../styles/Project.css';

const Project = () => {
    const { isAdmin, isSubadmin } = useAuth();
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchProjects();
    }, []);

    const fetchProjects = async () => {
        try {
            const response = await projectsAPI.getAll();
            setProjects(response.data.projects || response.data);
        } catch (err) {
            setError('Failed to load projects');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id, name) => {
        if (!window.confirm(`Are you sure you want to delete project "${name}"?`)) return;

        try {
            await projectsAPI.delete(id);
            setProjects(projects.filter(p => p._id !== id));
        } catch (err) {
            console.error('Failed to delete project', err);
        }
    };

    if (!isAdmin && !isSubadmin) {
        return (
            <div className="page-layout">
                <Navbar />
                <main className="page-main">
                    <div className="error-banner">You do not have permission to view projects.</div>
                </main>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="page-layout">
                <Navbar />
                <main className="page-main">
                    <div className="loading-container">
                        <div className="spinner"></div>
                        <p>Loading projects...</p>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="page-layout">
            <Navbar />
            <main className="page-main">
                <div className="page-header">
                    <div>
                        <h1>Projects</h1>
                        <p className="page-subtitle">Manage projects, members and tasks</p>
                    </div>
                    {isAdmin && (
                        <Link to="/projects/create" className="btn btn-primary">
                            <i className="fas fa-plus"></i> Create Project
                        </Link>
                    )}
                </div>

                {error && <div className="error-banner">{error}</div>}

                <div className="projects-grid">
                    {projects.length === 0 ? (
                        <div className="empty-state">
                            <i className="fas fa-project-diagram"></i>
                            <h3>No projects found</h3>
                            <p>Create a project to get started</p>
                        </div>
                    ) : (
                        projects.map(proj => (
                            <div key={proj._id} className="project-card">
                                <div className="project-header">
                                    <div className="project-icon">
                                        <i className="fas fa-project-diagram"></i>
                                    </div>
                                    <div>
                                        <h3>{proj.projectName}</h3>
                                        {proj.description && (
                                            <p className="project-description">{proj.description}</p>
                                        )}
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                <div className="project-progress">
                                    <div className="progress-bar-bg">
                                        <div
                                            className="progress-bar-fill"
                                            style={{ width: `${proj.progress || 0}%` }}
                                        ></div>
                                    </div>
                                    <span className="progress-text">{proj.progress || 0}% — {proj.computedStatus || 'N/A'}</span>
                                </div>

                                <div className="project-details">
                                    <p className="project-stat">
                                        <i className="fas fa-tasks"></i>
                                        {proj.tasks?.length || 0} tasks
                                    </p>
                                    <p className="project-stat">
                                        <i className="fas fa-users"></i>
                                        {proj.employees?.length || 0} members
                                    </p>
                                    <p className="project-stat">
                                        <i className="fas fa-user-shield"></i>
                                        {proj.assignedSubadmins?.length || 0} subadmins
                                    </p>
                                </div>

                                {/* Custom Status Tags */}
                                {proj.customStatuses && proj.customStatuses.length > 0 && (
                                    <div className="project-statuses">
                                        {proj.customStatuses.map((s, idx) => (
                                            <span key={idx} className="status-chip" style={{ backgroundColor: s.color + '20', color: s.color, borderColor: s.color }}>
                                                {s.label}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                <div className="project-actions">
                                    <Link to={`/projects/${proj._id}`} className="action-btn view">
                                        <i className="fas fa-eye"></i> View
                                    </Link>
                                    {isAdmin && (
                                        <>
                                            <Link to={`/projects/${proj._id}/edit`} className="action-btn edit">
                                                <i className="fas fa-edit"></i> Edit
                                            </Link>
                                            <button
                                                className="action-btn delete"
                                                onClick={() => handleDelete(proj._id, proj.projectName)}
                                            >
                                                <i className="fas fa-trash"></i> Delete
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </main>
        </div>
    );
};

export default Project;
