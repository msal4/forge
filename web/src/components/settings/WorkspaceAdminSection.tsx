import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Layers, Users, Check, AlertCircle, UserPlus, Copy, Trash2 } from 'lucide-react';
import { LoadingIndicator } from '../ui/LoadingIndicator';
import {
  useWorkspaces,
  useWorkspaceMembers,
  useAllUsers,
  useCreateWorkspace,
  useSetWorkspaceMembers,
  useInvites,
  useCreateInvite,
  useRevokeInvite,
} from '../../hooks/useApi';
import { useWorkspace } from '../../context/WorkspaceContext';

export function WorkspaceAdminSection() {
  const { t } = useTranslation();
  const { currentWorkspace } = useWorkspace();
  const { data: workspaces = [] } = useWorkspaces();
  const { data: allUsers = [] } = useAllUsers();
  const { data: invites = [], isLoading: invitesLoading } = useInvites();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<number | null>(null);
  const workspaceId = selectedWorkspaceId ?? currentWorkspace?.id ?? null;

  const { data: members = [], isLoading: membersLoading } = useWorkspaceMembers(workspaceId ?? undefined);
  const createWorkspace = useCreateWorkspace();
  const setMembers = useSetWorkspaceMembers();
  const createInvite = useCreateInvite();
  const revokeInvite = useRevokeInvite();

  const [newKey, setNewKey] = useState('');
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviteFullName, setInviteFullName] = useState('');
  const [inviteWorkspaceKeys, setInviteWorkspaceKeys] = useState<string[]>([]);
  const [inviteExpiresInDays, setInviteExpiresInDays] = useState<1 | 2>(2);
  const [createdInviteUrl, setCreatedInviteUrl] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (members.length > 0) {
      setSelectedUserIds(members.map((m) => m.id));
    }
  }, [members, workspaceId]);

  useEffect(() => {
    if (currentWorkspace?.key && inviteWorkspaceKeys.length === 0) {
      setInviteWorkspaceKeys([currentWorkspace.key]);
    }
  }, [currentWorkspace?.key, inviteWorkspaceKeys.length]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setCreatedInviteUrl('');
    try {
      const ws = await createWorkspace.mutateAsync({
        key: newKey.toUpperCase(),
        name: newName,
        description: newDescription,
      });
      setSuccess(t('workspace.created'));
      setNewKey('');
      setNewName('');
      setNewDescription('');
      setSelectedWorkspaceId(ws.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('workspace.createFailed'));
    }
  };

  const handleSaveMembers = async () => {
    if (!workspaceId) return;
    setError('');
    setSuccess('');
    setCreatedInviteUrl('');
    try {
      await setMembers.mutateAsync({ workspaceId, userIds: selectedUserIds });
      setSuccess(t('workspace.membersSaved'));
    } catch {
      setError(t('workspace.membersSaveFailed'));
    }
  };

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setCreatedInviteUrl('');
    try {
      const invite = await createInvite.mutateAsync({
        username: inviteUsername.trim().toLowerCase(),
        fullName: inviteFullName.trim() || undefined,
        workspaceKeys: inviteWorkspaceKeys,
        expiresInDays: inviteExpiresInDays,
      });
      setCreatedInviteUrl(invite.inviteUrl);
      setSuccess(t('invite.created'));
      setInviteUsername('');
      setInviteFullName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('invite.createFailed'));
    }
  };

  const handleCopyInviteLink = async () => {
    if (!createdInviteUrl) return;
    await navigator.clipboard.writeText(createdInviteUrl);
    setSuccess(t('invite.copied'));
  };

  const handleRevokeInvite = async (id: number) => {
    setError('');
    setSuccess('');
    try {
      await revokeInvite.mutateAsync(id);
      setSuccess(t('invite.revoked'));
    } catch {
      setError(t('invite.revokeFailed'));
    }
  };

  const toggleUser = (userId: number) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const toggleInviteWorkspace = (key: string) => {
    setInviteWorkspaceKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  return (
    <div className="tablet-card p-6">
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-tablet bg-gold-100 dark:bg-gold-900/30 text-gold-700 dark:text-gold-400">
          <Layers size={24} />
        </div>
        <div className="flex-1 space-y-6">
          <div>
            <h2 className="text-lg font-inscription text-lapis-600 dark:text-parchment-200">
              {t('workspace.adminTitle')}
            </h2>
            <p className="text-sm text-lapis-500 dark:text-parchment-400 mt-1">
              {t('workspace.adminDescription')}
            </p>
          </div>

          <form onSubmit={handleCreate} className="space-y-3 border-t border-parchment-200 dark:border-lapis-700 pt-4">
            <h3 className="text-sm font-medium text-lapis-600 dark:text-parchment-300">{t('workspace.create')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                value={newKey}
                onChange={(e) => setNewKey(e.target.value.toUpperCase())}
                placeholder={t('workspace.keyPlaceholder')}
                className="px-3 py-2 rounded-tablet border border-parchment-300 dark:border-lapis-600 bg-parchment-100 dark:bg-lapis-800"
                required
              />
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t('workspace.namePlaceholder')}
                className="px-3 py-2 rounded-tablet border border-parchment-300 dark:border-lapis-600 bg-parchment-100 dark:bg-lapis-800"
                required
              />
            </div>
            <input
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder={t('workspace.descriptionPlaceholder')}
              className="w-full px-3 py-2 rounded-tablet border border-parchment-300 dark:border-lapis-600 bg-parchment-100 dark:bg-lapis-800"
            />
            <button
              type="submit"
              disabled={createWorkspace.isPending}
              className="px-4 py-2 rounded-tablet bg-lapis-600 text-white text-sm font-medium hover:bg-lapis-700 disabled:opacity-50"
            >
              {createWorkspace.isPending ? t('common.loading') : t('workspace.createButton')}
            </button>
          </form>

          <form onSubmit={handleCreateInvite} className="space-y-3 border-t border-parchment-200 dark:border-lapis-700 pt-4">
            <h3 className="text-sm font-medium text-lapis-600 dark:text-parchment-300 flex items-center gap-2">
              <UserPlus size={16} />
              {t('invite.adminTitle')}
            </h3>
            <p className="text-xs text-lapis-500 dark:text-parchment-400">{t('invite.adminDescription')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                value={inviteUsername}
                onChange={(e) => setInviteUsername(e.target.value)}
                placeholder={t('invite.usernamePlaceholder')}
                className="px-3 py-2 rounded-tablet border border-parchment-300 dark:border-lapis-600 bg-parchment-100 dark:bg-lapis-800"
                required
              />
              <input
                value={inviteFullName}
                onChange={(e) => setInviteFullName(e.target.value)}
                placeholder={t('invite.fullNamePlaceholder')}
                className="px-3 py-2 rounded-tablet border border-parchment-300 dark:border-lapis-600 bg-parchment-100 dark:bg-lapis-800"
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs text-lapis-500 dark:text-parchment-400">{t('invite.selectWorkspaces')}</p>
              <div className="flex flex-wrap gap-2">
                {workspaces.map((ws) => (
                  <label key={ws.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={inviteWorkspaceKeys.includes(ws.key)}
                      onChange={() => toggleInviteWorkspace(ws.key)}
                      className="rounded border-parchment-400"
                    />
                    <span>{ws.key}</span>
                  </label>
                ))}
              </div>
            </div>
            <select
              value={inviteExpiresInDays}
              onChange={(e) => setInviteExpiresInDays(Number(e.target.value) as 1 | 2)}
              className="px-3 py-2 rounded-tablet border border-parchment-300 dark:border-lapis-600 bg-parchment-100 dark:bg-lapis-800"
            >
              <option value={2}>{t('invite.expiresTwoDays')}</option>
              <option value={1}>{t('invite.expiresOneDay')}</option>
            </select>
            <button
              type="submit"
              disabled={createInvite.isPending || inviteWorkspaceKeys.length === 0}
              className="px-4 py-2 rounded-tablet bg-gold-600 text-white text-sm font-medium hover:bg-gold-700 disabled:opacity-50"
            >
              {createInvite.isPending ? t('common.loading') : t('invite.createButton')}
            </button>
            {createdInviteUrl && (
              <div className="flex items-center gap-2 p-3 rounded-tablet bg-parchment-50 dark:bg-lapis-800 border border-parchment-200 dark:border-lapis-700">
                <code className="text-xs flex-1 break-all text-lapis-700 dark:text-parchment-200">{createdInviteUrl}</code>
                <button
                  type="button"
                  onClick={handleCopyInviteLink}
                  className="p-2 rounded-tablet text-lapis-600 hover:bg-parchment-200 dark:hover:bg-lapis-700"
                  title={t('invite.copyLink')}
                >
                  <Copy size={16} />
                </button>
              </div>
            )}
          </form>

          <div className="space-y-3 border-t border-parchment-200 dark:border-lapis-700 pt-4">
            <h3 className="text-sm font-medium text-lapis-600 dark:text-parchment-300">{t('invite.pendingTitle')}</h3>
            {invitesLoading ? (
              <LoadingIndicator size="sm" inline />
            ) : invites.length === 0 ? (
              <p className="text-sm text-lapis-400 dark:text-parchment-500">{t('invite.nonePending')}</p>
            ) : (
              <div className="space-y-2">
                {invites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-tablet border border-parchment-200 dark:border-lapis-700"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-lapis-700 dark:text-parchment-200">
                        {invite.fullName || invite.username}
                      </p>
                      <p className="text-xs text-lapis-400 dark:text-parchment-500 truncate">
                        {invite.workspaces.map((ws) => ws.key).join(', ')} · {t('invite.expires', { date: new Date(invite.expiresAt).toLocaleString() })}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRevokeInvite(invite.id)}
                      disabled={revokeInvite.isPending}
                      className="p-2 text-clay-600 hover:bg-clay-50 dark:hover:bg-clay-900/20 rounded-tablet"
                      title={t('invite.revoke')}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3 border-t border-parchment-200 dark:border-lapis-700 pt-4">
            <h3 className="text-sm font-medium text-lapis-600 dark:text-parchment-300 flex items-center gap-2">
              <Users size={16} />
              {t('workspace.membersTitle')}
            </h3>
            <select
              value={workspaceId ?? ''}
              onChange={(e) => setSelectedWorkspaceId(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-tablet border border-parchment-300 dark:border-lapis-600 bg-parchment-100 dark:bg-lapis-800"
            >
              {workspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>{ws.name} ({ws.key})</option>
              ))}
            </select>

            {membersLoading ? (
              <LoadingIndicator size="sm" inline />
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {allUsers.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedUserIds.includes(u.id)}
                      onChange={() => toggleUser(u.id)}
                      className="rounded border-parchment-400"
                    />
                    <span>{u.fullName || u.username}</span>
                    <span className="text-lapis-400 dark:text-parchment-500 text-xs">{u.email}</span>
                  </label>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={handleSaveMembers}
              disabled={!workspaceId || setMembers.isPending}
              className="px-4 py-2 rounded-tablet bg-clay-600 text-white text-sm font-medium hover:bg-clay-700 disabled:opacity-50"
            >
              {setMembers.isPending ? t('common.loading') : t('workspace.saveMembers')}
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-clay-600 text-sm">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <Check size={16} />
              <span>{success}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
