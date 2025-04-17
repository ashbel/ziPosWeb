import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { motion } from 'framer-motion';

interface KanbanItem {
  id: string;
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high';
  dueDate?: Date;
}

interface KanbanColumn {
  id: string;
  title: string;
  items: KanbanItem[];
}

interface KanbanBoardProps {
  columns: KanbanColumn[];
  onItemMove: (
    itemId: string,
    sourceColumn: string,
    destinationColumn: string,
    newIndex: number
  ) => void;
}

export const KanbanBoard = ({ columns, onItemMove }: KanbanBoardProps) => {
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const sourceColumn = result.source.droppableId;
    const destinationColumn = result.destination.droppableId;
    const itemId = result.draggableId;
    const newIndex = result.destination.index;

    onItemMove(itemId, sourceColumn, destinationColumn, newIndex);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex space-x-4 overflow-x-auto pb-4">
        {columns.map((column) => (
          <div
            key={column.id}
            className="flex-shrink-0 w-80 bg-gray-100 rounded-lg p-4"
          >
            <h3 className="font-medium mb-4">{column.title}</h3>
            <Droppable droppableId={column.id}>
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="space-y-2"
                >
                  {column.items.map((item, index) => (
                    <Draggable
                      key={item.id}
                      draggableId={item.id}
                      index={index}
                    >
                      {(provided, snapshot) => (
                        <motion.div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          layoutId={item.id}
                          onClick={() => setExpandedItem(
                            expandedItem === item.id ? null : item.id
                          )}
                          className={`bg-white rounded-lg shadow p-4 ${
                            snapshot.isDragging ? 'shadow-lg' : ''
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <h4 className="font-medium">{item.title}</h4>
                            <span
                              className={`px-2 py-1 rounded-full text-xs ${
                                getPriorityColor(item.priority)
                              }`}
                            >
                              {item.priority}
                            </span>
                          </div>
                          
                          {expandedItem === item.id && item.description && (
                            <motion.p
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="mt-2 text-sm text-gray-600"
                            >
                              {item.description}
                            </motion.p>
                          )}
                          
                          {item.dueDate && (
                            <p className="mt-2 text-xs text-gray-500">
                              Due: {new Date(item.dueDate).toLocaleDateString()}
                            </p>
                          )}
                        </motion.div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        ))}
      </div>
    </DragDropContext>
  );
}; 