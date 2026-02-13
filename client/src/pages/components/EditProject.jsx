import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { projectsAPI, employeesAPI, subadminsAPI } from '../../api';
import Navbar from '../../components/Navbar';
import '../styles/CreateProject.css';
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

let uidCounter = 1000;
const makeUid = () => `es-${++uidCounter}`;

/* ─── Draggable status row (shared with CreateProject pattern) ─── */
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
            <span className="status-color-dot" style={{ backgroundColor: status.color }}></span>
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

const EditProject = () => {
    const { id } = useParams();
    const { isAdmin } = useAuth();
    const navigate = useNavigate();

    const [formData, setFormData] = useState({ projectName: '', description: '' });
    const [selectedSubadmins, setSelectedSubadmins] = useState([]);
    const [selectedEmployees, setSelectedEmployees] = useState([]);
    const [customStatuses, setCustomStatuses] = useState([]);
    const [newStatus, setNewStatus] = useState({ label: '', color: '#6b7280' });

    const [allSubadmins, setAllSubadmins] = useState([]);
    const [allEmployees, setAllEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchData();
    }, [id]);

    const fetchData = async () => {
        try {
            const [projRes, subRes, empRes] = await Promise.all([
                projectsAPI.getById(id),
                subadminsAPI.getAll(),
                employeesAPI.getAll(),
            ]);

            const proj = projRes.data.project;
            setFormData({ projectName: proj.projectName || '', description: proj.description || '' });
            setSelectedSubadmins((proj.assignedSubadmins || []).map(s => s._id || s));
            setSelectedEmployees((proj.employees || []).map(e => e._id || e));
            setCustomStatuses(
                (proj.customStatuses || []).map(s => ({ ...s, _uid: makeUid() }))
            );

            setAllSubadmins(subRes.data.subadmins || subRes.data || []);
            setAllEmployees(empRes.data.employees || empRes.data || []);
        } catch (err) {
            setError('Failed to load project data');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const toggleSubadmin = (sid) => {
        setSelectedSubadmins(prev =>
            prev.includes(sid) ? prev.filter(s => s !== sid) : [...prev, sid]
        );
    };

    const toggleEmployee = (eid) => {
        setSelectedEmployees(prev =>
            prev.includes(eid) ? prev.filter(e => e !== eid) : [...prev, eid]
        );
    };

    // ── Drag sensors ──
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

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
        if (!formData.projectName.trim()) {
            setError('Project name is required');
            return;
        }

        setSaving(true);
        setError('');
        try {
            // Update basic info & members
            await projectsAPI.update(id, {
                projectName: formData.projectName.trim(),
                description: formData.description.trim(),
                employees: selectedEmployees,
                assignedSubadmins: selectedSubadmins
            });

            // Update statuses (strip _uid before sending)
            const cleanStatuses = customStatuses.map(({ _uid, ...rest }) => rest);
            await projectsAPI.updateStatuses(id, cleanStatuses);

            navigate(`/projects/${id}`);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update project');
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    if (!isAdmin) {
        return (
            <div className="page-layout">
                <Navbar />
                <main className="page-main">
                    <div className="error-banner">Only admins can edit projects.</div>
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
                        <p>Loading project...</p>
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
                        <Link to={`/projects`} className="back-link" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: '0.5rem' }}>
                            <i className="fas fa-arrow-left"></i> Back to Project
                        </Link>
                        <h1>Edit Project</h1>
                        <p className="page-subtitle">Update project details, members and workflow statuses</p>
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
                        {allSubadmins.length === 0 ? (
                            <p className="text-muted">No subadmins available</p>
                        ) : (
                            <div className="member-picker">
                                {allSubadmins.map(sa => (
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
                        {allEmployees.length === 0 ? (
                            <p className="text-muted">No employees available</p>
                        ) : (
                            <div className="member-picker">
                                {allEmployees.map(emp => (
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
                        <p className="text-muted">Drag to reorder status pipeline</p>

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

                    {/* ── Actions ── */}
                    <div className="form-actions">
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => navigate(`/projects/${id}`)}
                        >
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </main>
        </div>
    );
};

export default EditProject;
