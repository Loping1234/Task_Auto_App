
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import './KanbanCard.css'; // We'll create this CSS file

const KanbanCard = ({ task }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: task._id, data: { task } });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        touchAction: 'none', // Required for touch devices
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className="board-card kanban-card"
        >
            <h4 className="card-title" style={{ borderColor: task.statusColor }}>{task.title}</h4>
            <div className="card-meta">
                {task.teamName && (
                    <p className="card-team">
                        <i className="fas fa-users"></i> {task.teamName}
                    </p>
                )}
            </div>
            <div className="card-footer">
                <span className="card-assignee">
                    <i className="fas fa-user"></i>
                    {task.assigneeEmail?.split('@')[0] || 'Unassigned'}
                </span>
                {task.endDate && (
                    <span className={`card-due ${new Date(task.endDate) < new Date() ? 'overdue' : ''}`}>
                        <i className="fas fa-calendar"></i>
                        {new Date(task.endDate).toLocaleDateString()}
                    </span>
                )}
            </div>
        </div>
    );
};

export default KanbanCard;
