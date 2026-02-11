import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { projectsAPI, employeesAPI, subadminsAPI } from '../../api';
import Navbar from '../../components/Navbar';
import '../styles/CreateProject.css';

const defaultStatuses = [
    { label: 'To Do', order: 1, color: '#6b7280' },
    { label: 'In Progress', order: 2, color: '#f59e0b' },
    { label: 'Done', order: 3, color: '#10b981' },
];

const CreateProject = () => {
    const { isAdmin } = useAuth();
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        projectName: '',
        description: '',
    });
    const [selectedSubadmins, setSelectedSubadmins] = useState([]);
    const [selectedEmployees, setSelectedEmployees] = useState([]);
    const [customStatuses, setCustomStatuses] = useState(defaultStatuses);
    const [newStatus, setNewStatus] = useState({ label: '', color: '#6b7280' });

    const [subadmins, setSubadmins] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const [subRes, empRes] = await Promise.all([
                subadminsAPI.getAll(),
                employeesAPI.getAll(),
            ]);
            setSubadmins(subRes.data.subadmins || subRes.data || []);
            setEmployees(empRes.data.employees || empRes.data || []);
        } catch (err) {
            console.error('Failed to load users', err);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // ── Member selection ──
    const toggleSubadmin = (id) => {
        setSelectedSubadmins(prev =>
            prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
        );
    };

    const toggleEmployee = (id) => {
        setSelectedEmployees(prev =>
            prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
        );
    };

    // ── Custom statuses ──
    const addStatus = () => {
        if (!newStatus.label.trim()) return;
        setCustomStatuses(prev => [
            ...prev,
            { label: newStatus.label.trim(), order: prev.length + 1, color: newStatus.color },
        ]);
        setNewStatus({ label: '', color: '#6b7280' });
    };

    const removeStatus = (index) => {
        setCustomStatuses(prev =>
            prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i + 1 }))
        );
    };

    // ── Submit ──
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!formData.projectName.trim()) {
            setError('Project name is required');
            return;
        }

        setLoading(true);
        try {
            await projectsAPI.create({
                projectName: formData.projectName.trim(),
                description: formData.description.trim(),
                assignedSubadmins: selectedSubadmins,
                employees: selectedEmployees,
                customStatuses,
            });
            navigate('/projects');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create project');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (!isAdmin) {
        return (
            <div className="page-layout">
                <Navbar />
                <main className="page-main">
                    <div className="error-banner">Only admins can create projects.</div>
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
                        <h1>Create Project</h1>
                        <p className="page-subtitle">Set up a new project with members and workflow statuses</p>
                    </div>
                </div>

                {error && <div className="error-banner">{error}</div>}

                <form className="create-project-form" onSubmit={handleSubmit}>
                    {/* ── Basic Info ── */}
                    <div className="form-section">
                        <h3><i className="fas fa-info-circle"></i> Basic Information</h3>
                        <div className="form-group">
                            <label htmlFor="projectName">Project Name *</label>
                            <input
                                id="projectName"
                                name="projectName"
                                type="text"
                                value={formData.projectName}
                                onChange={handleChange}
                                placeholder="e.g. Website Redesign"
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
                                placeholder="Brief project description..."
                                rows={3}
                            />
                        </div>
                    </div>

                    {/* ── Subadmins ── */}
                    <div className="form-section">
                        <h3><i className="fas fa-user-shield"></i> Assign Subadmins</h3>
                        {subadmins.length === 0 ? (
                            <p className="text-muted">No subadmins available</p>
                        ) : (
                            <div className="member-picker">
                                {subadmins.map(sa => (
                                    <label
                                        key={sa._id}
                                        className={`member-option ${selectedSubadmins.includes(sa._id) ? 'selected' : ''}`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedSubadmins.includes(sa._id)}
                                            onChange={() => toggleSubadmin(sa._id)}
                                        />
                                        <span className="member-name">{sa.fullName || sa.email}</span>
                                        <span className="member-email">{sa.email}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ── Employees ── */}
                    <div className="form-section">
                        <h3><i className="fas fa-users"></i> Assign Employees</h3>
                        {employees.length === 0 ? (
                            <p className="text-muted">No employees available</p>
                        ) : (
                            <div className="member-picker">
                                {employees.map(emp => (
                                    <label
                                        key={emp._id}
                                        className={`member-option ${selectedEmployees.includes(emp._id) ? 'selected' : ''}`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedEmployees.includes(emp._id)}
                                            onChange={() => toggleEmployee(emp._id)}
                                        />
                                        <span className="member-name">{emp.fullName || emp.email}</span>
                                        <span className="member-email">{emp.email}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ── Custom Statuses ── */}
                    <div className="form-section">
                        <h3><i className="fas fa-tags"></i> Workflow Statuses</h3>
                        <p className="text-muted">Define the task statuses for this project (drag order = pipeline order)</p>

                        <div className="statuses-list">
                            {customStatuses.map((s, idx) => (
                                <div key={idx} className="status-row">
                                    <span className="status-order">{s.order}</span>
                                    <span
                                        className="status-color-dot"
                                        style={{ backgroundColor: s.color }}
                                    ></span>
                                    <span className="status-label">{s.label}</span>
                                    <button
                                        type="button"
                                        className="status-remove"
                                        onClick={() => removeStatus(idx)}
                                        title="Remove status"
                                    >
                                        <i className="fas fa-times"></i>
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="add-status-row">
                            <input
                                type="text"
                                value={newStatus.label}
                                onChange={e => setNewStatus(prev => ({ ...prev, label: e.target.value }))}
                                placeholder="Status label..."
                            />
                            <input
                                type="color"
                                value={newStatus.color}
                                onChange={e => setNewStatus(prev => ({ ...prev, color: e.target.value }))}
                                title="Pick colour"
                            />
                            <button type="button" className="btn btn-secondary" onClick={addStatus}>
                                <i className="fas fa-plus"></i> Add
                            </button>
                        </div>
                    </div>

                    {/* ── Actions ── */}
                    <div className="form-actions">
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => navigate('/projects')}
                        >
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? 'Creating...' : 'Create Project'}
                        </button>
                    </div>
                </form>
            </main>
        </div>
    );
};

export default CreateProject;
