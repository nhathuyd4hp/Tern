import { IconBox, IconCopy, IconEdit, IconFolder, IconX, IconTrash } from '@tabler/icons';
import { getRevealInFolderLabel } from 'utils/common/platform';

const API_SPEC_MENU = [
  { id: 'generate-collection', leftSection: IconBox, label: 'Generate Collection' },
  { id: 'clone', leftSection: IconCopy, label: 'Clone' },
  { id: 'rename', leftSection: IconEdit, label: 'Rename' },
  { id: 'reveal', leftSection: IconFolder, label: getRevealInFolderLabel() },
  { id: 'divider-1', type: 'divider' },
  { id: 'remove', leftSection: IconX, label: 'Remove' },
  { id: 'delete', leftSection: IconTrash, label: 'Delete', className: 'delete-item' }
];

export const getApiSpecMenuItems = ({ handlers }) =>
  API_SPEC_MENU.map((item) => (item.type === 'divider' ? item : { ...item, onClick: handlers[item.id] }));
