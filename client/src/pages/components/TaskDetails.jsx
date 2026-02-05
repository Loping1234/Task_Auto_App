import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { tasksAPI, employeesAPI } from '../../api';
import Navbar from '../../components/Navbar';
import '../styles/TaskDetails.css';

const TaskDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user, isAdmin, isSubadmin, isEmployee } = useAuth();

    const [task, setTask] = useState(null);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('activity');
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [commentText, setCommentText] = useState('');
    const [commentImage, setCommentImage] = useState(null);

    const [editForm, setEditForm] = useState({
        title: '',
        description: '',
        status: '',
        startDate: '',
        endDate: '',
        assigneeEmail: ''
    });

    useEffect(() => {
        fetchTask();
        if (isAdmin || isSubadmin) {
            fetchEmployees();
        }
    }, [id]);

    const fetchTask = async () => {
        try {
            const response = await tasksAPI.getById(id);
            const t = response.data.task;
            setTask(t);
            setEditForm({
                title: t.title || '',
                description: t.description || '',
                status: t.status || 'Pending',
                startDate: t.startDate ? t.startDate.split('T')[0] : '',
                endDate: t.endDate ? t.endDate.split('T')[0] : '',
                assigneeEmail: t.assigneeEmail || ''
            });
        } catch (err) {
            setError('Failed to load task');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchEmployees = async () => {
        try {
            const response = await employeesAPI.getAll();
            setEmployees(response.data.employees || []);
        } catch (err) {
            console.error('Failed to load employees', err);
        }
    };

    const handleStatusChange = async (newStatus) => {
        try {
            await tasksAPI.updateStatus(id, newStatus);
            setTask({ ...task, status: newStatus });
            setEditForm(prev => ({ ...prev, status: newStatus }));
        } catch (err) {
            console.error('Failed to update status', err);
        }
    };

    const handleAssigneeChange = async (newAssignee) => {
        try {
            await tasksAPI.updateAssignee(id, newAssignee);
            setTask({ ...task, assigneeEmail: newAssignee });
            setEditForm(prev => ({ ...prev, assigneeEmail: newAssignee }));
        } catch (err) {
            console.error('Failed to update assignee', err);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            let data = editForm;
            let config = {};

            if (editForm.image instanceof File) {
                const formData = new FormData();
                formData.append('title', editForm.title);
                formData.append('description', editForm.description);
                formData.append('status', editForm.status);
                formData.append('startDate', editForm.startDate);
                formData.append('endDate', editForm.endDate);
                formData.append('assigneeEmail', editForm.assigneeEmail);
                formData.append('image', editForm.image);
                data = formData;
                config = { headers: { 'Content-Type': 'multipart/form-data' } };
            }

            await tasksAPI.update(id, data, config);
            await fetchTask();
            setIsEditing(false);
        } catch (err) {
            console.error('Failed to update task', err);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm('Are you sure you want to delete this task?')) return;
        try {
            await tasksAPI.delete(id);
            navigate('/tasks');
        } catch (err) {
            console.error('Failed to delete task', err);
        }
    };

    const handleAddComment = async (e) => {
        e.preventDefault();
        if (!commentText.trim()) return;

        try {
            const formData = new FormData();
            formData.append('text', commentText);
            if (commentImage) {
                formData.append('image', commentImage);
            }
            await tasksAPI.addComment(id, formData);
            setCommentText('');
            setCommentImage(null);
            await fetchTask();
        } catch (err) {
            console.error('Failed to add comment', err);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        return new Date(dateStr).toLocaleDateString();
    };

    const formatDateTime = (dateStr) => {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleString();
    };

    if (loading) {
        return (
            <div className="page-layout">
                <Navbar />
                <main className="page-main">
                    <div className="loading-container">
                        <div className="spinner"></div>
                        <p>Loading task...</p>
                    </div>
                </main>
            </div>
        );
    }

    if (error || !task) {
        return (
            <div className="page-layout">
                <Navbar />
                <main className="page-main">
                    <div className="error-banner">{error || 'Task not found'}</div>
                    <Link to="/tasks" className="btn btn-secondary">Back to Tasks</Link>
                </main>
            </div>
        );
    }

    const canEdit = isAdmin || isSubadmin;
    const isAssignee = task.assigneeEmail === user?.email;

    return (
        <div className="page-layout">
            <Navbar />
            <main className="page-main task-details-page">
                {/* Header */}
                <div className="task-header">
                    <div className="task-header-left">
                        <Link to="/tasks" className="back-link">
                            <i className="fas fa-arrow-left"></i> Back to Tasks
                        </Link>
                        {isEditing ? (
                            <input
                                type="text"
                                value={editForm.title}
                                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                className="edit-title-input"
                            />
                        ) : (
                            <h1>{task.title}</h1>
                        )}
                        <span className="task-id">ID: {task._id}</span>
                    </div>
                    <div className="task-header-actions">
                        {canEdit && !isEditing && (
                            <>
                                <button className="btn btn-primary-edit" onClick={() => setIsEditing(true)}>
                                    <i className="fas fa-edit"></i> Edit
                                </button>
                                <button className="btn btn-danger-delete" onClick={handleDelete}>
                                    <i className="fas fa-trash"></i> Delete
                                </button>
                            </>
                        )}
                        {isEditing && (
                            <>
                                <button className="btn btn-success" onClick={handleSave} disabled={saving}>
                                    <i className="fas fa-save"></i> {saving ? 'Saving...' : 'Save'}
                                </button>
                                <button className="btn btn-secondary" onClick={() => setIsEditing(false)}>
                                    Cancel
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Main Content */}
                <div className="task-content">
                    <div className="task-main">
                        {/* Description */}
                        <div className="detail-card">
                            <h3><i className="fas fa-align-left"></i> Description</h3>
                            {isEditing ? (
                                <textarea
                                    value={editForm.description}
                                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                    className="edit-description"
                                    rows={5}
                                />
                            ) : (
                                <div className="description-content"
                                    dangerouslySetInnerHTML={{ __html: task.description || '<em>No description provided.</em>' }}
                                />
                            )}
                        </div>

                        {/* Attachment */}
                        <div className="detail-card">
                            <h3><i className="fas fa-image"></i> Attachment</h3>
                            {isEditing ? (
                                <div className="edit-attachment">
                                    {task.image && (
                                        <div className="current-image">
                                            <span>Current Image:</span>
                                            <img src={`/imgs/${task.image}`} alt={task.title} className="thumbnail" style={{ maxWidth: '100px', borderRadius: '4px', marginTop: '0.5rem' }} />
                                        </div>
                                    )}
                                    <div className="upload-input" style={{ marginTop: '1rem' }}>
                                        <label htmlFor="task-image-upload" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                            {task.image ? 'Change Image' : 'Upload Image'}
                                        </label>
                                        <input
                                            type="file"
                                            id="task-image-upload"
                                            accept="image/*"
                                            onChange={(e) => setEditForm(prev => ({ ...prev, image: e.target.files[0] }))}
                                            style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}
                                        />
                                    </div>
                                </div>
                            ) : (
                                task.image ? (
                                    <img src={`/imgs/${task.image}`} alt={task.title} className="task-image" />
                                ) : (
                                    <div className="no-attachment">
                                        <i className="fas fa-file-upload"></i>
                                        <span>No images attached</span>
                                    </div>
                                )
                            )}
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="task-sidebar">
                        <div className="detail-card">
                            <h3>Attributes</h3>

                            <div className="attribute-group">
                                <label>Status</label>
                                <select
                                    value={task.status}
                                    onChange={(e) => handleStatusChange(e.target.value)}
                                    className="status-select"
                                >
                                    <option value="N/A">N/A</option>
                                    <option value="Pending">Pending</option>
                                    <option value="In Progress">In Progress</option>
                                    <option value="Completed">Completed</option>
                                </select>
                            </div>

                            <div className="attribute-group">
                                <label>Assigned To</label>
                                {canEdit ? (
                                    <select
                                        value={task.assigneeEmail || ''}
                                        onChange={(e) => handleAssigneeChange(e.target.value)}
                                        className="assignee-select"
                                    >
                                        <option value="">Select Employee</option>
                                        {employees.map(emp => (
                                            <option key={emp._id || emp.email} value={emp.email}>{emp.email}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <div className="attribute-value">{task.assigneeEmail || task.teamName || 'Unassigned'}</div>
                                )}
                            </div>

                            <div className="attribute-row">
                                <div className="attribute-group">
                                    <label>Start Date</label>
                                    {isEditing ? (
                                        <input
                                            type="date"
                                            value={editForm.startDate}
                                            onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                                        />
                                    ) : (
                                        <div className="attribute-value">{formatDate(task.startDate)}</div>
                                    )}
                                </div>
                                <div className="attribute-group">
                                    <label>Deadline</label>
                                    {isEditing ? (
                                        <input
                                            type="date"
                                            value={editForm.endDate}
                                            onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                                        />
                                    ) : (
                                        <div className="attribute-value">{formatDate(task.endDate)}</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs Section */}
                <div className="tabs-section">
                    <div className="tabs-nav">
                        <button
                            className={`tab-btn ${activeTab === 'activity' ? 'active' : ''}`}
                            onClick={() => setActiveTab('activity')}
                        >
                            <i className="fas fa-history"></i> Activity Log
                        </button>
                        <button
                            className={`tab-btn ${activeTab === 'comments' ? 'active' : ''}`}
                            onClick={() => setActiveTab('comments')}
                        >
                            <i className="fas fa-comments"></i> Comments ({task.comments?.length || 0})
                        </button>
                    </div>

                    <div className="tab-content">
                        {activeTab === 'activity' && (
                            <div className="activity-log">
                                {task.activityLog && task.activityLog.length > 0 ? (
                                    <table className="activity-table">
                                        <thead>
                                            <tr>
                                                <th>Author</th>
                                                <th>Field</th>
                                                <th>Change</th>
                                                <th>Timestamp</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {task.activityLog.slice().reverse().map((entry, idx) => (
                                                <tr key={idx}>
                                                    <td>
                                                        <div className="author-cell">
                                                            <span className="author-avatar">{entry.changedBy?.[0]?.toUpperCase()}</span>
                                                            <span>{entry.changedBy}</span>
                                                        </div>
                                                    </td>
                                                    <td><span className="field-badge">{entry.field}</span></td>
                                                    <td>
                                                        <span className="old-value">{entry.oldValue}</span>
                                                        <i className="fas fa-arrow-right"></i>
                                                        <span className="new-value">{entry.newValue}</span>
                                                    </td>
                                                    <td className="timestamp">{formatDateTime(entry.changedAt)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="empty-state">
                                        <i className="fas fa-history"></i>
                                        <p>No activity recorded yet</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'comments' && (
                            <div className="comments-section">
                                {(isEmployee && isAssignee) && (
                                    <form className="comment-form" onSubmit={handleAddComment}>
                                        <h4>Add a Comment</h4>
                                        <textarea
                                            value={commentText}
                                            onChange={(e) => setCommentText(e.target.value)}
                                            placeholder="Write your comment here..."
                                            rows={3}
                                            required
                                        />
                                        <div className="comment-form-actions">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={(e) => setCommentImage(e.target.files[0])}
                                            />
                                            <button type="submit" className="btn btn-primary">
                                                <i className="fas fa-paper-plane"></i> Submit Comment
                                            </button>
                                        </div>
                                    </form>
                                )}

                                <div className="comments-list">
                                    {task.comments && task.comments.length > 0 ? (
                                        task.comments.slice().reverse().map((comment, idx) => (
                                            <div key={idx} className="comment-card">
                                                <div className="comment-avatar">{comment.author?.[0]?.toUpperCase()}</div>
                                                <div className="comment-body">
                                                    <div className="comment-header">
                                                        <span className="comment-author">{comment.author}</span>
                                                        <span className="comment-time">{formatDateTime(comment.createdAt)}</span>
                                                    </div>
                                                    <p className="comment-text">{comment.text}</p>
                                                    {comment.image && (
                                                        <a href={`/imgs/${comment.image}`} target="_blank" rel="noopener noreferrer">
                                                            <img
                                                                src={`/imgs/${comment.image}`}
                                                                alt="Comment attachment"
                                                                className="comment-image"
                                                                style={{ cursor: 'zoom-in' }}
                                                            />
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="empty-state">
                                            <i className="fas fa-comment-slash"></i>
                                            <p>No comments yet. Start the conversation!</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default TaskDetails;