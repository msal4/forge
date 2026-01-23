import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useQueryClient } from '@tanstack/react-query';
import { 
  Plus, 
  Package, 
  Upload, 
  Download, 
  Trash2,
  Loader2,
  X,
  User,
  Calendar,
  HardDrive
} from 'lucide-react';
import { ButtonWithHotkey } from '../components/ui/HotkeyBadge';
import { useConfirmDialog } from '../components/ui/ConfirmDialog';
import { useKeyboardShortcuts } from '../hooks/useKeyboard';
import { useReleases, useCreateRelease, useDeleteRelease, useUploadReleaseFile, queryKeys } from '../hooks/useApi';
import { releasesApi, type Release, type ReleaseFile, type CreateReleaseRequest } from '../api/releases';

// ============================================
// Releases Page - The Granary (File Storage)
// ============================================

export function ReleasesPage() {
  const { t } = useTranslation();
  const { releaseId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // React Query hooks
  const { data: releases = [], isLoading, isError, error } = useReleases();
  const createReleaseMutation = useCreateRelease();
  const deleteReleaseMutation = useDeleteRelease();
  const uploadFileMutation = useUploadReleaseFile();
  
  // Local state
  const [selectedRelease, setSelectedRelease] = React.useState<Release | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  // Confirm dialog
  const { confirm, DialogComponent: ConfirmDialogComponent } = useConfirmDialog();

  // Helper to select release and update URL
  const selectRelease = React.useCallback((release: Release | null) => {
    if (release) {
      navigate(`/releases/${release.id}`);
    } else {
      navigate('/releases');
    }
  }, [navigate]);

  // Handle URL param changes for release selection
  React.useEffect(() => {
    if (releaseId && releases.length > 0) {
      const release = releases.find(r => r.id === Number(releaseId));
      if (release) {
        setSelectedRelease(release);
      }
    } else if (!releaseId) {
      setSelectedRelease(null);
    }
  }, [releaseId, releases]);

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      keys: 'c',
      description: 'Create new release',
      handler: () => setIsModalOpen(true),
      category: 'actions',
    },
    {
      keys: 'Escape',
      description: 'Close release details',
      handler: () => selectRelease(null),
      category: 'navigation',
    },
  ]);

  // Create release
  const handleCreateRelease = async (data: CreateReleaseRequest) => {
    const created = await createReleaseMutation.mutateAsync(data);
    setIsModalOpen(false);
    selectRelease(created);
  };

  // Delete release
  const handleDeleteRelease = async (release: Release) => {
    const confirmed = await confirm({
      title: t('common.delete'),
      message: t('releases.deleteConfirm', { version: release.version }),
      confirmLabel: t('common.delete'),
      variant: 'danger',
    });
    if (!confirmed) return;
    
    await deleteReleaseMutation.mutateAsync(release.id);
    if (selectedRelease?.id === release.id) {
      selectRelease(null);
    }
  };

  // Upload file
  const handleUploadFile = async (files: FileList | null) => {
    if (!files || files.length === 0 || !selectedRelease) return;
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress(t('releases.uploading', { name: file.name, current: i + 1, total: files.length }));
      
      await uploadFileMutation.mutateAsync({ releaseId: selectedRelease.id, file });
    }
    
    setUploadProgress(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    // Refresh the selected release from updated data
    queryClient.invalidateQueries({ queryKey: queryKeys.releases.list() });
  };

  // Update selectedRelease when releases data changes (after upload)
  React.useEffect(() => {
    if (selectedRelease && releases.length > 0) {
      const updated = releases.find(r => r.id === selectedRelease.id);
      if (updated) {
        setSelectedRelease(updated);
      }
    }
  }, [releases, selectedRelease?.id]);

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Format date based on current language
  const formatDate = (dateStr: string) => {
    const locale = i18n.language === 'ar' ? 'ar-SA' : 'en-US';
    return new Date(dateStr).toLocaleDateString(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const hasLoaded = releases.length > 0 || !isLoading;
  const isUploading = uploadFileMutation.isPending;
  const isSaving = createReleaseMutation.isPending;

  return (
    <>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-inscription text-lapis-600">
            {t('releases.title')}
          </h1>
          <p className="text-lapis-500 text-sm">
            {t('releases.tagline')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ButtonWithHotkey
            variant="primary"
            hotkey="c"
            onClick={() => setIsModalOpen(true)}
          >
            <Plus size={18} />
            {t('releases.newRelease')}
          </ButtonWithHotkey>
        </div>
      </div>

      {/* Error message */}
      {(isError || deleteReleaseMutation.isError || uploadFileMutation.isError) && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-tablet text-red-600">
          {error instanceof Error ? error.message : 
           deleteReleaseMutation.error instanceof Error ? deleteReleaseMutation.error.message :
           uploadFileMutation.error instanceof Error ? uploadFileMutation.error.message :
           'An error occurred'}
          <button 
            onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.releases.all })} 
            className="ml-2 underline"
          >
            {t('common.retry')}
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && releases.length === 0 && (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-lapis-100 mb-4">
              <span className="text-3xl animate-pulse">𒀭</span>
            </div>
            <p className="text-lapis-500 font-inscription">{t('releases.opening')}</p>
          </div>
        </div>
      )}

      {/* Main content */}
      {hasLoaded && (
        <div className={`grid gap-6 ${selectedRelease ? 'lg:grid-cols-3' : ''}`}>
          {/* Releases List */}
          <div className={`
            space-y-4 
            ${selectedRelease 
              ? 'lg:col-span-1 lg:max-h-[calc(100vh-200px)] lg:overflow-y-auto lg:p-1 lg:-m-1 scrollbar-thin' 
              : ''
            }
          `}>
            {releases.length === 0 && (
              <div className="tablet-card p-8 text-center">
                <Package className="mx-auto text-lapis-300" size={48} />
                <h3 className="mt-4 font-inscription text-lg text-lapis-600">
                  {t('releases.emptyGranary')}
                </h3>
                <p className="mt-2 text-lapis-500 text-sm">
                  {t('releases.emptyGranaryHint')}
                </p>
              </div>
            )}

            {releases.map(release => (
              <ReleaseCard
                key={release.id}
                release={release}
                isSelected={selectedRelease?.id === release.id}
                onClick={() => selectRelease(release)}
                formatDate={formatDate}
                formatSize={formatSize}
              />
            ))}
          </div>

          {/* Release Details */}
          {selectedRelease && (
            <div className="lg:col-span-2 lg:sticky lg:top-4 lg:self-start tablet-card p-6 space-y-6 lg:max-h-[calc(100vh-200px)] lg:overflow-y-auto scrollbar-thin">
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
                    <div className="mt-2 prose-mesopotamian">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedRelease.description}</ReactMarkdown>
                    </div>
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
                  onClick={() => selectRelease(null)}
                  className="p-1 rounded hover:bg-parchment-200 text-lapis-500"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Files Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-lapis-600">{t('releases.files')}</h3>
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
                      {uploadProgress || t('releases.uploadFiles')}
                    </ButtonWithHotkey>
                  </label>
                </div>

                {selectedRelease.files.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-parchment-300 rounded-tablet">
                    <HardDrive className="mx-auto text-lapis-300" size={32} />
                    <p className="mt-2 text-sm text-lapis-500">
                      {t('releases.noFiles')}
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

              {/* Danger Zone */}
              <div className="pt-4 border-t border-parchment-300">
                <button
                  onClick={() => handleDeleteRelease(selectedRelease)}
                  disabled={deleteReleaseMutation.isPending}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-tablet transition-colors disabled:opacity-50"
                >
                  {deleteReleaseMutation.isPending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Trash2 size={16} />
                  )}
                  {t('releases.deleteRelease')}
                </button>
              </div>
            </div>
          )}
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

      {/* Confirm Dialog */}
      {ConfirmDialogComponent}
    </>
  );
}

