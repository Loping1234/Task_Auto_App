import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { tasksAPI } from '../api';
import Navbar from '../components/Navbar';
import './Tasks.css';

const TeamTasks = () => {
    const { user, isEmployee } = useAuth();
    const [tasks, setTasks] = useState([]);
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isEmployee) {
            fetchTeamTasks();
        }
    }, [isEmployee]);

    const fetchTeamTasks = async () => {
        try {
            const response = await tasksAPI.getTeamTasks();
            setTasks(response.data.tasks || []);
            setTeams(response.data.teams || []);
        } catch (err) {
            setError('Failed to load team tasks');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const getStatusClass = (status) => {
        switch (status?.toLowerCase()) {
            case 'completed': return 'status-completed';
            case 'in progress': return 'status-progress';
            default: return 'status-pending';
        }
    };

    if (!isEmployee) {
        return (
            <div className="page-layout">
                <Navbar />
                <main className="page-main">
                    <div className="error-banner">Team Tasks is only available for employees.</div>
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
                        <p>Loading team tasks...</p>
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
                        <h1>Team Tasks</h1>
                        <p className="page-subtitle">
                            Tasks assigned to your team members
                            {teams.length > 0 && ` (${teams.join(', ')})`}
                        </p>
                    </div>
                </div>

                {error && <div className="error-banner">{error}</div>}

                <div className="tasks-table-card">
                    <table className="tasks-table">
                        <thead>
                            <tr>
                                <th>Title</th>
                                <th>Assigned To</th>
                                <th>Status</th>
                                <th>Deadline</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tasks.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="empty-row">
                                        <i className="fas fa-users"></i>
                                        <p>No team member tasks found</p>
                                    </td>
                                </tr>
                            ) : (
                                tasks.map((task) => (
                                    <tr key={task._id}>
                                        <td>
                                            <Link to={`/tasks/${task._id}`} className="task-title-link">
                                                {task.title}
                                            </Link>
                                        </td>
                                        <td>{task.assigneeEmail || task.teamName || 'Unassigned'}</td>
                                        <td>
                                            <span className={`status-badge ${getStatusClass(task.status)}`}>
                                                {task.status}
                                            </span>
                                        </td>
                                        <td>
                                            {task.endDate ? new Date(task.endDate).toLocaleDateString() : 'N/A'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {tasks.length > 0 && (
                    <div className="help-tip-box">
                        <h6><i className="fas fa-lightbulb"></i> Need to help a teammate?</h6>
                        <p>Use the <Link to="/team-chat">Team Chat</Link> to coordinate with your team members on their tasks.</p>
                    </div>
                )}
            </main>
        </div>
    );
};

export default TeamTasks;
