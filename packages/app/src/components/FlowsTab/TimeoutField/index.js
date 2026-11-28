import { IconMinus, IconPlus } from '@tabler/icons';
import StyledWrapper from './StyledWrapper';

// A whole number of seconds with buttons to raise and lower it. `value` is a number or undefined (empty);
// `onChange` gets a number, or undefined when the field is emptied.
const TimeoutField = ({ value, placeholder, disabled, onChange, label }) => {
  const step = (delta) => onChange(Math.max(1, (value ?? (Number(placeholder) || 0)) + delta));

  return (
    <StyledWrapper>
      <button type="button" aria-label={`Decrease ${label}`} disabled={disabled || value <= 1} onClick={() => step(-1)}>
        <IconMinus size={12} />
      </button>
      <input
        inputMode="numeric"
        aria-label={label}
        placeholder={placeholder}
        value={value ?? ''}
        disabled={disabled}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, '');
          onChange(digits === '' || Number(digits) < 1 ? undefined : Number(digits));
        }}
      />
      <button type="button" aria-label={`Increase ${label}`} disabled={disabled} onClick={() => step(1)}>
        <IconPlus size={12} />
      </button>
    </StyledWrapper>
  );
};

export default TimeoutField;
