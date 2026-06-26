import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check } from 'lucide-react';
import type { Issue } from '../../api/issues';

// ============================================
// Issue ID Badge
// Shows the human-readable issue id (e.g. FORGE-1)
// and copies it to the clipboard on click.
// ============================================

interface IssueIdBadgeProps {
  issue: Pick<Issue, 'projectKey' | 'issueNumber'>;
  className?: string;
  iconSize?: number;
}

export function IssueIdBadge({ issue, className = '', iconSize = 12 }: IssueIdBadgeProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  // Guard: create flow / missing data — nothing to show.
  if (!issue.projectKey || !issue.issueNumber) return null;

  const issueId = `${issue.projectKey}-${issue.issueNumber}`;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(issueId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can fail silently (e.g. insecure context); no-op.
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? t('issueId.copied') : t('issueId.copy')}
      aria-label={copied ? t('issueId.copied') : t('issueId.copy')}
      className={`
        group/id inline-flex items-center gap-1 font-mono tracking-tight
        text-lapis-500 dark:text-parchment-400
        hover:text-lapis-700 dark:hover:text-parchment-200
        transition-colors cursor-pointer
        ${className}
      `}
    >
      <span>{issueId}</span>
      {copied ? (
        <Check size={iconSize} className="text-green-600 dark:text-green-400" />
      ) : (
        <Copy size={iconSize} className="opacity-0 group-hover/id:opacity-100 transition-opacity" />
      )}
    </button>
  );
}
