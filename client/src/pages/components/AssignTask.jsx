import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { tasksAPI, employeesAPI, teamsAPI } from '../../api';
import Navbar from '../../components/Navbar';
import '../styles/AssignTask.css';

const AssignTask = () => {
    const { isAdmin, isSubadmin, isEmployee, user } = useAuth();
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        status: 'N/A',
        assigneeEmail: '', // Will default to user email if employee
        teamName: '',
    });
    const [image, setImage] = useState(null);
    const [employees, setEmployees] = useState([]);
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [assignmentType, setAssignmentType] = useState('employee');

    useEffect(() => {
        fetchData();
        if (isEmployee && user) {
            setFormData(prev => ({ ...prev, assigneeEmail: user.email }));
        }
    }, [isEmployee, user]);

    const fetchData = async () => {
        try {
            const [empRes, teamRes] = await Promise.all([
                employeesAPI.getAll(),
                teamsAPI.getAll(),
            ]);
            setEmployees(empRes.data.employees || empRes.data);
            setTeams(teamRes.data.teams || teamRes.data);
        } catch (err) {
            console.error('Failed to load data', err);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleImageChange = (e) => {
        setImage(e.target.files[0]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const data = new FormData();
            data.append('title', formData.title);
            data.append('description', formData.description);
            data.append('startDate', formData.startDate);
            data.append('endDate', formData.endDate);
            data.append('status', formData.status);

            if (assignmentType === 'employee') {
                data.append('assigneeEmail', formData.assigneeEmail);
            } else {
                data.append('teamName', formData.teamName);
            }

            if (image) {
                data.append('image', image);
            }

            await tasksAPI.create(data);
            navigate('/tasks');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create task');
        } finally {
            setLoading(false);
        }
    };

    // Permission check removed to allow employees to create tasks

    return (
        <div className="page-layout">
            <Navbar />
            <main className="page-main">
                <div className="page-header">
                    <div>
                        <h1>Create New Task</h1>
                        <p className="page-subtitle">Create and assign a task to an employee or team</p>
                    </div>
                </div>

                <div className="form-container">
                    <form onSubmit={handleSubmit} className="task-form">
                        {error && <div className="error-message">{error}</div>}

                        <div className="form-group">
                            <label htmlFor="title">Task Title *</label>
                            <input
                                type="text"
                                id="title"
                                name="title"
                                value={formData.title}
                                onChange={handleChange}
                                placeholder="Enter task title"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="description">Description</label>
                            <textarea
                                id="description"
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                placeholder="Enter task description"
                                rows={4}
                            />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="startDate">Start Date</label>
                                <input
                                    type="date"
                                    id="startDate"
                                    name="startDate"
                                    value={formData.startDate}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="endDate">Due Date</label>
                                <input
                                    type="date"
                                    id="endDate"
                                    name="endDate"
                                    value={formData.endDate}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Status</label>
                            <div className="status-tuner">
                                {['N/A', 'Pending', 'In Progress', 'Completed'].map((status) => (
                                    <button
                                        key={status}
                                        type="button"
                                        className={`tuner-option ${formData.status === status ? 'active' : ''}`}
                                        onClick={() => setFormData(prev => ({ ...prev, status }))}
                                    >
                                        {status}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {assignmentType === 'employee' ? (
                            <div className="form-group">
                                <label htmlFor="assigneeEmail">Select Employee *</label>
                                <select
                                    id="assigneeEmail"
                                    name="assigneeEmail"
                                    value={formData.assigneeEmail}
                                    onChange={handleChange}
                                    required>
                                    <option value="">Choose an employee...</option>
                                    {employees.map(emp => (
                                        <option key={emp.email || emp._id} value={emp.email}>
                                            {emp.name || emp.email}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ) : (
                            <div className="form-group">
                                <label htmlFor="teamName">Select Team *</label>
                                <select
                                    id="teamName"
                                    name="teamName"
                                    value={formData.teamName}
                                    onChange={handleChange}
                                    required>
                                    <option value="">Choose a team...</option>
                                    {teams.map(team => (
                                        <option key={team.teamName || team._id} value={team.teamName}>
                                            {team.teamName}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="form-group">
                            <label htmlFor="image">Attachment (optional)</label>
                            <input
                                type="file"
                                id="image"
                                accept="image/*"
                                onChange={handleImageChange}
                                className="file-input"
                            />
                        </div>

                        <div className="form-actions">
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => navigate(-1)}
                            >
                                Cancel
                            </button>
                            <button type="submit" className="btn btn-primary" enabled={loading}>
                                {loading ? 'Creating...' : 'Create Task'}
                            </button>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    );
};

export default AssignTask;
