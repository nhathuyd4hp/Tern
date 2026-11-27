import { IconCheck } from '@tabler/icons';
import { APPLICATION_COLOR_CHOICES } from 'utils/application-color';
import StyledWrapper from './StyledWrapper';

const NEUTRAL_COLOR = '#808080';

/** The swatches of the application colors and a custom color. `value` is the color shown as chosen, none for the automatic one. */
const ApplicationColorPicker = ({ value, onChange }) => (
  <StyledWrapper>
    <div className="swatches" role="radiogroup" aria-label="Application color">
      {APPLICATION_COLOR_CHOICES.map((color) => (
        <button
          type="button"
          key={color}
          role="radio"
          aria-checked={value === color}
          aria-label={color}
          className={`swatch ${value === color ? 'selected' : ''}`}
          style={{ background: color }}
          onClick={() => onChange(color)}
        >
          {value === color && <IconCheck size={16} strokeWidth={3} />}
        </button>
      ))}
    </div>
    <label className="custom-color">
      Custom color
      <input
        type="color"
        value={value || NEUTRAL_COLOR}
        aria-label="Custom color"
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  </StyledWrapper>
);

export default ApplicationColorPicker;
