import React from 'react';
import { Plus, Package, Upload, Download } from 'lucide-react';
import { ButtonWithHotkey } from '../components/ui/HotkeyBadge';

// ============================================
// Releases Page - The Granary (File Storage)
// ============================================

export function ReleasesPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-inscription text-lapis-600">
            The Granary
          </h1>
          <p className="text-lapis-500 text-sm">
            Store and distribute your harvest
          </p>
        </div>
        <ButtonWithHotkey
          variant="primary"
          hotkey="c"
          onClick={() => {/* TODO: Open create modal */}}
        >
          <Plus size={18} />
          New Release
        </ButtonWithHotkey>
      </div>
      
      {/* Releases List */}
      <div className="space-y-4">
        {/* Empty state */}
        <div className="tablet-card p-8 text-center">
          <Package className="mx-auto text-lapis-300" size={48} />
          <h3 className="mt-4 font-inscription text-lg text-lapis-600">
            The Granary is empty
          </h3>
          <p className="mt-2 text-lapis-500 text-sm">
            Create your first release to start distributing artifacts.
          </p>
        </div>
      </div>
      
      {/* Features hint */}
      <div className="bg-lapis-500/5 border border-lapis-200 rounded-tablet p-4">
        <h3 className="font-medium text-lapis-600 mb-2">Release Management</h3>
        <ul className="text-sm text-lapis-500 space-y-1">
          <li className="flex items-center gap-2">
            <Upload size={14} /> Upload binaries, documentation, and other artifacts
          </li>
          <li className="flex items-center gap-2">
            <Download size={14} /> Direct download links for team members
          </li>
          <li className="flex items-center gap-2">
            <Package size={14} /> Semantic versioning with changelogs
          </li>
        </ul>
      </div>
    </div>
  );
}
