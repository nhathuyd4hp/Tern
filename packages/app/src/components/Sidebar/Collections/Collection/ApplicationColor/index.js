import { IconCheck } from '@tabler/icons';
import Modal from 'components/Modal';
import Button from 'ui/Button';
import { APPLICATION_COLOR_CHOICES, getAutomaticApplicationColor, setApplicationColor, useApplicationColor } from 'utils/application-color';
import StyledWrapper from './StyledWrapper';

const ApplicationColor = ({ collection, onClose }) => {
  const current = useApplicationColor(collection);
  const automatic = getAutomaticApplicationColor(collection);

  return (
    <Modal size="md" title="Application color" hideFooter={true} handleCancel={onClose}>
      <StyledWrapper>
        <p className="description">The color of the application and of the collections inside it in the sidebar.</p>
        <div className="swatches" role="radiogroup" aria-label="Application color">
          {APPLICATION_COLOR_CHOICES.map((color) => (
            <button
              type="button"
              key={color}
              role="radio"
              aria-checked={current === color}
              aria-label={color}
              className={`swatch ${current === color ? 'selected' : ''}`}
              style={{ background: color }}
              onClick={() => setApplicationColor(collection, color)}
            >
              {current === color && <IconCheck size={16} strokeWidth={3} />}
            </button>
          ))}
        </div>
        <label className="custom-color">
          Custom color
          <input
            type="color"
            value={current}
            aria-label="Custom color"
            onChange={(event) => setApplicationColor(collection, event.target.value)}
          />
        </label>
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
