import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { projectsAPI } from '../../api';
import Navbar from '../../components/Navbar';
import '../styles/Project.css';
import {
    DndContext,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    useSortable,
    horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";


/* ─── Draggable status chip ─── */
const SortableStatusChip = ({ id, label, color }) => {
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
        backgroundColor: color + '20',
        color: color,
        borderColor: color,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 10 : 'auto',
    };

    return (
        <span
            ref={setNodeRef}
            style={style}
            className={`status-chip status-chip-draggable${isDragging ? ' status-chip-dragging' : ''}`}
            {...attributes}
            {...listeners}
        >
            <i className="fas fa-grip-vertical status-grip"></i>
            {label}
        </span>
    );
};

/* ─── Container with DndContext for one project's statuses ─── */
const StatusChipsContainer = ({ projectId, statuses, onReorder }) => {
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
    );

    // Use label+index as unique id since statuses may not have _id
    const items = statuses.map((s, i) => ({ ...s, sortId: `${s.label}-${i}` }));

    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const oldIndex = items.findIndex((s) => s.sortId === active.id);
        const newIndex = items.findIndex((s) => s.sortId === over.id);
        if (oldIndex === -1 || newIndex === -1) return;

        const reordered = arrayMove(statuses, oldIndex, newIndex).map((s, i) => ({
            ...s,
            order: i,
        }));

        onReorder(projectId, reordered);
    };

    return (
        <div className="project-statuses">
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <SortableContext
                    items={items.map((s) => s.sortId)}
                    strategy={horizontalListSortingStrategy}
                >
                    {items.map((s) => (
                        <SortableStatusChip
                            key={s.sortId}
                            id={s.sortId}
                            label={s.label}
                            color={s.color}
                        />
                    ))}
                </SortableContext>
            </DndContext>
        </div>
    );
};


const Project = () => {
    const { isAdmin, isSubadmin } = useAuth();
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchProjects();
    }, []);

    const fetchProjects = async () => {
        try {
            const response = await projectsAPI.getAll();
            setProjects(response.data.projects || response.data);
        } catch (err) {
            setError('Failed to load projects');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id, name) => {
        if (!window.confirm(`Are you sure you want to delete project "${name}"?`)) return;

        try {
            await projectsAPI.delete(id);
            setProjects(projects.filter(p => p._id !== id));
        } catch (err) {
            console.error('Failed to delete project', err);
        }
    };

    /* Optimistic reorder + persist to backend */
    const handleReorderStatuses = async (projectId, reorderedStatuses) => {
        // Optimistic update
        setProjects((prev) =>
            prev.map((p) =>
                p._id === projectId ? { ...p, customStatuses: reorderedStatuses } : p
            )
        );

        try {
            await projectsAPI.updateStatuses(projectId, reorderedStatuses);
        } catch (err) {
            console.error('Failed to save status order', err);
            // Rollback on failure
            fetchProjects();
        }
    };

    if (!isAdmin && !isSubadmin) {
        return (
            <div className="page-layout">
                <Navbar />
                <main className="page-main">
                    <div className="error-banner">You do not have permission to view projects.</div>
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
                        <p>Loading projects...</p>
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
                        <h1>Projects</h1>
                        <p className="page-subtitle">Manage projects, members and tasks</p>
                    </div>
                    {isAdmin && (
                        <Link to="/projects/create" className="btn btn-primary">
                            <i className="fas fa-plus"></i> Create Project
                        </Link>
                    )}
                </div>

                {error && <div className="error-banner">{error}</div>}

                <div className="projects-grid">
                    {projects.length === 0 ? (
                        <div className="empty-state">
                            <i className="fas fa-project-diagram"></i>
                            <h3>No projects found</h3>
                            <p>Create a project to get started</p>
                        </div>
                    ) : (
                        projects.map(proj => (
                            <div key={proj._id} className="project-card">
                                <div className="project-header">
                                    <div className="project-icon">
                                        <i className="fas fa-project-diagram"></i>
                                    </div>
                                    <div>
                                        <h3>{proj.projectName}</h3>
                                        {proj.description && (
                                            <p className="project-description">{proj.description}</p>
                                        )}
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                <div className="project-progress">
                                    <div className="progress-bar-bg">
                                        <div
                                            className="progress-bar-fill"
                                            style={{ width: `${proj.progress || 0}%` }}
                                        ></div>
                                    </div>
                                    <span className="progress-text">{proj.progress || 0}% — {proj.computedStatus || 'N/A'}</span>
                                </div>

                                <div className="project-details">
                                    <p className="project-stat">
                                        <i className="fas fa-tasks"></i>
                                        {proj.tasks?.length || 0} tasks
                                    </p>
                                    <p className="project-stat">
                                        <i className="fas fa-users"></i>
                                        {proj.employees?.length || 0} members
                                    </p>
                                    <p className="project-stat">
                                        <i className="fas fa-user-shield"></i>
                                        {proj.assignedSubadmins?.length || 0} subadmins
                                    </p>
                                </div>

                                {/* Draggable Custom Status Tags */}
                                {proj.customStatuses && proj.customStatuses.length > 0 && (
                                    <StatusChipsContainer
                                        projectId={proj._id}
                                        statuses={proj.customStatuses}
                                        onReorder={handleReorderStatuses}
                                    />
                                )}

                                <div className="project-actions">
                                    <Link to={`/projects/${proj._id}`} className="action-btn view">
                                        <i className="fas fa-eye"></i> View
                                    </Link>
                                    {isAdmin && (
                                        <>
                                            <Link to={`/projects/${proj._id}/edit`} className="action-btn edit">
                                                <i className="fas fa-edit"></i> Edit
                                            </Link>
                                            <button
                                                className="action-btn delete"
                                                onClick={() => handleDelete(proj._id, proj.projectName)}
                                            >
                                                <i className="fas fa-trash"></i> Delete
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </main>
        </div>
    );
};

export default Project;
