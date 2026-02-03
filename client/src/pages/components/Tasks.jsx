import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { tasksAPI } from '../../api';
import Navbar from '../../components/Navbar';
import '../styles/Tasks.css';

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
            'N/A': 'status-na',
            'n/a': 'status-na',
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
                        {['all', 'N/A', 'Pending', 'In Progress', 'Completed'].map(status => (
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
                                    <th>Description</th>
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
                                            {/*<Link to={`/tasks/${task._id}`} className="task-title-link">
                                                {task.title}
                                            </Link>*/}
                                            {task.description && (
                                                <p className="task-description-preview">
                                                    {task.description.substring(0, 60)}...
                                                </p>
                                            )}
                                        </td>
                                        <td>
                                            {task.title && (
                                                <p className="task-title-preview">
                                                    {task.title.substring(0, 60)}...
                                                </p>
                                            )}
                                        </td>
                                        <td>
                                            <span className="assignee-badge">
                                                {task.assigneeEmail || task.teamName || 'Unassigned'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="status-stepper">
                                                <button
                                                    className="stepper-btn"
                                                    onClick={() => {
                                                        const statusOrder = ['N/A', 'Pending', 'In Progress', 'Completed'];
                                                        const currentIndex = statusOrder.indexOf(task.status);
                                                        if (currentIndex > 0) {
                                                            handleStatusChange(task._id, statusOrder[currentIndex - 1]);
                                                        }
                                                    }}
                                                    disabled={task.status === 'N/A' || !['N/A', 'Pending', 'In Progress', 'Completed'].includes(task.status)}
                                                    title="Previous Status"
                                                >
                                                    <i className="fas fa-chevron-left"></i>
                                                </button>

                                                <span className={`status-display ${getStatusClass(task.status)}`}>
                                                    {task.status}
                                                </span>

                                                <button
                                                    className="stepper-btn"
                                                    onClick={() => {
                                                        const statusOrder = ['N/A', 'Pending', 'In Progress', 'Completed'];
                                                        const currentIndex = statusOrder.indexOf(task.status);
                                                        if (currentIndex < statusOrder.length - 1 && currentIndex !== -1) {
                                                            handleStatusChange(task._id, statusOrder[currentIndex + 1]);
                                                        }
                                                    }}
                                                    disabled={task.status === 'Completed'}
                                                    title="Next Status"
                                                >
                                                    <i className="fas fa-chevron-right"></i>
                                                </button>
                                            </div>
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
