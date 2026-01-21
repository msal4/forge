import { Plus, FolderOpen } from 'lucide-react';
import { ButtonWithHotkey } from '../components/ui/HotkeyBadge';

// ============================================
// Docs Page - The Library (Documentation)
// ============================================

export function DocsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-inscription text-lapis-600">
            The Library
          </h1>
          <p className="text-lapis-500 text-sm">
            Scrolls of knowledge, preserved for eternity
          </p>
        </div>
        <ButtonWithHotkey
          variant="primary"
          hotkey="c"
          onClick={() => {/* TODO: Open create modal */}}
        >
          <Plus size={18} />
          New Document
        </ButtonWithHotkey>
      </div>
      
      {/* Document List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Empty state */}
        <div className="md:col-span-2 lg:col-span-3 tablet-card p-8 text-center">
          <FolderOpen className="mx-auto text-lapis-300" size={48} />
          <h3 className="mt-4 font-inscription text-lg text-lapis-600">
            The Library awaits your scrolls
          </h3>
          <p className="mt-2 text-lapis-500 text-sm">
            Create your first document to begin building your knowledge base.
          </p>
          <p className="mt-4 text-xs text-lapis-400">
            Supports Markdown with Mermaid.js diagrams
          </p>
        </div>
      </div>
      
      {/* Features hint */}
      <div className="bg-lapis-500/5 border border-lapis-200 rounded-tablet p-4">
        <h3 className="font-medium text-lapis-600 mb-2">Documentation Features</h3>
        <ul className="text-sm text-lapis-500 space-y-1">
          <li>• Full Markdown support with live preview</li>
          <li>• Mermaid.js diagrams for flowcharts and sequences</li>
          <li>• Hierarchical organization with folders</li>
          <li>• Full-text search across all documents</li>
        </ul>
      </div>
    </div>
  );
}
