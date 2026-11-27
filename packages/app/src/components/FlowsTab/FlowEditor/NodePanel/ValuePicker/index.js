import { useMemo } from 'react';
import { IconBraces } from '@tabler/icons';
import MenuDropdown from 'ui/MenuDropdown';
import ActionIcon from 'ui/ActionIcon';
import { getRequestUrlPath } from 'utils/flows';
import { getResponseFields } from 'utils/flows/responseFields';

const MAX_FIELDS_PER_REQUEST = 40;

// Lists what the earlier requests of the flow answer with, to use a value of one of them in this request.
// `upstream` is [{ node, request }]; `onPick({ source: node, field })` is called with the field chosen.
const ValuePicker = ({ upstream, disabled, label = 'Use a value from an earlier request', onPick }) => {
  const groups = useMemo(() => upstream
    .map(({ node, request }) => ({
      node,
      name: `${request.request.method} ${getRequestUrlPath(request)}`,
      // what is inside a list needs a condition to tell its item, which is set where the value is shared
      fields: getResponseFields(request).filter((field) => !field.expression.includes('[0]')).slice(0, MAX_FIELDS_PER_REQUEST)
    }))
    .filter((group) => group.fields.length > 0)
    .map((group) => ({
      name: group.name,
      options: group.fields.map((field) => ({
        id: `${group.node.id}|${field.expression}`,
        label: field.label,
        onClick: () => onPick({ source: group.node, field })
      }))
    })), [upstream, onPick]);

  if (groups.length === 0) return null;

  return (
    <MenuDropdown items={groups} placement="bottom-end" showTickMark={false} groupStyle="select" disabled={disabled}>
      <ActionIcon size="sm" label={label} aria-label={label} disabled={disabled}>
        <IconBraces size={14} strokeWidth={1.75} />
      </ActionIcon>
    </MenuDropdown>
  );
};

export default ValuePicker;
