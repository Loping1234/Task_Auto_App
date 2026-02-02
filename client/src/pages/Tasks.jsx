import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { tasksAPI } from '../api';
import Navbar from '../components/Navbar';
import './Tasks.css';

const Tasks = () => {
    const { user, isAdmin, isSubadmin } = useAuth();
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchTasks();
    }, []);

    const fetchTasks = async () => {
        try {
            const response = await tasksAPI.getAll();
            setTasks(response.data.tasks || response.data);
        } catch (err) {
            setError('Failed to load tasks');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleStatusChange = async (taskId, newStatus) => {
        try {
            await tasksAPI.updateStatus(taskId, newStatus);
            setTasks(tasks.map(task =>
                task._id === taskId ? { ...task, status: newStatus } : task
            ));
        } catch (err) {
            console.error('Failed to update status', err);
        }
    };

    const handleDelete = async (taskId) => {
        if (!window.confirm('Are you sure you want to delete this task?')) return;

        try {
            await tasksAPI.delete(taskId);
            setTasks(tasks.filter(task => task._id !== taskId));
        } catch (err) {
            console.error('Failed to delete task', err);
        }
    };

    const filteredTasks = tasks.filter(task => {
        const matchesFilter = filter === 'all' || task.status === filter;
        const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (task.assigneeEmail && task.assigneeEmail.toLowerCase().includes(searchTerm.toLowerCase()));
        return matchesFilter && matchesSearch;
    });

    const getStatusClass = (status) => {
        const statusMap = {
            'Pending': 'status-pending',
            'In Progress': 'status-progress',
            'inprogress': 'status-progress',
            'Completed': 'status-completed',
            'completed': 'status-completed',
        };
        return statusMap[status] || 'status-pending';
    };

    if (loading) {
        return (
            <div className="page-layout">
                <Navbar />
                <main className="page-main">
                    <div className="loading-container">
                        <div className="spinner"></div>
                        <p>Loading tasks...</p>
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
                        <h1>Tasks</h1>
                        <p className="page-subtitle">Manage and track all tasks</p>
                    </div>
                    {(isAdmin || isSubadmin) && (
                        <Link to="/assign" className="btn btn-primary">
                            <i className="fas fa-plus"></i> New Task
                        </Link>
                    )}
                </div>

                <div className="tasks-controls">
                    <div className="search-box">
                        <i className="fas fa-search"></i>
                        <input
                            type="text"
                            placeholder="Search tasks..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="filter-tabs">
                        {['all', 'Pending', 'In Progress', 'Completed'].map(status => (
                            <button
                                key={status}
                                className={`filter-tab ${filter === status ? 'active' : ''}`}
                                onClick={() => setFilter(status)}
                            >
                                {status === 'all' ? 'All' : status}
                            </button>
                        ))}
                    </div>
                </div>

                {error && <div className="error-banner">{error}</div>}

                <div className="tasks-table-container">
                    {filteredTasks.length === 0 ? (
                        <div className="empty-state">
                            <i className="fas fa-inbox"></i>
                            <h3>No tasks found</h3>
                            <p>Create a new task to get started</p>
                        </div>
                    ) : (
                        <table className="tasks-table">
                            <thead>
                                <tr>
                                    <th>Title</th>
                                    <th>Assignee</th>
                                    <th>Status</th>
                                    <th>Due Date</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTasks.map(task => (
                                    <tr key={task._id}>
                                        <td>
                                            <Link to={`/tasks/${task._id}`} className="task-title-link">
                                                {task.title}
                                            </Link>
                                            {task.description && (
                                                <p className="task-description-preview">
                                                    {task.description.substring(0, 60)}...
                                                </p>
                                            )}
                                        </td>
                                        <td>
                                            <span className="assignee-badge">
                                                {task.assigneeEmail || task.teamName || 'Unassigned'}
                                            </span>
                                        </td>
                                        <td>
                                            <select
                                                className={`status-select ${getStatusClass(task.status)}`}
                                                value={task.status}
                                                onChange={(e) => handleStatusChange(task._id, e.target.value)}
                                            >
                                                <option value="Pending">Pending</option>
                                                <option value="In Progress">In Progress</option>
                                                <option value="Completed">Completed</option>
                                            </select>
                                        </td>
                                        <td>
                                            {task.endDate ? new Date(task.endDate).toLocaleDateString() : '-'}
                                        </td>
                                        <td>
                                            <div className="action-buttons">
                                                <Link to={`/tasks/${task._id}`} className="action-btn view">
                                                    <i className="fas fa-eye"></i>
                                                </Link>
                                                {(isAdmin || isSubadmin) && (
                                                    <>
                                                        <Link to={`/tasks/${task._id}/edit`} className="action-btn edit">
                                                            <i className="fas fa-edit"></i>
                                                        </Link>
                                                        <button
                                                            className="action-btn delete"
                                                            onClick={() => handleDelete(task._id)}
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

export default Tasks;
