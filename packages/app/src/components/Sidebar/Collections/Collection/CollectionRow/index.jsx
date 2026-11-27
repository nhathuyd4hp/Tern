import React, { useState, useRef, useMemo } from 'react';
import classnames from 'classnames';
import { useDrop, useDrag } from 'react-dnd';
import { getEmptyImage } from 'react-dnd-html5-backend';
import {
  IconBox,
  IconPalette,
  IconChevronRight,
  IconDots,
  IconLoader2,
  IconFilePlus,
  IconStack2,
  IconClipboard,
  IconEdit,
  IconFoldDown,
  IconX,
  IconFolder
} from '@tabler/icons';
import { toggleCollection, collapseFullCollection, clearSidebarSelection } from 'providers/ReduxStore/slices/collections';
import { mountCollection, moveCollectionAndPersist, handleMultipleCollectionItemsDrop, pasteItem, showInFolder, saveCollectionSecurityConfig } from 'providers/ReduxStore/slices/collections/actions';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { addTab, makeTabPermanent } from 'providers/ReduxStore/slices/tabs';
import { setFocusedSidebarPath } from 'providers/ReduxStore/slices/app';
import toast from 'react-hot-toast';
import NewRequest from 'components/Sidebar/NewRequest';
import NewFolder from 'components/Sidebar/NewFolder';
import RemoveCollections from '../RemoveCollections';
import { doesCollectionHaveItemsMatchingSearchText } from 'utils/collections/search';
import { getSortedDraggedItems } from 'utils/collections';
import { isTabForItemActive } from 'src/selectors/tab';
import { makeSelectInvalidItemCountForCollection } from 'src/selectors/collections';

import RenameCollection from '../RenameCollection';
import StyledWrapper from './StyledWrapper';
import InvalidFilesBadge from '../InvalidFilesBadge';
import { getRevealInFolderLabel } from 'utils/common/platform';
import ActionIcon from 'ui/ActionIcon';
import MenuDropdown from 'ui/MenuDropdown';
import { useSidebarAccordion } from 'components/Sidebar/SidebarAccordionContext';
import useKeybinding from 'hooks/useKeybinding';
import useKeybindingDisplayText from 'hooks/useKeybindingDisplayText';
import useSidebarSelectionClick from 'hooks/useSidebarSelectionClick';
import { startBlockedDragTracking } from 'utils/dragBlockedCursor';
import { useApplicationColor } from 'utils/application-color';
import ApplicationColor from '../ApplicationColor';

