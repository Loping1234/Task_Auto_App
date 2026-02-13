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

    const getStatusClass = (status) => {
        if (!status) return 'status-na';
        const lower = status.toLowerCase();
        if (lower === 'completed') return 'status-completed';
        if (lower === 'in progress' || lower === 'inprogress') return 'status-progress';
        if (lower === 'pending') return 'status-pending';
        return 'status-na';
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

                <div className="projects-table-container">
                    {projects.length === 0 ? (
                        <div className="empty-state">
                            <i className="fas fa-project-diagram"></i>
                            <h3>No projects found</h3>
                            <p>Create a project to get started</p>
                        </div>
                    ) : (
                        <table className="projects-table">
                            <thead>
                                <tr>
                                    <th>Project Name</th>
                                    <th>Progress</th>
                                    <th>Status</th>
                                    <th>Tasks</th>
                                    <th>Members</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {projects.map(proj => (
                                    <tr key={proj._id}>
                                        <td>
                                            <div className="project-name-cell">
                                                <div className="project-icon-small">
                                                    <i className="fas fa-project-diagram"></i>
                                                </div>
                                                <div className="project-info">
                                                    <h3>{proj.projectName}</h3>
                                                    {proj.description && (
                                                        <p className="project-desc-preview">{proj.description}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="progress-cell">{proj.progress || 'No Tasks'}</span>
                                        </td>
                                        <td>
                                            <span className={`status-badge ${getStatusClass(proj.computedStatus)}`}>
                                                {proj.computedStatus || 'N/A'}
                                            </span>
                                        </td>
                                        <td>
                                            <span className="stat-cell">
                                                <i className="fas fa-tasks"></i>
                                                {proj.tasks?.length || 0}
                                            </span>
                                        </td>
                                        <td>
                                            <span className="stat-cell">
                                                <i className="fas fa-users"></i>
                                                {proj.employees?.length || 0}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="action-buttons">
                                                <Link to={`/projects/${proj._id}`} className="action-btn view" title="View Details">
                                                    <i className="fas fa-eye"></i>
                                                </Link>
                                                {isAdmin && (
                                                    <>
                                                        <Link to={`/projects/${proj._id}/edit`} className="action-btn edit" title="Edit Project">
                                                            <i className="fas fa-edit"></i>
                                                        </Link>
                                                        <button
                                                            className="action-btn delete"
                                                            onClick={() => handleDelete(proj._id, proj.projectName)}
                                                            title="Delete Project"
                                                        >
                                                            <i className="fas fa-trash"></i>
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </main>
        </div>
    );
};

export default Project;
