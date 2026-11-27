import { useState } from 'react';
import toast from 'react-hot-toast';
import get from 'lodash/get';
import { useDispatch, useSelector, useStore } from 'react-redux';
import {
  IconFolder,
  IconPlus,
  IconDeviceLaptop
} from '@tabler/icons';

import { newHttpRequest } from 'providers/ReduxStore/slices/collections/actions';
import { openImportApplicationDialog } from 'providers/ReduxStore/slices/open-collection-modal/actions';
import { savePreferences, setIsCreatingCollection } from 'providers/ReduxStore/slices/app';
import { flattenItems, isItemTransientRequest } from 'utils/collections';
import { selectCollections, selectActiveWorkspace } from 'src/selectors/collections';
import { sanitizeName } from 'utils/common/regex';
import { useHostname } from 'utils/hostname';
import filter from 'lodash/filter';

import MenuDropdown from 'ui/MenuDropdown';
import ActionIcon from 'ui/ActionIcon';
import CreateCollection from 'components/Sidebar/CreateCollection';
import WelcomeModal from 'components/WelcomeModal';
import Collections from 'components/Sidebar/Collections';
import SidebarSection from 'components/Sidebar/SidebarSection';

const CollectionsSection = () => {
  const dispatch = useDispatch();
  const activeWorkspace = useSelector(selectActiveWorkspace);
  const hostname = useHostname();

  const store = useStore();
  const isCreatingCollection = useSelector((state) => state.app.isCreatingCollection);
  const preferences = useSelector((state) => state.app.preferences);

  const [createCollectionModalOpen, setCreateCollectionModalOpen] = useState(false);
  const [advancedCreateName, setAdvancedCreateName] = useState('');

  // Default to true (don't show modal) so that:
  // 1. Existing users who upgrade (no hasSeenWelcomeModal in their prefs) don't see it
  // 2. The modal doesn't flash before preferences are loaded from the electron process
  // Only genuinely new users will have hasSeenWelcomeModal explicitly set to false by onboarding
  const hasSeenWelcomeModal = get(preferences, 'onboarding.hasSeenWelcomeModal', true);
  const showWelcomeModal = !hasSeenWelcomeModal;

  const handleDismissWelcomeModal = () => {
    const updatedPreferences = {
      ...preferences,
      onboarding: {
        ...preferences.onboarding,
        hasSeenWelcomeModal: true
      }
    };
    dispatch(savePreferences(updatedPreferences)).catch(() => {
      toast.error('Failed to save preferences');
    });
  };

  const handleOpenCollection = () => {
    dispatch(openImportApplicationDialog());
  };

  const handleStartRequest = () => {
    const scratchCollectionUid = activeWorkspace?.scratchCollectionUid;
    if (!scratchCollectionUid) {
      toast.error('Unable to create request');
      return;
    }

    const scratchCollection = selectCollections(store.getState()).find((c) => c.uid === scratchCollectionUid);
    if (!scratchCollection) {
      toast.error('Unable to create request');
      return;
    }

    const allItems = flattenItems(scratchCollection.items || []);
    const transientRequests = filter(allItems, (item) => isItemTransientRequest(item));
    let maxNumber = 0;
    transientRequests.forEach((item) => {
      const match = item.name?.match(/^Untitled (\d+)$/);
      if (match) {
        const number = parseInt(match[1], 10);
        if (number > maxNumber) {
          maxNumber = number;
        }
      }
    });
    const requestName = `Untitled ${maxNumber + 1}`;
    const filename = sanitizeName(requestName);

    dispatch(
      newHttpRequest({
        requestName,
        filename,
        requestType: 'http-request',
        requestUrl: '',
        requestMethod: 'GET',
        collectionUid: scratchCollectionUid,
        itemUid: null,
        isTransient: true
      })
    ).catch((err) => {
      toast.error('An error occurred while creating the request');
    });
  };

  const handleOpenAdvancedCreate = (name) => {
    dispatch(setIsCreatingCollection(false));
    setAdvancedCreateName(name || '');
    setCreateCollectionModalOpen(true);
  };

  const addDropdownItems = [
    {
      id: 'create',
      leftSection: IconPlus,
      label: 'Create application',
      onClick: () => {
        setCreateCollectionModalOpen(true);
      }
    },
    {
      id: 'open',
      leftSection: IconFolder,
      label: 'Import application',
      onClick: () => {
        handleOpenCollection();
      }
    }
  ];

  const sectionActions = (
    <>
      <MenuDropdown
        data-testid="collections-header-add-menu"
        items={addDropdownItems}
        placement="bottom-end"
      >
        <ActionIcon
          label="Add new application"
        >
          <IconPlus size={14} stroke={1.5} aria-hidden="true" />
        </ActionIcon>
      </MenuDropdown>
    </>
  );

  return (
    <>
      {showWelcomeModal && (
        <WelcomeModal
          onDismiss={handleDismissWelcomeModal}
          onCreateCollection={() => {
            handleDismissWelcomeModal();
            setCreateCollectionModalOpen(true);
          }}
          onOpenCollection={() => {
            handleDismissWelcomeModal();
            handleOpenCollection();
          }}
          onStartRequest={() => {
            handleDismissWelcomeModal();
            handleStartRequest();
          }}
        />
      )}
      {createCollectionModalOpen && (
        <CreateCollection
          onClose={() => {
            setCreateCollectionModalOpen(false);
            setAdvancedCreateName('');
          }}
          initialCollectionName={advancedCreateName}
        />
      )}
      <SidebarSection
        id="collections"
        title={hostname || 'Applications'}
        icon={IconDeviceLaptop}
        actions={sectionActions}
      >
        <Collections
          isCreatingCollection={isCreatingCollection}
          onCreateClick={() => dispatch(setIsCreatingCollection(true))}
          onDismissCreate={() => dispatch(setIsCreatingCollection(false))}
          onOpenAdvancedCreate={handleOpenAdvancedCreate}
        />
      </SidebarSection>
    </>
  );
};

export default CollectionsSection;
