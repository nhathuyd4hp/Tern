import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { IconPlus, IconFolder, IconLayoutGrid, IconList } from '@tabler/icons';
import { setIsOpeningCollection } from 'providers/ReduxStore/slices/app';
import toast from 'react-hot-toast';
import CreateCollection from 'components/Sidebar/CreateCollection';
import Button from 'ui/Button';
import CollectionsList from './CollectionsList';
import StyledWrapper from './StyledWrapper';

const VIEW_MODE_KEY = 'kevin.home.viewMode';

const readViewMode = () => {
  try {
    return localStorage.getItem(VIEW_MODE_KEY) === 'table' ? 'table' : 'card';
  } catch {
    return 'card';
  }
};

const WorkspaceOverview = ({ workspace }) => {
  const dispatch = useDispatch();
  const [viewMode, setViewMode] = useState(readViewMode);

  const changeViewMode = (mode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(VIEW_MODE_KEY, mode);
    } catch {
      // the choice just is not remembered
    }
  };
  const { globalEnvironments } = useSelector((state) => state.globalEnvironments);

  const [createCollectionModalOpen, setCreateCollectionModalOpen] = useState(false);

  const workspaceCollectionsCount = workspace?.collections?.length || 0;

  const workspaceEnvironmentsCount = globalEnvironments?.length || 0;

  const handleCreateCollection = async () => {
    if (!workspace?.pathname) {
      toast.error('Application storage path not found');
      return;
    }

    try {
      const { ipcRenderer } = window;
      await ipcRenderer.invoke('renderer:ensure-collections-folder', workspace.pathname);
      setCreateCollectionModalOpen(true);
    } catch (error) {
      console.error('Error ensuring collections folder exists:', error);
      toast.error('Error preparing storage for application creation');
    }
  };

  const handleOpenCollection = () => {
    dispatch(setIsOpeningCollection(true));
  };

  return (
    <StyledWrapper>
      {createCollectionModalOpen && <CreateCollection onClose={() => setCreateCollectionModalOpen(false)} />}

      <div className="overview-layout">
        <div className="overview-main">
          <div className="home-header">
            <div className="home-heading">
              <h2 className="home-title">Applications</h2>
              <div className="home-summary">
                {workspaceCollectionsCount} {workspaceCollectionsCount === 1 ? 'application' : 'applications'}
                {' · '}
                {workspaceEnvironmentsCount} {workspaceEnvironmentsCount === 1 ? 'global environment' : 'global environments'}
              </div>
            </div>
            <div className="home-actions">
              <div className="view-toggle" role="group" aria-label="View mode">
                <button
                  type="button"
                  className={viewMode === 'card' ? 'active' : ''}
                  onClick={() => changeViewMode('card')}
                  title="Card view"
                  data-testid="home-view-card"
                >
                  <IconLayoutGrid size={16} strokeWidth={1.5} />
                </button>
                <button
                  type="button"
                  className={viewMode === 'table' ? 'active' : ''}
                  onClick={() => changeViewMode('table')}
                  title="Table view"
                  data-testid="home-view-table"
                >
                  <IconList size={16} strokeWidth={1.5} />
                </button>
              </div>
              <Button
                size="sm"
                icon={<IconPlus size={14} strokeWidth={1.5} />}
                onClick={handleCreateCollection}
              >
                Create
              </Button>
              <Button
                color="light"
                size="sm"
                icon={<IconFolder size={14} strokeWidth={1.5} />}
                onClick={handleOpenCollection}
              >
                Import
              </Button>
            </div>
          </div>

          <div className="collections-section">
            <CollectionsList workspace={workspace} viewMode={viewMode} />
          </div>
        </div>

      </div>
    </StyledWrapper>
  );
};

export default WorkspaceOverview;
