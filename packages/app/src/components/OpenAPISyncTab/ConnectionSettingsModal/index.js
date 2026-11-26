import { useState } from 'react';
import toast from 'react-hot-toast';
import Button from 'ui/Button';
import Modal from 'components/Modal';
import { isHttpUrl } from 'utils/url/index';
import { getAbsoluteFilePath } from 'utils/common/path';
import SpecSourcePicker from 'components/OpenAPISyncTab/SpecSourcePicker';
import { isSpecSourceReady } from 'components/OpenAPISyncTab/SpecSourcePicker/utils';
import { MIN_CHECK_INTERVAL_MINUTES } from 'components/OpenAPISyncTab/utils';

const PRESET_INTERVALS = [5, 10, 15, 30, 60];

const toMinutes = (amount, unit) => (unit === 'sec' ? Number((Number(amount) / 60).toFixed(4)) : Number(amount));

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
  const initialInterval = openApiSyncConfig?.autoCheckInterval || 5;
  const [unit, setUnit] = useState(initialInterval < 1 ? 'sec' : 'min');
  const [amount, setAmount] = useState(String(initialInterval < 1 ? Math.round(initialInterval * 60) : initialInterval));
  const [isSaving, setIsSaving] = useState(false);

  const effectiveInterval = toMinutes(amount, unit);
  const isIntervalValid = !autoCheck || effectiveInterval >= MIN_CHECK_INTERVAL_MINUTES;

  const effectiveSource = sources[mode].trim();
  const canSave = isSpecSourceReady(mode, effectiveSource) && isIntervalValid;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({ sourceUrl: effectiveSource, autoCheck, autoCheckInterval: effectiveInterval });
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
      <div className="settings-modal">
        <div className="settings-body">
          <div className="settings-field">
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

          <div className="settings-field">
            <label className="settings-label">Auto-check for updates</label>
            <div className="settings-toggle-row">
              <div className="toggle-info">
                <div className="toggle-description">
                  Automatically check for spec changes at a regular interval
                </div>
              </div>
              <button
                className={`toggle-switch ${autoCheck ? 'active' : ''}`}
                onClick={() => setAutoCheck(!autoCheck)}
                type="button"
              >
                <span className="toggle-knob" />
              </button>
            </div>
          </div>

          {autoCheck && (
            <div className="settings-field">
              <label className="settings-label">Check interval</label>
              <div className="interval-row">
                <span className="interval-prefix">Every</span>
                <input
                  type="number"
                  min="1"
                  data-testid="check-interval-input"
                  className={isIntervalValid ? '' : 'invalid'}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <div className="interval-unit" role="group" aria-label="Interval unit">
                  {['sec', 'min'].map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={unit === option ? 'active' : ''}
                      onClick={() => setUnit(option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
              <div className="interval-buttons">
                {PRESET_INTERVALS.map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    className={unit === 'min' && Number(amount) === mins ? 'active' : ''}
                    onClick={() => {
                      setUnit('min');
                      setAmount(String(mins));
                    }}
                  >
                    {mins} min
                  </button>
                ))}
              </div>
              {!isIntervalValid && <div className="interval-error">Minimum interval is 10 seconds</div>}
            </div>
          )}
        </div>

        <div className="settings-footer">
          <button className="disconnect-link" onClick={onDisconnect} type="button">
            Disconnect sync
          </button>
          <div className="settings-actions">
            <Button variant="ghost" color="secondary" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSave} loading={isSaving} disabled={!canSave || isSaving}>Save</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ConnectionSettingsModal;
