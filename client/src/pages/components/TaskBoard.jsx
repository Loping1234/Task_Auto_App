import { useState, useEffect } from 'react';
import {
    DndContext,
    DragOverlay,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    sortableKeyboardCoordinates,
    arrayMove,
} from '@dnd-kit/sortable';

import { tasksAPI } from '../../api';
import { useAuth } from '../../context/AuthContext';
import Navbar from '../../components/Navbar';
import KanbanColumn from '../../components/Kanban/KanbanColumn';
import KanbanCard from '../../components/Kanban/KanbanCard';
import '../styles/TaskBoard.css';

const TaskBoard = () => {
    const { user } = useAuth();
    const [tasks, setTasks] = useState({ pending: [], inProgress: [], completed: [] });
    const [activeId, setActiveId] = useState(null);
    const [activeTask, setActiveTask] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5, // Require slight movement to start drag (prevents accidental clicks)
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    useEffect(() => {
        fetchTasks();
    }, []);

    const fetchTasks = async () => {
        try {
            const response = await tasksAPI.getAll();
            const allTasks = response.data.tasks || response.data;

            // Group tasks by status
            const grouped = {
                pending: allTasks.filter(t => t.status === 'Pending' || t.status === 'N/A'), // Treat N/A as Pending
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

    const findContainer = (id) => {
        if (id in tasks) return id;

        // Find which column contains the task ID
        for (const key of Object.keys(tasks)) {
            if (tasks[key].find(t => t._id === id)) {
                return key;
            }
        }
        return null;
    };

    const handleDragStart = (event) => {
        const { active } = event;
        const id = active.id;
        setActiveId(id);

        // Find the task object for the overlay
        const container = findContainer(id);
        if (container) {
            const task = tasks[container].find(t => t._id === id);
            setActiveTask(task);
        }
    };

    const handleDragOver = (event) => {
        const { active, over } = event;
        const overId = over?.id;

        if (!overId || active.id === overId) return;

        const activeContainer = findContainer(active.id);
        const overContainer = findContainer(overId) || overId; // overId could be the column ID itself

        if (!activeContainer || !overContainer || activeContainer === overContainer) {
            return;
        }

        // Moving between different columns
        setTasks((prev) => {
            const activeItems = prev[activeContainer];
            const overItems = prev[overContainer] || []; // Ensure array exists
            const activeIndex = activeItems.findIndex((t) => t._id === active.id);
            const overIndex = overItems.findIndex((t) => t._id === overId);

            let newIndex;
            if (overId in prev) {
                // We're hovering over a column container (empty or not)
                newIndex = overItems.length + 1;
            } else {
                // We're hovering over another item
                const isBelowOverItem =
                    over &&
                    active.rect.current.translated &&
                    active.rect.current.translated.top >
                    over.rect.top + over.rect.height;

                const modifier = isBelowOverItem ? 1 : 0;
                newIndex = overIndex >= 0 ? overIndex + modifier : overItems.length + 1;
            }

            return {
                ...prev,
                [activeContainer]: [
                    ...prev[activeContainer].filter((item) => item._id !== active.id),
                ],
                [overContainer]: [
                    ...prev[overContainer].slice(0, newIndex),
                    activeItems[activeIndex],
                    ...prev[overContainer].slice(newIndex, prev[overContainer].length),
                ],
            };
        });
    };

    const handleDragEnd = async (event) => {
        const { active, over } = event;
        const activeContainer = findContainer(active.id);
        const overContainer = findContainer(over?.id);

        if (
            !activeContainer ||
            !overContainer ||
            (activeContainer === overContainer && active.id === over.id)
        ) {
            setActiveId(null);
            setActiveTask(null);
            return;
        }

        // If dropped in the same container, just reorder
        if (activeContainer === overContainer) {
            const activeIndex = tasks[activeContainer].findIndex((t) => t._id === active.id);
            const overIndex = tasks[overContainer].findIndex((t) => t._id === over.id);

            if (activeIndex !== overIndex) {
                setTasks((prev) => ({
                    ...prev,
                    [activeContainer]: arrayMove(prev[activeContainer], activeIndex, overIndex),
                }));
            }
        }

        // If dropped in a DIFFERENT container, update the status in Backend
        // (The move already happened in handleDragOver, so we just confirm the API call)

        // Final container is where the item is NOW (after DragOver updates)
        // We need to find where it ended up
        const finalContainer = findContainer(active.id);

        if (finalContainer) {
            const statusMap = {
                pending: 'Pending',
                inProgress: 'In Progress',
                completed: 'Completed',
            };

            const newStatus = statusMap[finalContainer];

            try {
                // Optimistically updated already, just sync API
                await tasksAPI.updateStatus(active.id, newStatus);
            } catch (err) {
                console.error('Failed to update status', err);
                setError('Failed to save status change. Refreshing...');
                fetchTasks(); // Revert
            }
        }

        setActiveId(null);
        setActiveTask(null);
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

                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCorners}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragEnd={handleDragEnd}
                >
                    <div className="board-container">
                        <KanbanColumn
                            id="pending"
                            title="Pending"
                            tasks={tasks.pending}
                            icon="fa-clock"
                            color="#f59e0b"
                        />
                        <KanbanColumn
                            id="inProgress"
                            title="In Progress"
                            tasks={tasks.inProgress}
                            icon="fa-spinner"
                            color="#3b82f6"
                        />
                        <KanbanColumn
                            id="completed"
                            title="Completed"
                            tasks={tasks.completed}
                            icon="fa-check-circle"
                            color="#10b981"
                        />
                    </div>

                    <DragOverlay>
                        {activeTask ? (
                            <div className="drag-overlay-item">
                                <KanbanCard task={{ ...activeTask, statusColor: '#6366f1' }} />
                            </div>
                        ) : null}
                    </DragOverlay>
                </DndContext>
            </main>
        </div>
    );
};

export default TaskBoard;
