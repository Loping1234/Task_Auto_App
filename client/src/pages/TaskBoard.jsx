import { useState, useEffect } from 'react';
import { tasksAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import './TaskBoard.css';

const TaskBoard = () => {
    const { user } = useAuth();
    const [tasks, setTasks] = useState({ pending: [], inProgress: [], completed: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [draggedTask, setDraggedTask] = useState(null);

    useEffect(() => {
        fetchTasks();
    }, []);

    const fetchTasks = async () => {
        try {
            const response = await tasksAPI.getAll();
            const allTasks = response.data.tasks || response.data;

            const grouped = {
                pending: allTasks.filter(t => t.status === 'Pending'),
                inProgress: allTasks.filter(t => t.status === 'In Progress' || t.status === 'inprogress'),
                completed: allTasks.filter(t => t.status === 'Completed' || t.status === 'completed'),
            };

            setTasks(grouped);
        } catch (err) {
            setError('Failed to load tasks');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDragStart = (e, task, sourceColumn) => {
        setDraggedTask({ task, sourceColumn });
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = async (e, targetColumn) => {
        e.preventDefault();

        if (!draggedTask || draggedTask.sourceColumn === targetColumn) {
            setDraggedTask(null);
            return;
        }

        const { task, sourceColumn } = draggedTask;
        const statusMap = {
            pending: 'Pending',
            inProgress: 'In Progress',
            completed: 'Completed',
        };

        // Optimistic update
        const updatedTasks = { ...tasks };
        updatedTasks[sourceColumn] = updatedTasks[sourceColumn].filter(t => t._id !== task._id);
        updatedTasks[targetColumn] = [...updatedTasks[targetColumn], { ...task, status: statusMap[targetColumn] }];
        setTasks(updatedTasks);

        try {
            await tasksAPI.updateStatus(task._id, statusMap[targetColumn]);
        } catch (err) {
            console.error('Failed to update status', err);
            fetchTasks(); // Revert on error
        }

        setDraggedTask(null);
    };

    if (loading) {
        return (
            <div className="page-layout">
                <Navbar />
                <main className="page-main">
                    <div className="loading-container">
                        <div className="spinner"></div>
                        <p>Loading board...</p>
                    </div>
                </main>
            </div>
        );
    }

    const columns = [
        { id: 'pending', title: 'Pending', icon: 'fa-clock', color: '#f59e0b' },
        { id: 'inProgress', title: 'In Progress', icon: 'fa-spinner', color: '#3b82f6' },
        { id: 'completed', title: 'Completed', icon: 'fa-check-circle', color: '#10b981' },
    ];

    return (
        <div className="page-layout">
            <Navbar />
            <main className="page-main">
                <div className="page-header">
                    <div>
                        <h1>Task Board</h1>
                        <p className="page-subtitle">Drag and drop to update task status</p>
                    </div>
                </div>

                {error && <div className="error-banner">{error}</div>}

                <div className="board-container">
                    {columns.map(column => (
                        <div
                            key={column.id}
                            className="board-column"
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, column.id)}
                        >
                            <div className="column-header" style={{ borderColor: column.color }}>
                                <i className={`fas ${column.icon}`} style={{ color: column.color }}></i>
                                <span>{column.title}</span>
                                <span className="task-count">{tasks[column.id].length}</span>
                            </div>

                            <div className="column-content">
                                {tasks[column.id].map(task => (
                                    <div
                                        key={task._id}
                                        className="board-card"
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, task, column.id)}
                                    >
                                        <h4 className="card-title">{task.title}</h4>
                                        {task.description && (
                                            <p className="card-description">
                                                {task.description.substring(0, 80)}...
                                            </p>
                                        )}
                                        <div className="card-footer">
                                            <span className="card-assignee">
                                                <i className="fas fa-user"></i>
                                                {task.assigneeEmail?.split('@')[0] || task.teamName || 'Unassigned'}
                                            </span>
                                            {task.endDate && (
                                                <span className="card-due">
                                                    <i className="fas fa-calendar"></i>
                                                    {new Date(task.endDate).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {tasks[column.id].length === 0 && (
                                    <div className="column-empty">
                                        <p>No tasks</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
};

export default TaskBoard;
