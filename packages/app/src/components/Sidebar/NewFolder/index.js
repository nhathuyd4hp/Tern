import React, { useRef, useEffect, useState, forwardRef } from 'react';
import { useFormik } from 'formik';
import toast from 'react-hot-toast';
import * as Yup from 'yup';
import Portal from 'components/Portal';
import Modal from 'components/Modal';
import { useDispatch, useSelector } from 'react-redux';
import { newFolder, updateBrunoConfig } from 'providers/ReduxStore/slices/collections/actions';
import { selectCollectionByUid } from 'src/selectors/collections';
import SpecSourcePicker from 'components/OpenAPISyncTab/SpecSourcePicker';
import { isSpecSourceReady, PROTO_SOURCE_PICKER_PROPS } from 'components/OpenAPISyncTab/SpecSourcePicker/utils';
import { buildOpenApiFolderImport, buildProtoFolderImport, parseSpecContent } from 'utils/importers/folder-source';
import { loadProtoSource, materializeProtoSource } from 'utils/importers/proto-source';
import { formatIpcError } from 'utils/common/error';
import { IconArrowBackUp, IconEdit, IconCaretDown } from '@tabler/icons';
import { sanitizeName, validateName, validateNameError } from 'utils/common/regex';
import PathDisplay from 'components/PathDisplay/index';
import Help from 'components/Help';
import Dropdown from 'components/Dropdown';
import StyledWrapper from './StyledWrapper';
import Button from 'ui/Button';

const SOURCES = [
  { key: 'empty', label: 'Empty' },
  { key: 'openapi', label: 'OpenAPI' },
  { key: 'proto', label: 'Proto file' }
];

