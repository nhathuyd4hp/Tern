import { useState } from 'react';
import toast from 'react-hot-toast';
import Button from 'ui/Button';
import Modal from 'components/Modal';
import { isHttpUrl } from 'utils/url/index';
import { getAbsoluteFilePath } from 'utils/common/path';
import SpecSourcePicker from 'components/OpenAPISyncTab/SpecSourcePicker';
import { isSpecSourceReady } from 'components/OpenAPISyncTab/SpecSourcePicker/utils';
import { formatCheckInterval } from '../utils';
import StyledWrapper from './StyledWrapper';

const INTERVALS = [0.5, 1, 5, 15, 30];

const resolveInitialSource = (sourceUrl, collectionPath) => {
  const source = (sourceUrl || '').trim();
  if (isHttpUrl(source)) {
    return { mode: 'url', sources: { url: source, file: '' } };
  }

  const filePath = source && collectionPath ? getAbsoluteFilePath(collectionPath, source) : source;
  return { mode: 'file', sources: { url: '', file: filePath } };
};

const ConnectionSettingsModal = ({ collection, sourceUrl, onSave, onDisconnect, onClose }) => {
  const openApiSyncConfig = collection?.brunoConfig?.openapi?.[0];
  const [editedSource, setEditedSource] = useState(null);
  const initialSource = resolveInitialSource(sourceUrl, collection?.pathname);
  const { mode, sources } = editedSource || initialSource;
  const editSource = (update) => setEditedSource((current) => update(current || initialSource));
  const [autoCheck, setAutoCheck] = useState(openApiSyncConfig?.autoCheck !== false);
  const [checkInterval, setCheckInterval] = useState(openApiSyncConfig?.autoCheckInterval || 5);
  const [isSaving, setIsSaving] = useState(false);

  const effectiveSource = sources[mode].trim();
  const canSave = isSpecSourceReady(mode, effectiveSource);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({ sourceUrl: effectiveSource, autoCheck, autoCheckInterval: checkInterval, autoApply: autoCheck && openApiSyncConfig?.autoApply === true });
      onClose();
    } catch (_) {
      // caller (handleSaveSettings) already shows a toast on failure
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      size="md"
      title="Connection Settings"
      dataTestId="connection-settings-modal"
      hideFooter={true}
      handleCancel={onClose}
    >
      <StyledWrapper>
        <div className="settings-section">
          <div className="settings-label">Spec Source</div>
          <SpecSourcePicker
            variant="settings"
            mode={mode}
            onModeChange={(nextMode) => editSource((current) => ({ ...current, mode: nextMode }))}
            value={sources[mode]}
            onChange={(value) => editSource((current) => ({
              ...current,
              sources: { ...current.sources, [current.mode]: value }
            }))}
            onError={(message) => message && toast.error(message)}
          />
        </div>

        <div className="settings-section">
          <div className="settings-label" id="auto-check-label">Auto-check for updates</div>
          <div className="settings-toggle-row">
            <div className="toggle-text">
              <span className="settings-hint">Check the spec for changes at a regular interval</span>
            </div>
            <button
              className={`toggle-switch ${autoCheck ? 'active' : ''}`}
              onClick={() => setAutoCheck(!autoCheck)}
              type="button"
              role="switch"
              aria-checked={autoCheck}
              aria-labelledby="auto-check-label"
            >
              <span className="toggle-knob" />
            </button>
          </div>
        </div>

        {autoCheck && (
          <div className="settings-section">
            <div className="settings-label">Check interval</div>
            <div className="interval-buttons">
              {INTERVALS.map((mins) => (
                <button
                  key={mins}
                  type="button"
                  className={checkInterval === mins ? 'active' : ''}
                  onClick={() => setCheckInterval(mins)}
                >
                  {formatCheckInterval(mins)}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="settings-footer">
          <Button variant="ghost" color="danger" size="sm" onClick={onDisconnect}>
            Disconnect sync
          </Button>
          <div className="settings-actions">
            <Button variant="ghost" color="secondary" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSave} loading={isSaving} disabled={!canSave || isSaving}>Save</Button>
          </div>
        </div>
      </StyledWrapper>
    </Modal>
  );
};

export default ConnectionSettingsModal;
