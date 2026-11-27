import { useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { IconSettings, IconPalette, IconCookie } from '@tabler/icons';
import { addTab } from 'providers/ReduxStore/slices/tabs';
import { selectActiveTab } from 'src/selectors/tab';
import ActionIcon from 'ui/ActionIcon';
import Cookies from 'components/Cookies';
import Portal from 'components/Portal';
import ThemeDropdown from './ThemeDropdown';

// Cookies, the theme choice and Preferences, at the end of the row of tabs.
const TabBarActions = () => {
  const dispatch = useDispatch();
  const activeTab = useSelector(selectActiveTab);
  const activeWorkspace = useSelector((state) => state.workspaces.workspaces.find((w) => w.uid === state.workspaces.activeWorkspaceUid));
  const [cookiesOpen, setCookiesOpen] = useState(false);
  const cookiesButtonRef = useRef(null);

  const openPreferences = () => {
    const collectionUid = activeTab?.collectionUid || activeWorkspace?.scratchCollectionUid;
    dispatch(addTab({
      type: 'preferences',
      uid: collectionUid ? `${collectionUid}-preferences` : 'preferences',
      collectionUid
    }));
  };

  return (
    <div className="flex items-center gap-1 pr-2 ml-auto" data-testid="tab-bar-actions">
      {cookiesOpen && (
        <Portal>
          <Cookies
            onClose={() => {
              setCookiesOpen(false);
              cookiesButtonRef.current?.focus();
            }}
            aria-modal="true"
            role="dialog"
            aria-labelledby="cookies-title"
            aria-describedby="cookies-description"
          />
        </Portal>
      )}
      <ActionIcon ref={cookiesButtonRef} size="lg" label="Open Cookies" onClick={() => setCookiesOpen(true)}>
        <IconCookie size={18} strokeWidth={1.5} aria-hidden="true" />
      </ActionIcon>
      <ThemeDropdown>
        <ActionIcon size="lg" label="Change Theme" data-trigger="theme">
          <IconPalette size={18} strokeWidth={1.5} aria-hidden="true" />
        </ActionIcon>
      </ThemeDropdown>
      <ActionIcon size="lg" label="Open Preferences" data-trigger="preferences" onClick={openPreferences}>
        <IconSettings size={18} strokeWidth={1.5} aria-hidden="true" />
      </ActionIcon>
    </div>
  );
};

export default TabBarActions;
