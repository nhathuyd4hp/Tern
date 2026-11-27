import { IconPlus, IconX } from '@tabler/icons';
import Button from 'ui/Button';
import Select from 'ui/Select';
import { WHERE_OPERATORS } from 'utils/flows';
import VariableField from '../VariableField';
import StyledWrapper from './StyledWrapper';

// The conditions that tell which item of a list a value is taken from: the first item that meets all of them.
// `keys` are the fields an item has; `onChange(conditions)` gets the whole list.
const Conditions = ({ conditions, keys, suggestions, disabled, onChange }) => {
  const change = (position, next) => onChange(conditions.map((condition, i) => (i === position ? { ...condition, ...next } : condition)));
  const add = () => onChange([...conditions, { field: keys.find((key) => !conditions.some((condition) => condition.field === key)) || keys[0], value: '' }]);

  return (
    <StyledWrapper data-testid="share-where">
      <span className="conditions-title">Conditions</span>
      {conditions.map((condition, position) => (
        <div key={position} className="condition">
          <div className="condition-row" data-testid="condition-row">
            <Select
              data={keys.map((key) => ({ value: key, label: key }))}
              value={condition.field}
              onChange={(field) => change(position, { field })}
              disabled={disabled}
              aria-label="Field of the item"
            />
            <Select
              data={Object.entries(WHERE_OPERATORS).map(([value, label]) => ({ value, label }))}
              value={condition.op || 'equals'}
              onChange={(op) => change(position, { op })}
              disabled={disabled}
              aria-label="How the field is compared"
            />
            <VariableField
              aria-label="Value of the field"
              placeholder="value or {{variable}}"
              value={condition.value}
              disabled={disabled}
              suggestions={suggestions}
              onValueChange={(value) => change(position, { value })}
            />
            <Button
              size="xs"
              variant="ghost"
              color="secondary"
              disabled={disabled || conditions.length === 1}
              icon={<IconX size={14} />}
              onClick={() => onChange(conditions.filter((_, i) => i !== position))}
              title="Remove condition"
            />
          </div>
          {!condition.value && <div className="condition-error" role="alert">Enter a value for {condition.field}</div>}
        </div>
      ))}
      <Button size="xs" variant="ghost" disabled={disabled} icon={<IconPlus size={14} />} onClick={add}>
        Add condition
      </Button>
    </StyledWrapper>
  );
};

export default Conditions;