const CollectionRow = ({ collection, searchText, openBulkMenu, children, isCollectionMultiDragDisabled, multiDragCollections }) => {
  const { dropdownContainerRef } = useSidebarAccordion();
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [showNewRequestModal, setShowNewRequestModal] = useState(false);
  const [showRenameCollectionModal, setShowRenameCollectionModal] = useState(false);
  const [showRemoveCollectionModal, setShowRemoveCollectionModal] = useState(false);
  const [dropType, setDropType] = useState(null);
  const [isKeyboardFocused, setIsKeyboardFocused] = useState(false);
  const dispatch = useDispatch();
  const applicationColor = useApplicationColor(collection);
  const [showColorModal, setShowColorModal] = useState(false);
  const isLoading = collection.isLoading;
  const selectInvalidItemCount = useMemo(makeSelectInvalidItemCountForCollection, []);
  const invalidItemCount = useSelector((state) => selectInvalidItemCount(state, collection.uid));
  const collectionRef = useRef(null);

  const selectIsCollectionFocused = useMemo(() => isTabForItemActive({ itemUid: collection.uid }), [collection.uid]);
  const isCollectionFocused = useSelector(selectIsCollectionFocused);
  const { hasCopiedItems } = useSelector((state) => state.app.clipboard);
  const selectedSidebarUids = useSelector((state) => state.collections.selectedSidebarUids);
  const isSelected = selectedSidebarUids.includes(collection.uid);
  const isMultiSelected = isSelected && selectedSidebarUids.length > 1;
  const handleSelectionClick = useSidebarSelectionClick({ uid: collection.uid, searchText });
  const menuDropdownRef = useRef(null);

  const activeWorkspace = useSelector((state) =>
    state.workspaces.workspaces.find((w) => w.uid === state.workspaces.activeWorkspaceUid)
  );
  const workspaces = useSelector((state) => state.workspaces.workspaces);
  const collectionSortOrder = useSelector((state) => state.collections.collectionSortOrder);
  const store = useStore();

  const isDragDisabled = isMultiSelected && isCollectionMultiDragDisabled;
  const multiDragItems = isMultiSelected ? multiDragCollections : null;

  const ensureCollectionIsMounted = () => {
    if (collection.mountStatus === 'mounted' || collection.mountStatus === 'mounting') {
      return;
    }
    dispatch(mountCollection({
      collectionUid: collection.uid,
      collectionPathname: collection.pathname,
      brunoConfig: collection.brunoConfig
    }));
  };

  const hasSearchText = searchText && searchText?.trim()?.length;
  const collectionIsCollapsed = hasSearchText ? false : collection.collapsed;

  const iconClassName = classnames({
    'rotate-90': !collectionIsCollapsed
  });

  const handleClick = (event) => {
    if (handleSelectionClick(event)) return;
    if (event.detail != 1) return;

    // Check if the click came from the chevron icon
    const isChevronClick = event.target.closest('svg')?.classList.contains('chevron-icon');

    ensureCollectionIsMounted();

    if (collection.collapsed) {
      dispatch(toggleCollection(collection.uid));
      // Set default jsSandboxMode to 'safe' if not present and save to disk
      if (!collection.securityConfig?.jsSandboxMode) {
        dispatch(saveCollectionSecurityConfig(collection.uid, {
          jsSandboxMode: 'safe'
        }));
      }
    }

    if (!isChevronClick) {
      // An application opens its overview, where one of its collections can be picked.
      dispatch(addTab({ uid: collection.uid, collectionUid: collection.uid, type: 'collection-settings' }));
    }
  };

  const handleDoubleClick = (_event) => {
    dispatch(makeTabPermanent({ uid: collection.uid }));
  };

  const handleCollectionCollapse = (e) => {
    e.stopPropagation();
    e.preventDefault();
    ensureCollectionIsMounted();
    dispatch(toggleCollection(collection.uid));
  };

  // prevent the parent's double-click handler from firing
  const handleCollectionDoubleClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
  };

  const handleRightClick = (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (isMultiSelected) {
      openBulkMenu(event);
      return;
    }

    // Otherwise, show the regular menu dropdown
    const _menuDropdown = menuDropdownRef.current;
    if (_menuDropdown) {
      _menuDropdown.toggle();
    }
  };

  const handleCollapseFullCollection = () => {
    dispatch(collapseFullCollection({ collectionUid: collection.uid }));
  };

  const handleShowInFolder = () => {
    dispatch(showInFolder(collection.pathname)).catch((error) => {
      console.error('Error opening the folder', error);
      toast.error('Error opening the collection');
    });
  };

  const handlePasteItem = () => {
    dispatch(pasteItem(collection.uid, null))
      .then(() => {
        toast.success('Item pasted successfully');
      })
      .catch((err) => {
        toast.error(err ? err.message : 'An error occurred while pasting the item');
      });
  };

  const getKeybindingDisplayText = useKeybindingDisplayText();

  // Sidebar shortcuts — only active when this collection has keyboard focus
  useKeybinding('renameItem', () => {
    setShowRenameCollectionModal(true);
    return false;
  }, { enabled: isKeyboardFocused, deps: [isKeyboardFocused] });

  useKeybinding('pasteItem', () => {
    handlePasteItem();
    return false;
  }, { enabled: isKeyboardFocused, deps: [isKeyboardFocused] });

  useKeybinding('newRequest', () => {
    ensureCollectionIsMounted();
    setShowNewRequestModal(true);
    return false;
  }, { enabled: isKeyboardFocused, deps: [isKeyboardFocused] });

  const handleFocus = () => {
    setIsKeyboardFocused(true);
    dispatch(setFocusedSidebarPath(collection.pathname));
  };

  const handleBlur = () => {
    setIsKeyboardFocused(false);
    dispatch(setFocusedSidebarPath(null));
  };

  const isCollectionItem = (itemType) => {
    return itemType === 'collection-item';
  };

  const [{ isDragging }, drag, dragPreview] = useDrag({
    type: 'collection',
    item: {
      ...collection,
      wasSelected: isSelected,
      ...(multiDragItems ? { multiSelectedItems: multiDragItems } : {})
    },
    canDrag: !isDragDisabled,
    collect: (monitor) => ({
      isDragging: monitor.isDragging()
    }),
    options: {
      dropEffect: 'move'
    }
  });

  const [{ isOver }, drop] = useDrop({
    accept: ['collection', 'collection-item'],
    hover: (_draggedItem, monitor) => {
      const itemType = monitor.getItemType();
      if (isCollectionItem(itemType)) {
        // For collection items, always show full highlight (inside drop)
        setDropType('inside');
      } else {
        // For collections, show line indicator (above drop)
        setDropType('above');
      }
    },
    drop: async (draggedItem, monitor) => {
      const itemType = monitor.getItemType();
      if (isCollectionItem(itemType)) {
        // Lazy-unmounted workspace collections are droppable in the sidebar but
        // have no watcher yet — mount first so the move writes through and the UI updates.
        if (collection.mountStatus !== 'mounted' && collection.mountStatus !== 'mounting') {
          await dispatch(mountCollection({
            collectionUid: collection.uid,
            collectionPathname: collection.pathname,
            brunoConfig: collection.brunoConfig
          }));
        }

        const draggedItems = getSortedDraggedItems({
          draggedItem,
          allCollections: store.getState().collections.collections,
          workspaces,
          activeWorkspace,
          collectionSortOrder,
          searchText
        });

        const validDraggedItems = draggedItems.filter((dragged) => dragged.uid !== collection.uid);

        if (validDraggedItems.length > 0) {
          dispatch(handleMultipleCollectionItemsDrop({ targetItem: collection, draggedItems: validDraggedItems, dropType: 'inside', collectionUid: collection.uid }));
        }

        if (draggedItem.wasSelected) {
          dispatch(clearSidebarSelection());
        }
      } else {
        const draggedItems = getSortedDraggedItems({
          draggedItem,
          allCollections: store.getState().collections.collections,
          workspaces,
          activeWorkspace,
          collectionSortOrder,
          searchText
        });

        const validDraggedItems = draggedItems.filter((dragged) => dragged.uid !== collection.uid);

        for (const dragged of validDraggedItems) {
          await dispatch(moveCollectionAndPersist({ draggedItem: dragged, targetItem: collection }));
        }

        if (draggedItem.wasSelected) {
          dispatch(clearSidebarSelection());
        }
      }
      setDropType(null);
    },
    canDrop: (draggedItem) => {
      if (draggedItem.uid === collection.uid) return false;
      return !draggedItem.multiSelectedItems?.some((i) => i.uid === collection.uid);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver()
    })
  });

  drag(drop(collectionRef));
  dragPreview(getEmptyImage(), { captureDraggingState: true });

  const collectionRowClassName = classnames(
    'flex py-1 collection-name items-center relative',
    {
      'item-hovered': isOver && dropType === 'above', // For collection-to-collection moves (show line)
      'drop-target': isOver && dropType === 'inside', // For collection-item drops (highlight full area)
      'collection-focused-in-tab': isCollectionFocused && !isKeyboardFocused,
      'collection-keyboard-focused': isKeyboardFocused,
      'collection-selected': isSelected,
      'drag-disabled': isDragDisabled
    }
  );

  // Grouped by function: create, edit, view/navigate, remove.
  const menuItems = [
    {
      id: 'new-request',
      leftSection: IconFilePlus,
      label: 'New Request',
      shortcut: getKeybindingDisplayText('newRequest'),
      onClick: () => {
        ensureCollectionIsMounted();
        setShowNewRequestModal(true);
      }
    },
    {
      id: 'new-folder',
      leftSection: IconStack2,
      label: 'New Collection',
      onClick: () => {
        ensureCollectionIsMounted();
        setShowNewFolderModal(true);
      }
    },
    ...(hasCopiedItems
      ? [
          {
            id: 'paste',
            leftSection: IconClipboard,
            label: 'Paste',
            shortcut: getKeybindingDisplayText('pasteItem'),
            onClick: handlePasteItem
          }
        ]
      : []),
    { id: 'divider-edit', type: 'divider' },
    {
      id: 'rename',
      leftSection: IconEdit,
      label: 'Rename',
      shortcut: getKeybindingDisplayText('renameItem'),
      onClick: () => {
        setShowRenameCollectionModal(true);
      }
    },
    {
      id: 'change-color',
      leftSection: IconPalette,
      label: 'Change color',
      onClick: () => setShowColorModal(true)
    },
    { id: 'divider-view', type: 'divider' },
    {
      id: 'collapse',
      leftSection: IconFoldDown,
      label: 'Collapse',
      onClick: handleCollapseFullCollection
    },
    {
      id: 'show-in-folder',
      leftSection: IconFolder,
      label: getRevealInFolderLabel(),
      onClick: handleShowInFolder
    },
    { id: 'divider-remove', type: 'divider' },
    {
      id: 'remove',
      leftSection: IconX,
      label: 'Remove',
      onClick: () => {
        setShowRemoveCollectionModal(true);
      }
    }
  ];

  if (searchText && searchText.length) {
    if (!doesCollectionHaveItemsMatchingSearchText(collection, searchText)) {
      return null;
    }
  }

  return (
    <StyledWrapper className="flex flex-col">
      {showNewRequestModal && <NewRequest collectionUid={collection.uid} onClose={() => setShowNewRequestModal(false)} />}
      {showNewFolderModal && <NewFolder collectionUid={collection.uid} onClose={() => setShowNewFolderModal(false)} />}
      {showColorModal && <ApplicationColor collection={collection} onClose={() => setShowColorModal(false)} />}
      {showRenameCollectionModal && (
        <RenameCollection collectionUid={collection.uid} onClose={() => setShowRenameCollectionModal(false)} />
      )}
      {showRemoveCollectionModal && (
        <RemoveCollections collectionUid={collection.uid} onClose={() => setShowRemoveCollectionModal(false)} />
      )}
      <div
        className={collectionRowClassName}
        ref={collectionRef}
        tabIndex={0}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onMouseDown={isDragDisabled ? startBlockedDragTracking : undefined}
        data-testid="sidebar-collection-row"
        data-selected={isSelected ? 'true' : undefined}
      >
        <div
          className="flex flex-grow items-center overflow-hidden"
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          onContextMenu={handleRightClick}
        >
          <ActionIcon style={{ width: 16, minWidth: 16 }}>
            <IconChevronRight
              size={16}
              strokeWidth={2}
              className={`chevron-icon ${iconClassName}`}
              style={{ width: 16, minWidth: 16, color: 'rgb(160 160 160)' }}
              data-testid="collection-chevron"
              onClick={handleCollectionCollapse}
              onDoubleClick={handleCollectionDoubleClick}
            />
          </ActionIcon>
          <IconBox size={16} strokeWidth={2} className="ml-1 flex-shrink-0" style={{ color: applicationColor }} />
          <div className="ml-1 min-w-0" id="sidebar-collection-name" title={collection.name}>
            {collection.name}
          </div>
          <InvalidFilesBadge count={invalidItemCount} collectionUid={collection.uid} rowUid={collection.uid} />
          {isLoading ? <IconLoader2 className="animate-spin flex-shrink-0 mx-1 ml-auto" size={18} strokeWidth={1.5} /> : null}
        </div>
        {!isDragging && !isMultiSelected && (
          <div>
            <div className="pr-2">
              <MenuDropdown
                ref={menuDropdownRef}
                items={menuItems}
                placement="bottom-start"
                appendTo={dropdownContainerRef?.current || document.body}
                popperOptions={{ strategy: 'fixed' }}
                data-testid="collection-actions"
              >
                <ActionIcon className="collection-actions">
                  <IconDots size={18} />
                </ActionIcon>
              </MenuDropdown>
            </div>
          </div>
        )}
      </div>
      {children}
    </StyledWrapper>
  );
};

export default CollectionRow;
