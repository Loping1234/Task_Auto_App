
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import KanbanCard from './KanbanCard';

const KanbanColumn = ({ id, title, tasks, icon, color }) => {
    const { setNodeRef } = useDroppable({
        id: id,
    });

    return (
        <div className="board-column">
            <div className="column-header">
                <i className={`fas ${icon}`} style={{ color: color }}></i>
                <span>{title}</span>
                <span className="task-count">{tasks.length}</span>
            </div>

            <div ref={setNodeRef} className="column-content">
                <SortableContext
                    id={id}
                    items={tasks.map((t) => t._id)}
                    strategy={verticalListSortingStrategy}
                >
                    {tasks.map((task) => (
                        <KanbanCard key={task._id} task={{ ...task, statusColor: color }} />
                    ))}
                </SortableContext>
                {tasks.length === 0 && (
                    <div className="column-empty">
                        <p>Drop here</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default KanbanColumn;
