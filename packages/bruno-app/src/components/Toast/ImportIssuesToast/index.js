import React from 'react';
import toast from 'react-hot-toast';
import { IconCopy, IconX } from '@tabler/icons';
import StyledWrapper from './StyledWrapper';

const ImportIssuesToastContent = ({ t, issues, summary }) => {
  const issuesSummary = issues.map((i) => `[${i.severity.toUpperCase()}] ${i.path} — ${i.message}`).join('\n');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(issuesSummary);
      toast.success('Copied to clipboard', { duration: 2000 });
    } catch (err) {
      toast.error('Failed to copy to clipboard', { duration: 3000 });
    }
  };

  return (
    <StyledWrapper
      data-testid="import-issues-toast"
      style={{
        opacity: t.visible ? 1 : 0,
        transform: t.visible ? 'translateX(0)' : 'translateX(100%)'
      }}
    >
      <div className="toast-accent" />
      <div className="toast-body">
        <button
          type="button"
          className="toast-close"
          aria-label="Close toast"
          data-testid="import-issues-toast-close"
          onClick={() => toast.dismiss(t.id)}
        >
          <IconX size={14} />
        </button>
        <div className="toast-title" data-testid="import-issues-toast-title">Imported with issues: {summary}</div>
        <div className="toast-hint">Use Copy Issues to see which items failed and why.</div>
        <div className="toast-actions">
          <button className="toast-btn" onClick={handleCopy} data-testid="import-issues-copy-btn">
            <IconCopy size={13} />
            Copy Issues
          </button>
        </div>
      </div>
    </StyledWrapper>
  );
};

/**
 * Show an import issues toast in the bottom-right corner.
 * Aggregates all issues into a single toast — does not stack.
 */
let activeImportToastId = null;

export const showImportIssuesToast = (issues) => {
  if (activeImportToastId) {
    toast.dismiss(activeImportToastId);
  }

  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  const parts = [];
  if (errors.length > 0) parts.push(`${errors.length} item(s) skipped`);
  if (warnings.length > 0) parts.push(`${warnings.length} warning(s)`);
  const summary = parts.join(', ');

  activeImportToastId = toast.custom(
    (t) => (
      <ImportIssuesToastContent t={t} issues={issues} summary={summary} />
    ),
    { duration: Infinity, position: 'bottom-right' }
  );

  return activeImportToastId;
};

export default ImportIssuesToastContent;