const NewFolder = ({ collectionUid, item, onClose }) => {
  const dispatch = useDispatch();
  const collection = useSelector((state) => selectCollectionByUid(state, collectionUid));
  const [source, setSource] = useState('empty');
  const [specMode, setSpecMode] = useState('url');
  const [specValue, setSpecValue] = useState('');
  const [specData, setSpecData] = useState(null);
  const [protoData, setProtoData] = useState(null);
  const [sourceError, setSourceError] = useState(null);
  const [isSourceLoading, setIsSourceLoading] = useState(false);
  const [isNameEdited, setIsNameEdited] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef();
  const [isEditing, toggleEditing] = useState(false);
  const [showFilesystemName, toggleShowFilesystemName] = useState(false);

  const dropdownTippyRef = useRef();
  const onDropdownCreate = (ref) => (dropdownTippyRef.current = ref);

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      folderName: '',
      directoryName: ''
    },
    validationSchema: Yup.object({
      folderName: Yup.string()
        .trim()
        .min(1, 'must be at least 1 character')
        .required('name is required'),
      directoryName: Yup.string()
        .trim()
        .min(1, 'must be at least 1 character')
        .required('foldername is required')
        .test('is-valid-folder-name', function (value) {
          const isValid = validateName(value);
          return isValid ? true : this.createError({ message: validateNameError(value) });
        })
        .test({
          name: 'folderName',
          message: 'The collection name "environments" at the root of the application is reserved in bruno',
          test: (value) => {
            if (item?.uid) return true;
            return value && !value.trim().toLowerCase().includes('environments');
          }
        })
    }),
    onSubmit: async (values) => {
      if (source === 'openapi' && !specData) {
        setSourceError('Load an OpenAPI spec first');
        return;
      }
      if (source === 'proto' && !protoData) {
        setSourceError('Select a .proto file or URL first');
        return;
      }

      setIsSubmitting(true);
      try {
        const { pathname } = await dispatch(newFolder(values.folderName, values.directoryName, collectionUid, item ? item.uid : null));
        if (source !== 'empty') {
          const imported = await buildImport();
          await window.ipcRenderer.invoke('renderer:import-items-into-folder', {
            collectionPath: collection.pathname,
            folderPath: pathname,
            items: imported.items,
            openapiSync: imported.openapiSync
          });
          if (imported.protobuf) {
            await dispatch(updateBrunoConfig({ ...collection.brunoConfig, protobuf: imported.protobuf }, collectionUid));
          }
        }
        toast.success('New collection created!');
        onClose();
      } catch (err) {
        toast.error(formatIpcError(err) || 'An error occurred while adding the collection');
        setIsSubmitting(false);
      }
    }
  });

  const buildImport = async () => (source === 'openapi'
    ? buildOpenApiFolderImport(specData)
    : buildProtoFolderImport(await materializeProtoSource(protoData, collection.pathname), { collectionPathname: collection.pathname, protobuf: collection.brunoConfig?.protobuf }));

  // A name the user typed is never replaced by the one taken from the source.
  const prefillName = (name) => {
    if (isNameEdited || !name) return;
    formik.setFieldValue('folderName', name);
    if (!isEditing) formik.setFieldValue('directoryName', sanitizeName(name));
  };

  const switchSource = (nextSource) => {
    setSource(nextSource);
    setSpecValue('');
    setSpecData(null);
    setProtoData(null);
    setSourceError(null);
  };

  const loadSpec = async (sourceUrl) => {
    setSpecData(null);
    setSourceError(null);
    setIsSourceLoading(true);
    try {
      const result = await window.ipcRenderer.invoke('renderer:fetch-openapi-spec', {
        collectionUid,
        collectionPath: collection.pathname,
        sourceUrl,
        environmentContext: {
          activeEnvironmentUid: collection.activeEnvironmentUid,
          environments: collection.environments,
          runtimeVariables: collection.runtimeVariables,
          globalEnvironmentVariables: collection.globalEnvironmentVariables
        }
      });
      if (result.error) {
        setSourceError(result.error);
        return;
      }
      const spec = parseSpecContent(result.content);
      setSpecData({ spec, specContent: result.content, sourceUrl });
      prefillName(spec?.info?.title);
    } catch (err) {
      setSourceError(formatIpcError(err) || 'Failed to load the spec');
    } finally {
      setIsSourceLoading(false);
    }
  };

  const handleSpecValueChange = (value) => {
    setSpecValue(value);
    setSpecData(null);
    if (specMode === 'file' && value) loadSpec(value);
  };

  const handleSpecModeChange = (mode) => {
    setSpecMode(mode);
    setSpecValue('');
    setSpecData(null);
    setSourceError(null);
  };

  const handleSpecError = (message) => {
    setSourceError(message);
    if (message) setSpecValue('');
  };

  const loadProto = async (mode, value) => {
    setProtoData(null);
    setSourceError(null);
    setIsSourceLoading(true);
    const { protoData: loaded, name, error } = await loadProtoSource(mode, value, {
      collectionUid,
      collectionPath: collection.pathname,
      environmentContext: {
        activeEnvironmentUid: collection.activeEnvironmentUid,
        environments: collection.environments,
        runtimeVariables: collection.runtimeVariables,
        globalEnvironmentVariables: collection.globalEnvironmentVariables
      }
    });
    setIsSourceLoading(false);
    if (error) {
      setSourceError(error);
      return;
    }
    setProtoData(loaded);
    prefillName(name);
  };

  const handleProtoValueChange = (value) => {
    setSpecValue(value);
    setProtoData(null);
    if (specMode === 'file' && value) loadProto('file', value);
  };

  const handleProtoModeChange = (mode) => {
    handleSpecModeChange(mode);
    setProtoData(null);
  };

  useEffect(() => {
    if (inputRef && inputRef.current) {
      inputRef.current.focus();
    }
  }, [inputRef]);

  const AdvancedOptions = forwardRef((props, ref) => {
    return (
      <div ref={ref} className="flex mr-2 text-link cursor-pointer items-center">
        <button
          className="btn-advanced"
          type="button"
        >
          Options
        </button>
        <IconCaretDown className="caret ml-1" size={14} strokeWidth={2} />
      </div>
    );
  });

  return (
    <Portal>
      <StyledWrapper>
        <Modal size="md" title="New Collection" hideFooter={true} handleCancel={onClose}>
          <form className="bruno-form" onSubmit={formik.handleSubmit}>
            <label htmlFor="folderName" className="block font-medium">
              Collection Name
            </label>
            <input
              id="folder-name"
              type="text"
              name="folderName"
              ref={inputRef}
              className="block textbox mt-2 w-full"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              onChange={(e) => {
                setIsNameEdited(true);
                formik.setFieldValue('folderName', e.target.value);
                !isEditing && formik.setFieldValue('directoryName', sanitizeName(e.target.value));
              }}
              data-testid="new-folder-input"
              value={formik.values.folderName || ''}
            />
            {formik.touched.folderName && formik.errors.folderName ? (
              <div className="text-red-500" data-testid="form-error">{formik.errors.folderName}</div>
            ) : null}

            <div className="mt-4">
              <label className="block font-medium">Source</label>
              <div className="flex gap-4 mt-2" role="radiogroup" aria-label="Source">
                {SOURCES.map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="source"
                      checked={source === key}
                      onChange={() => switchSource(key)}
                      data-testid={`new-folder-source-${key}`}
                    />
                    {label}
                  </label>
                ))}
              </div>
              {source === 'openapi' && (
                <div className="mt-3">
                  <SpecSourcePicker
                    mode={specMode}
                    onModeChange={handleSpecModeChange}
                    value={specValue}
                    onChange={handleSpecValueChange}
                    onError={handleSpecError}
                    action={specMode === 'url' ? (
                      <Button
                        type="button"
                        size="sm"
                        loading={isSourceLoading}
                        disabled={!isSpecSourceReady(specMode, specValue)}
                        onClick={() => loadSpec(specValue.trim())}
                        data-testid="new-folder-load-spec"
                      >
                        Load
                      </Button>
                    ) : null}
                  />
                  {specData && <div className="text-muted mt-2">Spec loaded: {specData.spec?.info?.title}</div>}
                </div>
              )}
              {source === 'proto' && (
                <div className="mt-3">
                  <SpecSourcePicker
                    {...PROTO_SOURCE_PICKER_PROPS}
                    mode={specMode}
                    onModeChange={handleProtoModeChange}
                    value={specValue}
                    onChange={handleProtoValueChange}
                    onError={handleSpecError}
                    action={specMode === 'url' ? (
                      <Button
                        type="button"
                        size="sm"
                        loading={isSourceLoading}
                        disabled={!isSpecSourceReady(specMode, specValue)}
                        onClick={() => loadProto('url', specValue)}
                        data-testid="new-folder-load-proto"
                      >
                        Load
                      </Button>
                    ) : null}
                  />
                  <div className="text-muted mt-2">{protoData ? 'Proto file loaded' : 'Service → collection, method → request.'}</div>
                </div>
              )}
              {sourceError && <div className="text-red-500 mt-2" data-testid="new-folder-source-error">{sourceError}</div>}
            </div>

            {showFilesystemName && (
              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <label htmlFor="directoryName" className="flex items-center font-medium">
                    Collection Name <small className="font-normal text-muted ml-1">(on filesystem)</small>
                    <Help width="300">
                      <p>
                        You can choose to save the collection as a different name on your file system versus what is displayed in the app.
                      </p>
                    </Help>
                  </label>
                  {isEditing ? (
                    <IconArrowBackUp
                      className="cursor-pointer opacity-50 hover:opacity-80"
                      size={16}
                      strokeWidth={1.5}
                      onClick={() => toggleEditing(false)}
                    />
                  ) : (
                    <IconEdit
                      className="cursor-pointer opacity-50 hover:opacity-80"
                      size={16}
                      strokeWidth={1.5}
                      onClick={() => toggleEditing(true)}
                    />
                  )}
                </div>
                {isEditing ? (
                  <div className="relative flex flex-row gap-1 items-center justify-between">
                    <input
                      id="file-name"
                      type="text"
                      name="directoryName"
                      placeholder="Collection Name"
                      className="block textbox mt-2 w-full"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck="false"
                      onChange={formik.handleChange}
                      value={formik.values.directoryName || ''}
                    />
                  </div>
                ) : (
                  <div className="relative flex flex-row gap-1 items-center justify-between">
                    <PathDisplay
                      iconType="folder"
                      baseName={formik.values.directoryName}
                    />
                  </div>
                )}
                {formik.touched.directoryName && formik.errors.directoryName ? (
                  <div className="text-red-500" data-testid="form-error">{formik.errors.directoryName}</div>
                ) : null}
              </div>
            )}
            <div className="flex justify-between items-center mt-8 bruno-modal-footer">
              <div className="flex advanced-options">
                <Dropdown onCreate={onDropdownCreate} icon={<AdvancedOptions />} placement="bottom-start">
                  <div
                    className="dropdown-item"
                    key="show-filesystem-name"
                    onClick={(e) => {
                      dropdownTippyRef.current.hide();
                      toggleShowFilesystemName(!showFilesystemName);
                    }}
                  >
                    {showFilesystemName ? 'Hide Filesystem Name' : 'Show Filesystem Name'}
                  </div>
                </Dropdown>
              </div>
              <div className="flex justify-end">
                <Button type="button" color="secondary" variant="ghost" onClick={onClose} className="mr-2">
                  Cancel
                </Button>
                <Button type="submit" loading={isSubmitting}>
                  Create
                </Button>
              </div>
            </div>
          </form>
        </Modal>
      </StyledWrapper>
    </Portal>
  );
};

export default NewFolder;
