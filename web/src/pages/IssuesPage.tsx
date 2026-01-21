import React from 'react';
import { Plus } from 'lucide-react';
import { ButtonWithHotkey } from '../components/ui/HotkeyBadge';

// ============================================
// Issues Page - The Tablet (Kanban Board)
// ============================================

// Kanban column statuses matching backend
const COLUMNS = [
  { id: 'to_inscribe', title: 'To Inscribe', subtitle: 'Todo' },
  { id: 'carving', title: 'Carving', subtitle: 'In Progress' },
  { id: 'baked', title: 'Baked', subtitle: 'Done' },
] as const;

export function IssuesPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-inscription text-lapis-600">
            The Tablet
          </h1>
          <p className="text-lapis-500 text-sm">
            Track your inscriptions through the ages
          </p>
        </div>
        <ButtonWithHotkey
          variant="primary"
          hotkey="c"
          onClick={() => {/* TODO: Open create modal */}}
        >
          <Plus size={18} />
          New Issue
        </ButtonWithHotkey>
      </div>
      
      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {COLUMNS.map(column => (
          <KanbanColumn 
            key={column.id} 
            id={column.id} 
            title={column.title}
            subtitle={column.subtitle}
          />
        ))}
      </div>
    </div>
  );
}

// Kanban Column Component
interface KanbanColumnProps {
  id: string;
  title: string;
  subtitle: string;
}

function KanbanColumn({ id, title, subtitle }: KanbanColumnProps) {
  const columnColors: Record<string, string> = {
    to_inscribe: 'border-t-parchment-400',
    carving: 'border-t-clay-400',
    baked: 'border-t-gold-500',
  };
  
  return (
    <div className={`
      tablet-card overflow-hidden
      border-t-4 ${columnColors[id]}
    `}>
      {/* Column Header */}
      <div className="px-4 py-3 bg-parchment-100 border-b border-parchment-200">
        <h3 className="font-inscription text-lapis-600">{title}</h3>
        <p className="text-xs text-lapis-500">{subtitle}</p>
      </div>
      
      {/* Column Content */}
      <div className="p-3 min-h-[200px] space-y-3">
        {/* Placeholder for issues */}
        <div className="text-center py-8 text-lapis-400 text-sm">
          <p>No issues here yet</p>
          <p className="text-xs mt-1">Drag issues here or create new ones</p>
        </div>
      </div>
    </div>
  );
}
