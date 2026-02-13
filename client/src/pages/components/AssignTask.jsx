import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { tasksAPI, employeesAPI, teamsAPI, projectsAPI } from '../../api';
import Navbar from '../../components/Navbar';
import '../styles/AssignTask.css';
import {
    DndContext,
    closestCenter,
    PointerSensor,
    KeyboardSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    useSortable,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

let uidCounter = 0;
const makeUid = () => `s-${++uidCounter}`;

const defaultStatuses = [
    { _uid: makeUid(), label: 'To Do', order: 1, color: '#6b7280' },
    { _uid: makeUid(), label: 'In Progress', order: 2, color: '#f59e0b' },
    { _uid: makeUid(), label: 'Done', order: 3, color: '#10b981' },
];

const SortableStatusRow = ({ id, status, index, onRemove }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 10 : 'auto',
    };

    return (
        <div ref={setNodeRef} style={style} className={`status-row${isDragging ? ' status-row-dragging' : ''}`}>
            <span className="status-drag-handle" {...attributes} {...listeners}>
                <i className="fas fa-grip-vertical"></i>
            </span>
            <span className="status-order">{status.order}</span>
            <span
                className="status-color-dot"
                style={{ backgroundColor: status.color }}
            ></span>
            <span className="status-label">{status.label}</span>
            <button
                type="button"
                className="status-remove"
                onClick={() => onRemove(index)}
                title="Remove status"
            >
                <i className="fas fa-times"></i>
            </button>
        </div>
    );
};

const AssignTask = () => {
    const { isAdmin, isSubadmin, isEmployee, user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        status: 'N/A',
        assigneeEmail: '',
        teamName: '',
        projectId: location?.state?.projectId || '',
    });
    const [image, setImage] = useState(null);
    const [employees, setEmployees] = useState([]);
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [assignmentType, setAssignmentType] = useState('employee');

    const [projectStatuses, setProjectStatuses] = useState([]);
    const [loadingProject, setLoadingProject] = useState(false);

    const [customStatuses, setCustomStatuses] = useState(defaultStatuses);
    const [newStatus, setNewStatus] = useState({ label: '', color: '#6b7280' });

    useEffect(() => {
        fetchData();
        if (isEmployee && user) {
            setFormData(prev => ({ ...prev, assigneeEmail: user.email }));
        }
    }, [isEmployee, user]);

    // Sync customStatuses when projectStatuses changes
    useEffect(() => {
        if (projectStatuses.length > 0) {
            setCustomStatuses(projectStatuses.map(s => ({
                ...s,
                _uid: makeUid() // Generate UID for Dnd
            })));
        }
    }, [projectStatuses]);

    const fetchData = async () => {
        try {
            const [empRes, teamRes] = await Promise.all([
                employeesAPI.getAll(),
                teamsAPI.getAll(),
            ]);
            setEmployees(empRes.data.employees || empRes.data);
            setTeams(teamRes.data.teams || teamRes.data);

            if (formData.projectId) {
                setLoadingProject(true);
                const projRes = await projectsAPI.getById(formData.projectId);
                const statuses = projRes.data.project.customStatuses || [];
                setProjectStatuses(statuses);
                if (statuses.length > 0) {
                    setFormData(prev => ({ ...prev, status: statuses[0].label }));
                }
                setLoadingProject(false);
            }
        } catch (err) {
            console.error('Failed to load data', err);
            setLoadingProject(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleImageChange = (e) => {
        setImage(e.target.files[0]);
    };

    // ── Dnd Handlers ──
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    // ── Custom statuses ──
    const addStatus = () => {
        if (!newStatus.label.trim()) return;
        setCustomStatuses(prev => [
            ...prev,
            { _uid: makeUid(), label: newStatus.label.trim(), order: prev.length + 1, color: newStatus.color },
        ]);
        setNewStatus({ label: '', color: '#6b7280' });
    };

    const removeStatus = (index) => {
        setCustomStatuses(prev =>
            prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i + 1 }))
        );
    };

    const handleStatusDragEnd = (event) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        setCustomStatuses((prev) => {
            const oldIndex = prev.findIndex((s) => s._uid === active.id);
            const newIndex = prev.findIndex((s) => s._uid === over.id);
            if (oldIndex === -1 || newIndex === -1) return prev;
            return arrayMove(prev, oldIndex, newIndex).map((s, i) => ({ ...s, order: i + 1 }));
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // Update Project Statuses if changed
            if (formData.projectId && customStatuses.length > 0) {
                // Simple check or always update? Let's update to be safe if user tweaked it.
                // We need to map back to API format (remove _uid)
                const cleanStatuses = customStatuses.map(({ _uid, ...rest }) => rest);
                await projectsAPI.updateCustomStatuses(formData.projectId, { customStatuses: cleanStatuses });
            }

            const data = new FormData();
            data.append('title', formData.title);
            data.append('description', formData.description);
            data.append('startDate', formData.startDate);
            data.append('endDate', formData.endDate);
            data.append('status', formData.status); // Use the selected status

            if (assignmentType === 'employee') {
                data.append('assigneeEmail', formData.assigneeEmail);
            } else {
                data.append('teamName', formData.teamName);
            }

            if (formData.projectId) {
                data.append('projectId', formData.projectId);
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
                        {!formData.projectId && (
                            <>
                                <h1>Create New Task</h1>
                                <p className="page-subtitle">Create and assign a task to an employee or team</p>
                            </>
                        )}
                        {formData.projectId && (
                            <>
                                <h1>Create Project Task</h1>
                            </>
                        )}
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

                        {formData.projectId && (
                            <>
                        <div className="form-section">
                            <h3><i className="fas fa-tags"></i> Workflow Statuses</h3>
                            <p className="text-muted">Define the task statuses for this project (drag order = pipeline order)</p>

                            <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={handleStatusDragEnd}
                            >
                                <SortableContext
                                    items={customStatuses.map((s) => s._uid)}
                                    strategy={verticalListSortingStrategy}
                                >
                                    <div className="statuses-list">
                                        {customStatuses.map((s, idx) => (
                                            <SortableStatusRow
                                                key={s._uid}
                                                id={s._uid}
                                                status={s}
                                                index={idx}
                                                onRemove={removeStatus}
                                            />
                                        ))}
                                    </div>
                                </SortableContext>
                            </DndContext>

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
                        </>
                        )}

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
                        
                        {!formData.project && (
                            <>
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

                            </>
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
                            <button type="submit" className="btn btn-primary" disabled={loading}>
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
