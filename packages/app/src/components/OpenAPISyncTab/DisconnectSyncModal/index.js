import Button from 'ui/Button';
import Modal from 'components/Modal';

const DisconnectSyncModal = ({ onConfirm, onClose }) => {
  return (
    <Modal
      size="sm"
      title="Disconnect Sync"
      hideFooter={true}
      handleCancel={onClose}
    >
      <div className="disconnect-modal">
        <p className="disconnect-message">
          Stop syncing with the OpenAPI spec? Your requests stay as they are.
        </p>
        <div className="disconnect-actions">
          <Button variant="ghost" color="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button color="danger" onClick={onConfirm}>
            Disconnect
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default DisconnectSyncModal;