// ============================================
// Release Card Component
// ============================================

interface ReleaseCardProps {
  release: Release;
  isSelected: boolean;
  onClick: () => void;
  formatDate: (date: string) => string;
  formatSize: (bytes: number) => string;
}

function ReleaseCard({ release, isSelected, onClick, formatDate, formatSize }: ReleaseCardProps) {
  const { t } = useTranslation();
  const totalSize = release.files.reduce((acc, f) => acc + f.size, 0);
  const cardRef = React.useRef<HTMLDivElement>(null);
  
  // Auto-scroll to selected card (position at top)
  React.useEffect(() => {
    if (isSelected && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [isSelected]);
  
  return (
    <div
      ref={cardRef}
      className={`
        tablet-card p-4 cursor-pointer scroll-mt-2
        transition-all duration-150
        ${isSelected 
          ? 'ring-2 ring-lapis-500 bg-lapis-50 border-lapis-400 shadow-tablet' 
          : 'hover:border-lapis-300 hover:shadow-tablet'
        }
      `}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-tablet ${isSelected ? 'bg-lapis-500 text-parchment-100' : 'bg-gold-100 text-gold-600'}`}>
          <Package size={20} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-code px-1.5 py-0.5 rounded ${isSelected ? 'bg-lapis-500 text-parchment-100' : 'bg-lapis-100 text-lapis-600'}`}>
              {release.version}
            </span>
            <h3 className={`font-medium ${isSelected ? 'text-lapis-700' : 'text-lapis-600'}`}>{release.title}</h3>
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-lapis-500">
            <span>{formatDate(release.createdAt)}</span>
            <span>{t('releases.fileCount', { count: release.files.length })}</span>
            {totalSize > 0 && <span>{formatSize(totalSize)}</span>}
          </div>
        </div>
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
  const { t } = useTranslation();
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
        {t('releases.download')}
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
  const { t } = useTranslation();
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
      setError(t('releases.modal.versionRequired'));
      return;
    }
    if (!title.trim()) {
      setError(t('releases.modal.titleRequired'));
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
          <h2 className="text-lg font-inscription text-lapis-600">{t('releases.modal.title')}</h2>
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
              {t('releases.modal.version')} <span className="text-red-500">*</span>
            </label>
            <input
              ref={versionInputRef}
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder={t('releases.modal.versionPlaceholder')}
              className="w-full px-3 py-2 rounded-tablet border border-parchment-300 
                         bg-parchment-100 text-lapis-700 font-code
                         focus:border-lapis-400 focus:ring-1 focus:ring-lapis-400 focus:outline-none
                         placeholder:text-lapis-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-lapis-600 mb-1">
              {t('releases.modal.releaseTitle')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('releases.modal.titlePlaceholder')}
              className="w-full px-3 py-2 rounded-tablet border border-parchment-300 
                         bg-parchment-100 text-lapis-700
                         focus:border-lapis-400 focus:ring-1 focus:ring-lapis-400 focus:outline-none
                         placeholder:text-lapis-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-lapis-600 mb-1">
              {t('releases.modal.description')}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('releases.modal.descriptionPlaceholder')}
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
            {t('common.cancel')}
          </ButtonWithHotkey>
          <ButtonWithHotkey
            variant="primary"
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? t('releases.modal.creating') : t('releases.modal.create')}
          </ButtonWithHotkey>
        </div>
      </div>
    </div>
  );
}
