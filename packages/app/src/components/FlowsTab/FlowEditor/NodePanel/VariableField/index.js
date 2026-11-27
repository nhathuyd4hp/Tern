import { useRef, useState } from 'react';
import StyledWrapper from './StyledWrapper';

// What is being typed after an opening '{{' and before the caret: '{{us' gives 'us'.
const OPEN_BRACES = /\{\{([\w.-]*)$/;

const shorten = (value) => {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > 24 ? `${text.slice(0, 24)}…` : text;
};

// An input (or a textarea) that offers the variables it can use as soon as '{{' is typed.
// `suggestions` is [{ key, name, source, value }]; `onValueChange(text)` gets the new text, typed or completed.
const VariableField = ({ value, onValueChange, suggestions, multiline = false, inputRef, onKeyDown, ...rest }) => {
  const ownRef = useRef(null);
  const field = inputRef || ownRef;
  const [query, setQuery] = useState(null);
  const [active, setActive] = useState(0);

  const readCaret = (element) => {
    const match = OPEN_BRACES.exec(element.value.slice(0, element.selectionStart));
    setQuery(match ? match[1] : null);
    setActive(0);
  };

  const matches = query === null ? [] : suggestions.filter((suggestion) => suggestion.name.toLowerCase().includes(query.toLowerCase()));
  const open = matches.length > 0;

  const pick = (suggestion) => {
    const element = field.current;
    const caret = element.selectionStart;
    const before = element.value.slice(0, caret).replace(OPEN_BRACES, '');
    const rest = element.value.slice(caret);
    const typed = `${before}{{${suggestion.name}}}`;
    onValueChange(`${typed}${rest.startsWith('}}') ? rest.slice(2) : rest}`);
    setQuery(null);
    // the caret goes after the variable once the new text is in the field
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(typed.length, typed.length);
    });
  };

  const handleKeyDown = (event) => {
    if (open) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        setActive((index) => (index + (event.key === 'ArrowDown' ? 1 : matches.length - 1)) % matches.length);
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        pick(matches[active]);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setQuery(null);
        return;
      }
    }
    onKeyDown?.(event);
  };

  const shared = {
    ...rest,
    ref: field,
    value,
    onChange: (event) => {
      onValueChange(event.target.value);
      readCaret(event.target);
    },
    onSelect: (event) => readCaret(event.target),
    onKeyDown: handleKeyDown,
    onBlur: () => setQuery(null)
  };

  return (
    <StyledWrapper>
      {multiline ? <textarea {...shared} /> : <input {...shared} />}
      {open && (
        <ul className="suggestions" role="listbox" aria-label="Variables you can use">
          {matches.map((suggestion, index) => (
            <li
              key={suggestion.key}
              role="option"
              aria-selected={index === active}
              className={index === active ? 'active' : ''}
              onMouseDown={(event) => {
                event.preventDefault();
                pick(suggestion);
              }}
            >
              <code className="suggestion-name">{`{{${suggestion.name}}}`}</code>
              <span className="suggestion-source">{suggestion.source}</span>
              {suggestion.value !== undefined && <span className="suggestion-value">{shorten(suggestion.value)}</span>}
            </li>
          ))}
        </ul>
      )}
    </StyledWrapper>
  );
};

export default VariableField;
