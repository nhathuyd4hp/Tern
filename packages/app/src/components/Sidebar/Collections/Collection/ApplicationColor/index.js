import Modal from 'components/Modal';
import ApplicationColorPicker from 'components/ApplicationColorPicker';
import Button from 'ui/Button';
import { getAutomaticApplicationColor, setApplicationColor, useApplicationColor } from 'utils/application-color';
import StyledWrapper from './StyledWrapper';

const ApplicationColor = ({ collection, onClose }) => {
  const current = useApplicationColor(collection);
  const automatic = getAutomaticApplicationColor(collection);

  return (
    <Modal size="md" title="Application color" hideFooter={true} handleCancel={onClose}>
      <StyledWrapper>
        <p className="description">The color of the application and of the collections inside it in the sidebar.</p>
        <ApplicationColorPicker value={current} onChange={(color) => setApplicationColor(collection, color)} />
        <div className="actions">
          <Button type="button" variant="ghost" color="secondary" disabled={current === automatic} onClick={() => setApplicationColor(collection)}>
            Use automatic color
          </Button>
          <Button type="button" onClick={onClose}>Done</Button>
        </div>
      </StyledWrapper>
    </Modal>
  );
};

export default ApplicationColor;
