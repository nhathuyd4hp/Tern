import { useMemo } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { IconFileZip, IconFolder } from '@tabler/icons';
import Button from 'ui/Button';
import {
  cancelCollectionSearch,
  closeOpenCollectionModal,
  openCollectionsFromModal,
  pickApplicationZip,
  pickCollectionFolders
} from 'providers/ReduxStore/slices/open-collection-modal/actions';
import { selectOpenCollectionPathKeys } from 'providers/ReduxStore/slices/open-collection-modal/selectors';
import BusyOverlay from '../BusyOverlay';
import CollectionPicker from '../CollectionPicker';
import DropZone from '../DropZone';
import { focusWhenFocusIsLost } from '../../utils/focus';
import StyledWrapper from './StyledWrapper';

const ChooseFolderPage = () => {
  const dispatch = useDispatch();
  const { status, searchLabel, result } = useSelector((state) => state.openCollectionModal.chooseFolder);
  const openPathKeyList = useSelector(selectOpenCollectionPathKeys, shallowEqual);
  const openPathKeys = useMemo(() => new Set(openPathKeyList), [openPathKeyList]);

  const pickFolders = () => dispatch(pickCollectionFolders());
  const isSearching = status === 'searching';

  return (
    <StyledWrapper>
      <div className="choose-folder-content" inert={isSearching}>
        {result?.type === 'list' ? (
          <CollectionPicker
            key={result.id}
            collections={result.collections}
            folders={result.folders}
            initialSelection={result.preselect}
            openPathKeys={openPathKeys}
            testIdPrefix="choose-folder"
            onOpen={(paths) => dispatch(openCollectionsFromModal(paths))}
            onCancel={() => dispatch(closeOpenCollectionModal())}
            onChooseOtherFolders={pickFolders}
          />
        ) : (
          <div className="choose-folder-start">
            <DropZone
              icon={IconFolder}
              title="Drop a Tern application folder or a .zip here"
              hint={(
                <>
                  Tern Application folder has <code>opencollection.yml</code> at the root
                </>
              )}
              data-testid="choose-folder-drop-zone"
            >
              <span className="flex items-center justify-center gap-2 mt-1">
                <Button
                  ref={focusWhenFocusIsLost}
                  variant="outline"
                  icon={<IconFolder size={16} />}
                  onClick={pickFolders}
                  data-testid="choose-folder-choose-link"
                >
                  Choose folder
                </Button>
                <Button
                  variant="outline"
                  icon={<IconFileZip size={16} />}
                  onClick={() => dispatch(pickApplicationZip())}
                  data-testid="choose-folder-import-zip-link"
                >
                  Choose .zip file
                </Button>
              </span>
            </DropZone>
          </div>
        )}
      </div>

      {isSearching && (
        <BusyOverlay onCancel={() => dispatch(cancelCollectionSearch())}>
          Looking for collections in {searchLabel}…
        </BusyOverlay>
      )}
    </StyledWrapper>
  );
};

export default ChooseFolderPage;
