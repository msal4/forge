import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { LoadingIndicator } from '../components/ui/LoadingIndicator';
import { invitesApi, type InvitePreview } from '../api/invites';

const TOKEN_KEY = 'sarray_token';

export function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setError(t('invite.invalid'));
      setLoading(false);
      return;
    }

    invitesApi
      .preview(token)
      .then(setPreview)
      .catch((err) => {
        setError(err instanceof Error ? err.message : t('invite.invalid'));
      })
      .finally(() => setLoading(false));
  }, [token, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (password.length < 6) {
      setError(t('invite.passwordTooShort'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('invite.passwordMismatch'));
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const result = await invitesApi.accept(token, password);
      if (result.token) {
        localStorage.setItem(TOKEN_KEY, result.token);
      }
      const workspaceKey = preview?.workspaces[0]?.key;
      navigate(workspaceKey ? `/w/${workspaceKey}` : '/', { replace: true });
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('invite.acceptFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-parchment-100 dark:bg-lapis-900">
        <LoadingIndicator size="lg" />
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-parchment-100 dark:bg-lapis-900 p-4">
        <div className="tablet-card p-8 max-w-md w-full text-center">
          <AlertCircle className="mx-auto text-clay-600 mb-4" size={32} />
          <h1 className="text-xl font-inscription text-lapis-700 dark:text-parchment-200 mb-2">
            {t('invite.unavailable')}
          </h1>
          <p className="text-lapis-500 dark:text-parchment-400">{error || t('invite.invalid')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-parchment-100 dark:bg-lapis-900 p-4">
      <div className="tablet-card p-8 max-w-md w-full">
        <h1 className="text-2xl font-inscription text-lapis-700 dark:text-parchment-200 mb-2">
          {t('invite.title')}
        </h1>
        <p className="text-sm text-lapis-500 dark:text-parchment-400 mb-6">
          {t('invite.subtitle', { username: preview.username })}
        </p>

        {preview.workspaces.length > 0 && (
          <div className="mb-6 p-3 rounded-tablet bg-parchment-50 dark:bg-lapis-800 border border-parchment-200 dark:border-lapis-700">
            <p className="text-xs uppercase tracking-wide text-lapis-400 dark:text-parchment-500 mb-2">
              {t('invite.workspaces')}
            </p>
            <ul className="space-y-1">
              {preview.workspaces.map((ws) => (
                <li key={ws.id} className="text-sm text-lapis-700 dark:text-parchment-200">
                  {ws.name} ({ws.key})
                </li>
              ))}
            </ul>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-lapis-600 dark:text-parchment-300 mb-1">
              {t('invite.password')}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 rounded-tablet border border-parchment-300 dark:border-lapis-600 bg-parchment-50 dark:bg-lapis-800"
                required
                minLength={6}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-lapis-400"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-lapis-600 dark:text-parchment-300 mb-1">
              {t('invite.confirmPassword')}
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-tablet border border-parchment-300 dark:border-lapis-600 bg-parchment-50 dark:bg-lapis-800"
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-clay-600 text-sm">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-tablet bg-lapis-600 text-white font-medium hover:bg-lapis-700 disabled:opacity-50"
          >
            {submitting ? t('common.loading') : t('invite.accept')}
          </button>
        </form>
      </div>
    </div>
  );
}
