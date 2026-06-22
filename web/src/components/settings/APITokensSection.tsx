import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Key, Plus, Copy, Check, Trash2, AlertCircle } from 'lucide-react';
import { LoadingIndicator } from '../ui/LoadingIndicator';
import { useConfirmDialog } from '../ui/ConfirmDialog';
import { apiTokensApi, type APIToken } from '../../api/tokens';

export function APITokensSection() {
  const { t } = useTranslation();
  const { confirm, DialogComponent } = useConfirmDialog();

  const [tokens, setTokens] = useState<APIToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [newTokenName, setNewTokenName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokingId, setRevokingId] = useState<number | null>(null);

  const loadTokens = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await apiTokensApi.list();
      setTokens(data);
    } catch {
      setError(t('settings.apiTokensLoadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadTokens();
  }, [loadTokens]);

  const handleCreate = async () => {
    const name = newTokenName.trim();
    if (!name) return;

    setIsCreating(true);
    setError('');
    try {
      const result = await apiTokensApi.create(name);
      setCreatedSecret(result.secret);
      setNewTokenName('');
      setTokens((prev) => [result.token, ...prev]);
    } catch {
      setError(t('settings.apiTokensCreateFailed'));
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopySecret = async () => {
    if (!createdSecret) return;
    try {
      await navigator.clipboard.writeText(createdSecret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(t('settings.apiTokensCopyFailed'));
    }
  };

  const handleRevoke = async (token: APIToken) => {
    const confirmed = await confirm({
      title: t('settings.apiTokensRevokeTitle'),
      message: t('settings.apiTokensRevokeMessage', { name: token.name }),
      confirmLabel: t('settings.apiTokensRevokeConfirm'),
      variant: 'danger',
    });
    if (!confirmed) return;

    setRevokingId(token.id);
    setError('');
    try {
      await apiTokensApi.revoke(token.id);
      setTokens((prev) => prev.filter((item) => item.id !== token.id));
    } catch {
      setError(t('settings.apiTokensRevokeFailed'));
    } finally {
      setRevokingId(null);
    }
  };

  const formatDate = (value?: string) => {
    if (!value) return t('settings.apiTokensNeverUsed');
    return new Date(value).toLocaleString();
  };

  return (
    <>
      <div className="tablet-card p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-tablet bg-lapis-100 dark:bg-lapis-800 text-lapis-600 dark:text-parchment-300">
            <Key size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-medium text-lapis-700 dark:text-parchment-200">
              {t('settings.apiTokens')}
            </h2>
            <p className="text-sm text-lapis-500 dark:text-parchment-400 mt-1">
              {t('settings.apiTokensDescription')}
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={newTokenName}
                onChange={(e) => setNewTokenName(e.target.value)}
                placeholder={t('settings.apiTokensNamePlaceholder')}
                maxLength={64}
                className="flex-1 px-4 py-2 rounded-tablet border border-parchment-300 dark:border-lapis-600
                  bg-parchment-100 dark:bg-lapis-800 text-lapis-700 dark:text-parchment-200
                  focus:ring-2 focus:ring-gold-400/30 dark:focus:ring-gold-500/40 focus:outline-none"
              />
              <button
                onClick={handleCreate}
                disabled={isCreating || !newTokenName.trim()}
                className="px-4 py-2 rounded-tablet bg-lapis-600 dark:bg-gold-600 text-white dark:text-lapis-950
                  hover:bg-lapis-700 dark:hover:bg-gold-500 disabled:opacity-50 disabled:cursor-not-allowed
                  transition-colors flex items-center justify-center gap-2"
              >
                {isCreating ? (
                  <LoadingIndicator size="sm" inline />
                ) : (
                  <Plus size={16} />
                )}
                <span>{t('settings.apiTokensCreate')}</span>
              </button>
            </div>

            {createdSecret && (
              <div className="mt-4 p-4 rounded-tablet border border-gold-300 dark:border-gold-600 bg-gold-50 dark:bg-gold-900/20">
                <p className="text-sm font-medium text-lapis-700 dark:text-parchment-200 mb-2">
                  {t('settings.apiTokensCopyOnce')}
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <code className="flex-1 px-3 py-2 rounded bg-parchment-100 dark:bg-lapis-900 text-sm break-all text-lapis-700 dark:text-parchment-200">
                    {createdSecret}
                  </code>
                  <button
                    onClick={handleCopySecret}
                    className="px-4 py-2 rounded-tablet border border-parchment-300 dark:border-lapis-600
                      text-lapis-600 dark:text-parchment-300 hover:bg-parchment-200 dark:hover:bg-lapis-700
                      transition-colors flex items-center justify-center gap-2"
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    <span>{copied ? t('settings.apiTokensCopied') : t('settings.apiTokensCopy')}</span>
                  </button>
                </div>
                <button
                  onClick={() => setCreatedSecret(null)}
                  className="mt-3 text-sm text-lapis-500 dark:text-parchment-400 hover:text-lapis-600 dark:hover:text-parchment-200"
                >
                  {t('settings.apiTokensDismiss')}
                </button>
              </div>
            )}

            {error && (
              <div className="mt-4 flex items-center gap-2 text-sm text-clay-600 dark:text-clay-400">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className="mt-6">
              {isLoading ? (
                <div className="flex justify-center py-4">
                  <LoadingIndicator size="md" inline />
                </div>
              ) :tokens.length === 0 ? (
                <p className="text-sm text-lapis-500 dark:text-parchment-400">
                  {t('settings.apiTokensEmpty')}
                </p>
              ) : (
                <ul className="divide-y divide-parchment-200 dark:divide-lapis-700">
                  {tokens.map((token) => (
                    <li key={token.id} className="py-3 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-medium text-lapis-700 dark:text-parchment-200">{token.name}</p>
                        <p className="text-sm text-lapis-500 dark:text-parchment-400 font-mono">
                          {token.tokenPrefix}…
                        </p>
                        <p className="text-xs text-lapis-400 dark:text-parchment-500 mt-1">
                          {t('settings.apiTokensCreated', {
                            date: new Date(token.createdAt).toLocaleDateString(),
                          })}
                          {' · '}
                          {t('settings.apiTokensLastUsed', { date: formatDate(token.lastUsedAt) })}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRevoke(token)}
                        disabled={revokingId === token.id}
                        className="p-2 rounded-tablet text-clay-600 hover:bg-clay-50 dark:hover:bg-clay-900/20
                          disabled:opacity-50 transition-colors"
                        title={t('settings.apiTokensRevokeConfirm')}
                      >
                        {revokingId === token.id ? (
                          <LoadingIndicator size="sm" inline />
                        ) : (
                          <Trash2 size={16} />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
      {DialogComponent}
    </>
  );
}
