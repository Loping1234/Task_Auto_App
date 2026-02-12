import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { projectsAPI } from '../../api';
import Navbar from '../../components/Navbar';
import '../styles/ProjectDetails.css';

const ProjectDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { isAdmin, isSubadmin } = useAuth();

    const [project, setProject] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchProject();
    }, [id]);

    const fetchProject = async () => {
        try {
            const response = await projectsAPI.getById(id);
            setProject(response.data.project);
        } catch (err) {
            setError('Failed to load project');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm(`Are you sure you want to delete "${project.projectName}"?`)) return;
        try {
            await projectsAPI.delete(id);
            navigate('/projects');
        } catch (err) {
            console.error('Failed to delete project', err);
        }
    };

    const formatDate = (d) => d ? new Date(d).toLocaleDateString() : 'N/A';

    if (loading) {
        return (
            <div className="page-layout">
                <Navbar />
                <main className="page-main">
                    <div className="loading-container">
                        <div className="spinner"></div>
                        <p>Loading project...</p>
                    </div>
                </main>
            </div>
        );
    }

    if (error || !project) {
        return (
            <div className="page-layout">
                <Navbar />
                <main className="page-main">
                    <div className="error-banner">{error || 'Project not found'}</div>
                    <Link to="/projects" className="btn btn-secondary">Back to Projects</Link>
                </main>
            </div>
        );
    }

    const statusBreakdown = project.statusBreakdown || {};

    return (
        <div className="page-layout">
            <Navbar />
            <main className="page-main pd-page">
                {/* Header */}
                <div className="pd-header">
                    <div className="pd-header-left">
                        <Link to="/projects" className="back-link">
                            <i className="fas fa-arrow-left"></i> Back to Projects
                        </Link>
                        <h1>{project.projectName}</h1>
                        {project.description && (
                            <p className="pd-description">{project.description}</p>
                        )}
                    </div>
                    <div className="pd-header-actions">
                        {isAdmin && (
                            <>
                                <Link to={`/projects/${id}/edit`} className="btn btn-primary">
                                    <i className="fas fa-edit"></i> Edit
                                </Link>
                                <button className="btn btn-danger" onClick={handleDelete}>
                                    <i className="fas fa-trash"></i> Delete
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Overview Cards */}
                <div className="pd-overview">
                    <div className="pd-stat-card">
                        <div className="pd-stat-icon" style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>
                            <i className="fas fa-tasks"></i>
                        </div>
                        <div>
                            <span className="pd-stat-value">{project.tasks?.length || 0}</span>
                            <span className="pd-stat-label">Tasks</span>
                        </div>
                    </div>
                    <div className="pd-stat-card">
                        <div className="pd-stat-icon" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
                            <i className="fas fa-users"></i>
                        </div>
                        <div>
                            <span className="pd-stat-value">{project.employees?.length || 0}</span>
                            <span className="pd-stat-label">Members</span>
                        </div>
                    </div>
                    <div className="pd-stat-card">
                        <div className="pd-stat-icon" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
                            <i className="fas fa-user-shield"></i>
                        </div>
                        <div>
                            <span className="pd-stat-value">{project.assignedSubadmins?.length || 0}</span>
                            <span className="pd-stat-label">Subadmins</span>
                        </div>
                    </div>
                    <div className="pd-stat-card">
                        <div className="pd-stat-icon" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                            <i className="fas fa-chart-pie"></i>
                        </div>
                        <div>
                            <span className="pd-stat-value">{project.progress || 0}%</span>
                            <span className="pd-stat-label">{project.computedStatus || 'N/A'}</span>
                        </div>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="pd-section pd-progress-section">
                    <h3><i className="fas fa-chart-line"></i> Progress</h3>
                    <div className="pd-progress-bar-bg">
                        <div className="pd-progress-bar-fill" style={{ width: `${project.progress || 0}%` }}></div>
                    </div>
                    <div className="pd-breakdown">
                        {Object.entries(statusBreakdown).map(([status, count]) => (
                            <span key={status} className="pd-breakdown-tag">
                                {status}: <strong>{count}</strong>
                            </span>
                        ))}
                    </div>
                </div>

                <div className="pd-grid">
                    {/* Workflow Statuses */}
                    <div className="pd-section">
                        <h3><i className="fas fa-tags"></i> Workflow Statuses</h3>
                        {project.customStatuses && project.customStatuses.length > 0 ? (
                            <div className="pd-statuses">
                                {project.customStatuses
                                    .sort((a, b) => a.order - b.order)
                                    .map((s, idx) => (
                                        <div key={idx} className="pd-status-item">
                                            <span className="pd-status-order">{s.order}</span>
                                            <span className="pd-status-dot" style={{ backgroundColor: s.color }}></span>
                                            <span className="pd-status-label">{s.label}</span>
                                        </div>
                                    ))}
                            </div>
                        ) : (
                            <p className="text-muted">No custom statuses defined</p>
                        )}
                    </div>

                    {/* Metadata */}
                    <div className="pd-section">
                        <h3><i className="fas fa-info-circle"></i> Details</h3>
                        <div className="pd-meta-list">
                            <div className="pd-meta-item">
                                <span className="pd-meta-label">Created By</span>
                                <span className="pd-meta-value">{project.createdBy?.fullName || project.createdBy?.email || 'Unknown'}</span>
                            </div>
                            <div className="pd-meta-item">
                                <span className="pd-meta-label">Created</span>
                                <span className="pd-meta-value">{formatDate(project.createdAt)}</span>
                            </div>
                            <div className="pd-meta-item">
                                <span className="pd-meta-label">Last Updated</span>
                                <span className="pd-meta-value">{formatDate(project.updatedAt)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Subadmins */}
                    <div className="pd-section">
                        <h3><i className="fas fa-user-shield"></i> Subadmins</h3>
                        {project.assignedSubadmins && project.assignedSubadmins.length > 0 ? (
                            <div className="pd-member-list">
                                {project.assignedSubadmins.map(sa => (
                                    <div key={sa._id} className="pd-member-card">
                                        <div className="pd-member-avatar">{(sa.fullName || sa.email)?.[0]?.toUpperCase()}</div>
                                        <div>
                                            <div className="pd-member-name">{sa.fullName || sa.email}</div>
                                            <div className="pd-member-email">{sa.email}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-muted">No subadmins assigned</p>
                        )}
                    </div>

                    {/* Employees */}
                    <div className="pd-section">
                        <h3><i className="fas fa-users"></i> Team Members</h3>
                        {project.employees && project.employees.length > 0 ? (
                            <div className="pd-member-list">
                                {project.employees.map(emp => (
                                    <div key={emp._id} className="pd-member-card">
                                        <div className="pd-member-avatar">{(emp.fullName || emp.email)?.[0]?.toUpperCase()}</div>
                                        <div>
                                            <div className="pd-member-name">{emp.fullName || emp.email}</div>
                                            <div className="pd-member-email">{emp.email}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-muted">No members assigned</p>
                        )}
                    </div>
                </div>

                {/* Tasks */}
                <div className="pd-section pd-tasks-section">
                    <h3><i className="fas fa-tasks"></i> Tasks ({project.tasks?.length || 0})</h3>
                    {project.tasks && project.tasks.length > 0 ? (
                        <div className="pd-tasks-table-wrapper">
                            <table className="pd-tasks-table">
                                <thead>
                                    <tr>
                                        <th>Title</th>
                                        <th>Status</th>
                                        <th>Assignee</th>
                                        <th>Deadline</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {project.tasks.map(task => (
                                        <tr key={task._id}>
                                            <td className="pd-task-title">{task.title}</td>
                                            <td>
                                                <span className={`pd-task-status pd-task-status-${(task.status || '').toLowerCase().replace(/\s/g, '-')}`}>
                                                    {task.status || 'N/A'}
                                                </span>
                                            </td>
                                            <td className="pd-task-assignee">{task.assigneeEmail || '—'}</td>
                                            <td className="pd-task-date">{formatDate(task.endDate)}</td>
                                            <td>
                                                <Link to={`/tasks/${task._id}`} className="pd-task-link">
                                                    <i className="fas fa-arrow-right"></i>
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="empty-state">
                            <i className="fas fa-clipboard-list"></i>
                            <p>No tasks in this project yet</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default ProjectDetails;
