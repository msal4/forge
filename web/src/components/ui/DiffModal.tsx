import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Plus, Minus } from 'lucide-react';

interface DiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  oldText: string;
  newText: string;
}

// Simple line-based diff algorithm
function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const result: DiffLine[] = [];

  // Use a simple LCS-based approach for better diffs
  const lcs = computeLCS(oldLines, newLines);
  
  let oldIdx = 0;
  let newIdx = 0;
  let lcsIdx = 0;

  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    if (lcsIdx < lcs.length && oldIdx < oldLines.length && oldLines[oldIdx] === lcs[lcsIdx]) {
      // This line is in LCS, it's unchanged
      if (newIdx < newLines.length && newLines[newIdx] === lcs[lcsIdx]) {
        result.push({ type: 'unchanged', content: oldLines[oldIdx] });
        oldIdx++;
        newIdx++;
        lcsIdx++;
      } else {
        // New line was added before this unchanged line
        result.push({ type: 'added', content: newLines[newIdx] });
        newIdx++;
      }
    } else if (oldIdx < oldLines.length && (lcsIdx >= lcs.length || oldLines[oldIdx] !== lcs[lcsIdx])) {
      // Old line was removed
      result.push({ type: 'removed', content: oldLines[oldIdx] });
      oldIdx++;
    } else if (newIdx < newLines.length) {
      // New line was added
      result.push({ type: 'added', content: newLines[newIdx] });
      newIdx++;
    }
  }

  return result;
}

// Compute Longest Common Subsequence
function computeLCS(a: string[], b: string[]): string[] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find LCS
  const lcs: string[] = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      lcs.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return lcs;
}

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
}

export function DiffModal({ isOpen, onClose, title, oldText, newText }: DiffModalProps) {
  const { t } = useTranslation();
  const diffLines = useMemo(() => computeDiff(oldText, newText), [oldText, newText]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Count changes
  const addedCount = diffLines.filter(l => l.type === 'added').length;
  const removedCount = diffLines.filter(l => l.type === 'removed').length;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-lapis-900/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative bg-parchment-50 rounded-lg shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-parchment-200">
          <div>
            <h3 className="text-lg font-semibold text-lapis-700">{title}</h3>
            <div className="flex items-center gap-4 mt-1 text-sm">
              <span className="flex items-center gap-1 text-green-600">
                <Plus size={14} />
                {addedCount} {t('history.diff.added')}
              </span>
              <span className="flex items-center gap-1 text-red-600">
                <Minus size={14} />
                {removedCount} {t('history.diff.removed')}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-lapis-400 hover:text-lapis-600 hover:bg-parchment-200 rounded-tablet transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Diff content */}
        <div className="flex-1 overflow-auto p-4">
          <div className="font-mono text-sm rounded-lg border border-parchment-200 overflow-hidden">
            {diffLines.length === 0 ? (
              <div className="p-4 text-center text-lapis-400">{t('history.diff.noChanges')}</div>
            ) : (
              diffLines.map((line, idx) => (
                <DiffLineRow key={idx} line={line} lineNumber={idx + 1} />
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-parchment-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-parchment-200 text-lapis-600 rounded-tablet hover:bg-parchment-300 transition-colors"
          >
            {t('history.diff.close')}
          </button>
        </div>
      </div>
    </div>
  );
}

function DiffLineRow({ line, lineNumber }: { line: DiffLine; lineNumber: number }) {
  const bgColor = {
    added: 'bg-green-100',
    removed: 'bg-red-100',
    unchanged: 'bg-parchment-50',
  }[line.type];

  const textColor = {
    added: 'text-green-800',
    removed: 'text-red-800',
    unchanged: 'text-lapis-600',
  }[line.type];

  const prefix = {
    added: '+',
    removed: '-',
    unchanged: ' ',
  }[line.type];

  const prefixColor = {
    added: 'text-green-600',
    removed: 'text-red-600',
    unchanged: 'text-lapis-300',
  }[line.type];

  return (
    <div className={`flex ${bgColor} border-b border-parchment-200 last:border-b-0`}>
      <div className="w-12 flex-shrink-0 px-2 py-1 text-right text-lapis-400 bg-parchment-100 border-r border-parchment-200 select-none">
        {lineNumber}
      </div>
      <div className={`w-6 flex-shrink-0 px-1 py-1 text-center ${prefixColor} select-none`}>
        {prefix}
      </div>
      <div className={`flex-1 px-2 py-1 ${textColor} whitespace-pre-wrap break-all`}>
        {line.content || '\u00A0'}
      </div>
    </div>
  );
}

export default DiffModal;
