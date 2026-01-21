import React from 'react';
import { 
  Plus, 
  Package, 
  Upload, 
  Download, 
  Trash2,
  Loader2,
  RefreshCw,
  X,
  User,
  Calendar,
  HardDrive
} from 'lucide-react';
import { ButtonWithHotkey } from '../components/ui/HotkeyBadge';
import { useKeyboardShortcuts } from '../hooks/useKeyboard';
import { 
  releasesApi, 
  type Release, 
  type ReleaseFile,
  type CreateReleaseRequest 
} from '../api/releases';

// ============================================
// Releases Page - The Granary (File Storage)
// ============================================

export function ReleasesPage() {
  // Data state
  const [releases, setReleases] = React.useState<Release[]>([]);
  const [selectedRelease, setSelectedRelease] = React.useState<Release | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  
  // Upload state
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Load releases
  const loadReleases = React.useCallback(async (signal?: AbortSignal) => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await releasesApi.list({ signal });
      setReleases(data);
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to load releases');
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const controller = new AbortController();
    loadReleases(controller.signal);
    return () => controller.abort();
  }, [loadReleases]);

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      keys: 'c',
      description: 'Create new release',
      handler: () => setIsModalOpen(true),
      category: 'actions',
    },
    {
      keys: 'r',
      description: 'Refresh releases',
      handler: loadReleases,
      category: 'actions',
    },
    {
      keys: 'Escape',
      description: 'Close release details',
      handler: () => setSelectedRelease(null),
      category: 'navigation',
    },
  ]);

  // Create release
  const handleCreateRelease = async (data: CreateReleaseRequest) => {
    setIsSaving(true);
    try {
      const created = await releasesApi.create(data);
      setReleases(prev => [created, ...prev]);
      setIsModalOpen(false);
      setSelectedRelease(created);
    } catch (err) {
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  // Delete release
  const handleDeleteRelease = async (release: Release) => {
    if (!confirm(`Delete release "${release.version}"? This will also delete all associated files.`)) return;
    
    try {
      await releasesApi.delete(release.id);
      setReleases(prev => prev.filter(r => r.id !== release.id));
      if (selectedRelease?.id === release.id) {
        setSelectedRelease(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete release');
    }
  };

  // Upload file
  const handleUploadFile = async (files: FileList | null) => {
    if (!files || files.length === 0 || !selectedRelease) return;

    setIsUploading(true);
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress(`Uploading ${file.name}... (${i + 1}/${files.length})`);
        
        const uploadedFile = await releasesApi.uploadFile(selectedRelease.id, file);
        
        // Update the release with the new file
        setSelectedRelease(prev => prev ? {
          ...prev,
          files: [...prev.files, uploadedFile]
        } : null);
        
        // Update in the list too
        setReleases(prev => prev.map(r => 
          r.id === selectedRelease.id 
            ? { ...r, files: [...r.files, uploadedFile] }
            : r
        ));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload file');
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('de-DE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

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
        <div className="flex items-center gap-2">
          <ButtonWithHotkey
            variant="secondary"
            hotkey="r"
            onClick={() => loadReleases()}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
            Refresh
          </ButtonWithHotkey>
          <ButtonWithHotkey
            variant="primary"
            hotkey="c"
            onClick={() => setIsModalOpen(true)}
          >
            <Plus size={18} />
            New Release
          </ButtonWithHotkey>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-tablet text-red-600">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && releases.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 size={32} className="animate-spin text-lapis-500 mx-auto mb-2" />
            <p className="text-lapis-500">Loading releases...</p>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Releases List */}
        <div className={`space-y-4 ${selectedRelease ? 'lg:col-span-1' : 'lg:col-span-3'}`}>
          {!isLoading && releases.length === 0 && (
            <div className="tablet-card p-8 text-center">
              <Package className="mx-auto text-lapis-300" size={48} />
              <h3 className="mt-4 font-inscription text-lg text-lapis-600">
                The Granary is empty
              </h3>
              <p className="mt-2 text-lapis-500 text-sm">
                Create your first release to start distributing artifacts.
              </p>
            </div>
          )}

          {releases.map(release => (
            <ReleaseCard
              key={release.id}
              release={release}
              isSelected={selectedRelease?.id === release.id}
              onClick={() => setSelectedRelease(release)}
              onDelete={() => handleDeleteRelease(release)}
              formatDate={formatDate}
              formatSize={formatSize}
            />
          ))}
        </div>

        {/* Release Details */}
        {selectedRelease && (
          <div className="lg:col-span-2 tablet-card p-6 space-y-6">
            {/* Details Header */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-code bg-lapis-500 text-parchment-100 px-2 py-0.5 rounded">
                    {selectedRelease.version}
                  </span>
                  <h2 className="text-xl font-inscription text-lapis-600">
                    {selectedRelease.title}
                  </h2>
                </div>
                {selectedRelease.description && (
                  <p className="mt-2 text-lapis-600">{selectedRelease.description}</p>
                )}
                <div className="mt-3 flex items-center gap-4 text-sm text-lapis-500">
                  {selectedRelease.author && (
                    <span className="flex items-center gap-1">
                      <User size={14} />
                      {selectedRelease.author.fullName || selectedRelease.author.username}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar size={14} />
                    {formatDate(selectedRelease.createdAt)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedRelease(null)}
                className="p-1 rounded hover:bg-parchment-200 text-lapis-500"
              >
                <X size={20} />
              </button>
            </div>

            {/* Files Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-lapis-600">Files</h3>
                <label className="cursor-pointer">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => handleUploadFile(e.target.files)}
                    disabled={isUploading}
                  />
                  <ButtonWithHotkey
                    variant="secondary"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Upload size={16} />
                    )}
                    {uploadProgress || 'Upload Files'}
                  </ButtonWithHotkey>
                </label>
              </div>

              {selectedRelease.files.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-parchment-300 rounded-tablet">
                  <HardDrive className="mx-auto text-lapis-300" size={32} />
                  <p className="mt-2 text-sm text-lapis-500">
                    No files yet. Upload your artifacts!
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedRelease.files.map(file => (
                    <FileRow
                      key={file.id}
                      file={file}
                      releaseId={selectedRelease.id}
                      formatSize={formatSize}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Release Modal */}
      <CreateReleaseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleCreateRelease}
        isLoading={isSaving}
      />
    </div>
  );
}

// ============================================
// Release Card Component
// ============================================

interface ReleaseCardProps {
  release: Release;
  isSelected: boolean;
  onClick: () => void;
  onDelete: () => void;
  formatDate: (date: string) => string;
  formatSize: (bytes: number) => string;
}

function ReleaseCard({ release, isSelected, onClick, onDelete, formatDate, formatSize }: ReleaseCardProps) {
  const totalSize = release.files.reduce((acc, f) => acc + f.size, 0);
  
  return (
    <div
      className={`
        tablet-card p-4 cursor-pointer
        transition-all duration-150
        ${isSelected ? 'ring-2 ring-lapis-400' : 'hover:border-lapis-300 hover:shadow-tablet'}
      `}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-tablet bg-gold-100 text-gold-600">
            <Package size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-code bg-lapis-100 text-lapis-600 px-1.5 py-0.5 rounded">
                {release.version}
              </span>
              <h3 className="font-medium text-lapis-600">{release.title}</h3>
            </div>
            <div className="mt-1 flex items-center gap-3 text-xs text-lapis-500">
              <span>{formatDate(release.createdAt)}</span>
              <span>{release.files.length} file{release.files.length !== 1 ? 's' : ''}</span>
              {totalSize > 0 && <span>{formatSize(totalSize)}</span>}
            </div>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-1 rounded hover:bg-red-50 text-lapis-400 hover:text-red-500 opacity-0 group-hover:opacity-100"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

// ============================================
// File Row Component
// ============================================

interface FileRowProps {
  file: ReleaseFile;
  releaseId: number;
  formatSize: (bytes: number) => string;
}

function FileRow({ file, releaseId, formatSize }: FileRowProps) {
  const downloadUrl = releasesApi.getDownloadUrl(releaseId, file.filename);
  
  // Get file icon based on mime type
  const getFileIcon = () => {
    if (file.mimeType.startsWith('image/')) return '🖼️';
    if (file.mimeType.includes('pdf')) return '📄';
    if (file.mimeType.includes('zip') || file.mimeType.includes('tar') || file.mimeType.includes('gz')) return '📦';
    if (file.mimeType.includes('text')) return '📝';
    return '📁';
  };

  return (
    <div className="flex items-center justify-between p-3 bg-parchment-100 rounded-tablet border border-parchment-200">
      <div className="flex items-center gap-3">
        <span className="text-lg">{getFileIcon()}</span>
        <div>
          <p className="font-medium text-sm text-lapis-600">{file.filename}</p>
          <p className="text-xs text-lapis-500">{formatSize(file.size)}</p>
        </div>
      </div>
      <a
        href={downloadUrl}
        download
        className="flex items-center gap-1 px-3 py-1.5 rounded-tablet bg-lapis-500 text-parchment-100 text-sm font-medium hover:bg-lapis-600 transition-colors"
      >
        <Download size={14} />
        Download
      </a>
    </div>
  );
}

// ============================================
// Create Release Modal
// ============================================

interface CreateReleaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CreateReleaseRequest) => Promise<void>;
  isLoading: boolean;
}

function CreateReleaseModal({ isOpen, onClose, onSave, isLoading }: CreateReleaseModalProps) {
  const [version, setVersion] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [error, setError] = React.useState('');
  
  const versionInputRef = React.useRef<HTMLInputElement>(null);

  // Reset form
  React.useEffect(() => {
    if (isOpen) {
      setVersion('');
      setTitle('');
      setDescription('');
      setError('');
      setTimeout(() => versionInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (!version.trim()) {
      setError('Version is required');
      return;
    }
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    try {
      await onSave({
        version: version.trim(),
        title: title.trim(),
        description: description.trim() || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create release');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-lapis-900/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-md bg-parchment-50 rounded-tablet shadow-tablet border border-parchment-300 m-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-parchment-300">
          <h2 className="text-lg font-inscription text-lapis-600">New Release</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-parchment-200 text-lapis-500">
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-tablet text-red-600 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-lapis-600 mb-1">
              Version <span className="text-red-500">*</span>
            </label>
            <input
              ref={versionInputRef}
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="e.g., v1.0.0"
              className="w-full px-3 py-2 rounded-tablet border border-parchment-300 
                         bg-parchment-100 text-lapis-700 font-code
                         focus:border-lapis-400 focus:ring-1 focus:ring-lapis-400 focus:outline-none
                         placeholder:text-lapis-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-lapis-600 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Release title..."
              className="w-full px-3 py-2 rounded-tablet border border-parchment-300 
                         bg-parchment-100 text-lapis-700
                         focus:border-lapis-400 focus:ring-1 focus:ring-lapis-400 focus:outline-none
                         placeholder:text-lapis-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-lapis-600 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Release notes, changelog..."
              rows={3}
              className="w-full px-3 py-2 rounded-tablet border border-parchment-300 
                         bg-parchment-100 text-lapis-700 resize-none
                         focus:border-lapis-400 focus:ring-1 focus:ring-lapis-400 focus:outline-none
                         placeholder:text-lapis-400"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-parchment-300 bg-parchment-100">
          <ButtonWithHotkey variant="ghost" onClick={onClose}>
            Cancel
          </ButtonWithHotkey>
          <ButtonWithHotkey
            variant="primary"
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? 'Creating...' : 'Create Release'}
          </ButtonWithHotkey>
        </div>
      </div>
    </div>
  );
}
