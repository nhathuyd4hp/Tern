import ThemeDropdown from './ThemeDropdown';
import { IconPalette } from '@tabler/icons';
import ActionIcon from 'ui/ActionIcon';

// The theme choice, at the end of the row of tabs.
const TabBarActions = () => (
  <div className="flex items-center gap-1 pr-2 ml-auto" data-testid="tab-bar-actions">
    <ThemeDropdown>
      <ActionIcon size="lg" label="Change Theme" data-trigger="theme">
        <IconPalette size={18} strokeWidth={1.5} aria-hidden="true" />
      </ActionIcon>
    </ThemeDropdown>
  </div>
);

export default TabBarActions;
