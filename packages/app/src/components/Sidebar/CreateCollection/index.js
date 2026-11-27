import React, { useRef, useEffect, useState, forwardRef } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import path from 'utils/common/path';
import { browseDirectory, createCollection, mountCollection, newFolder, updateBrunoConfig } from 'providers/ReduxStore/slices/collections/actions';
import { selectCollectionByUid } from 'src/selectors/collections';
import { buildOpenApiFolderImport, buildProtoFolderImport } from 'utils/importers/folder-source';
import { materializeProtoSource } from 'utils/importers/proto-source';
import toast from 'react-hot-toast';
import Portal from 'components/Portal';
import Modal from 'components/Modal';
import { sanitizeName, validateName, validateNameError } from 'utils/common/regex';
import PathDisplay from 'components/PathDisplay/index';
import { IconArrowBackUp, IconEdit, IconCaretDown } from '@tabler/icons';
import Help from 'components/Help';
import Dropdown from 'components/Dropdown';
import { multiLineMsg } from 'utils/common';
import { formatIpcError } from 'utils/common/error';
import { DEFAULT_COLLECTION_FORMAT } from 'utils/common/constants';
import StyledWrapper from './StyledWrapper';
import get from 'lodash/get';
import Button from 'ui/Button';
import Select from 'ui/Select';
import SourceRow, { createSource } from './SourceRow';

const waitFor = async (predicate, timeoutMs = 10000) => {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('Timed out while preparing the new application');
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
};

const CreateCollection = ({ onClose, defaultLocation: propDefaultLocation, initialCollectionName = '' }) => {
  const inputRef = useRef();
  const dispatch = useDispatch();
  const store = useStore();
  const workspaces = useSelector((state) => state.workspaces?.workspaces || []);
  const workspaceUid = useSelector((state) => state.workspaces?.activeWorkspaceUid);
  const [isEditing, toggleEditing] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [sources, setSources] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const preferences = useSelector((state) => state.app.preferences);

  const dropdownTippyRef = useRef();
  const onDropdownCreate = (ref) => (dropdownTippyRef.current = ref);
  const activeWorkspace = workspaces.find((w) => w.uid === workspaceUid);
  const isDefaultWorkspace = activeWorkspace?.type === 'default';

  const defaultLocation = isDefaultWorkspace ? get(preferences, 'general.defaultLocation', '') : (activeWorkspace?.pathname ? path.join(activeWorkspace.pathname, 'collections') : '');

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      collectionName: initialCollectionName,
      collectionFolderName: initialCollectionName ? sanitizeName(initialCollectionName) : '',
      collectionLocation: defaultLocation || '',
      format: DEFAULT_COLLECTION_FORMAT
    },
    validationSchema: Yup.object({
      collectionName: Yup.string()
        .trim()
        .min(1, 'Application name can\'t be empty')
        .max(255, 'Must be 255 characters or less')
        .required('Application name is required'),
      collectionFolderName: Yup.string()
        .min(1, 'Must be at least 1 character')
        .max(255, 'Must be 255 characters or less')
        .test('is-valid-collection-name', function (value) {
          const isValid = validateName(value);
          return isValid ? true : this.createError({ message: validateNameError(value) });
        })
        .required('Folder name is required'),
      collectionLocation: Yup.string().min(1, 'Location is required').required('Location is required'),
      format: Yup.string().oneOf(['bru', 'yml'], 'invalid format').required('Format is required')
    }),
    onSubmit: async (values) => {
      const unready = sources.find((source) => (source.type === 'openapi' ? !source.specData : !source.protoData));
      if (unready) {
        updateSource(unready.id, { error: unready.type === 'openapi' ? 'Load an OpenAPI spec first' : 'Select a .proto file or URL first' });
        return;
      }
      const invalid = sources.find((source) => !source.name.trim() || !validateName(sanitizeName(source.name)));
      if (invalid) {
        updateSource(invalid.id, { error: 'Enter a valid collection name' });
        return;
      }

      setIsSubmitting(true);
      try {
        const created = await dispatch(createCollection(values.collectionName.trim(),
          values.collectionFolderName,
          values.collectionLocation,
          { format: values.format }));

        const failed = created?.uid ? await addSources(created, sources) : [];
        if (failed.length) {
          toast.error(multiLineMsg('Application created, but some collections could not be added', ...failed));
        } else {
          toast.success('Application created!');
        }
        onClose();
      } catch (e) {
        setIsSubmitting(false);
        toast.error(multiLineMsg('An error occurred while creating the application', formatIpcError(e)));
      }
    }
  });

  const updateSource = (id, patch) => setSources((current) => current.map((source) => (source.id === id ? { ...source, ...patch } : source)));

  // The new application has to be in the store and mounted (watched) before collections can be written into it.
  const addSources = async ({ uid, pathname }, list) => {
    const getCollection = () => selectCollectionByUid(store.getState(), uid);
    const failed = [];
    if (!list.length) return failed;

    await waitFor(() => getCollection()?.pathname);
    if (!['mounted', 'mounting'].includes(getCollection().mountStatus)) {
      await dispatch(mountCollection({ collectionUid: uid, collectionPathname: pathname, brunoConfig: getCollection().brunoConfig }));
    }
    await waitFor(() => getCollection().mountStatus === 'mounted');

    for (const source of list) {
      try {
        const name = source.name.trim();
        const { pathname: folderPath } = await dispatch(newFolder(name, sanitizeName(name), uid, null));
        const collection = getCollection();
        const imported = source.type === 'openapi'
          ? buildOpenApiFolderImport(source.specData)
          : await buildProtoFolderImport(await materializeProtoSource(source.protoData, collection.pathname), { collectionPathname: collection.pathname, protobuf: collection.brunoConfig?.protobuf });
        await window.ipcRenderer.invoke('renderer:import-items-into-folder', {
          collectionPath: collection.pathname,
          folderPath,
          items: imported.items,
          openapiSync: imported.openapiSync
        });
        if (imported.protobuf) {
          await dispatch(updateBrunoConfig({ ...getCollection().brunoConfig, protobuf: imported.protobuf }, uid));
        }
      } catch (err) {
        failed.push(`${source.name}: ${formatIpcError(err) || 'failed'}`);
      }
    }
    return failed;
  };

  const browse = () => {
    dispatch(browseDirectory())
      .then((dirPath) => {
        if (typeof dirPath === 'string') {
          formik.setFieldValue('collectionLocation', dirPath);
        }
      })
      .catch(() => {
        formik.setFieldValue('collectionLocation', '');
      });
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputRef && inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }, 50);
    return () => clearTimeout(timer);
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
        <Modal size="md" title="Create Application" hideFooter={true} handleCancel={onClose}>
          <form className="bruno-form" onSubmit={formik.handleSubmit}>
            <div>
              <label htmlFor="collection-name" className="flex items-center font-medium">
                Name
              </label>
              <input
                id="collection-name"
                type="text"
                name="collectionName"
                ref={inputRef}
                className="block textbox mt-2 w-full"
                onChange={(e) => {
                  const collectionName = e.target.value;
                  if (!isEditing) {
                    formik.setValues((values) => ({
                      ...values,
                      collectionName,
                      collectionFolderName: sanitizeName(collectionName)
                    }));
                    return;
                  }

                  formik.handleChange(e);
                }}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                value={formik.values.collectionName || ''}
              />
              {formik.touched.collectionName && formik.errors.collectionName ? (
                <div className="text-red-500">{formik.errors.collectionName}</div>
              ) : null}

              <label htmlFor="collection-location" className="font-medium mt-3 flex items-center">
                Location
                <Help>
                  <p>
                    Tern stores your applications on your computer's filesystem.
                  </p>
                  <p className="mt-2">
                    Choose the location where you want to store this application.
                  </p>
                </Help>
              </label>
              <div className="flex items-stretch gap-2 mt-2">
                <input
                  id="collection-location"
                  type="text"
                  name="collectionLocation"
                  className="block textbox flex-1 min-w-0 cursor-pointer"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                  readOnly={true}
                  value={formik.values.collectionLocation || ''}
                  onClick={browse}
                  onChange={(e) => {
                    formik.setFieldValue('collectionLocation', e.target.value);
                  }}
                />
                <Button type="button" color="secondary" variant="outline" className="location-browse" onClick={browse}>
                  Browse
                </Button>
              </div>
              {formik.touched.collectionLocation && formik.errors.collectionLocation ? (
                <div className="text-red-500">{formik.errors.collectionLocation}</div>
              ) : null}
              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <label className="flex items-center font-medium">
                    Collections
                    <Help width="300">
                      <p>
                        Each collection is created from an OpenAPI spec or a .proto file. OpenAPI collections stay in sync with their spec.
                      </p>
                      <p className="mt-2">
                        You can also create an empty application and add collections later.
                      </p>
                    </Help>
                  </label>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setSources((current) => [...current, createSource('openapi')])} data-testid="create-add-source">
                    + Add collection
                  </Button>
                </div>
                {sources.map((source) => (
                  <SourceRow
                    key={source.id}
                    source={source}
                    onChange={updateSource}
                    onRemove={(id) => setSources((current) => current.filter((item) => item.id !== id))}
                  />
                ))}
              </div>

              {formik.values.collectionName?.trim()?.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between">
                    <label htmlFor="filename" className="flex items-center font-medium">
                      Folder Name
                      <Help width="300">
                        <p>
                          The name of the folder used to store the application.
                        </p>
                        <p className="mt-2">
                          You can choose a folder name different from your application's name or one compatible with filesystem rules.
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
                    <input
                      id="collection-folder-name"
                      type="text"
                      name="collectionFolderName"
                      className="block textbox mt-2 w-full"
                      onChange={formik.handleChange}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck="false"
                      value={formik.values.collectionFolderName || ''}
                    />
                  ) : (
                    <div className="relative flex flex-row gap-1 items-center justify-between">
                      <PathDisplay
                        baseName={formik.values.collectionFolderName}
                      />
                    </div>
                  )}
                  {formik.touched.collectionFolderName && formik.errors.collectionFolderName ? (
                    <div className="text-red-500">{formik.errors.collectionFolderName}</div>
                  ) : null}
                </div>
              )}

              {showAdvancedOptions && (
                <div className="mt-4">
                  <label htmlFor="format" className="flex items-center font-medium">
                    File Format
                    <Help width="300">
                      <p>
                        Choose the file format for storing requests in this application.
                      </p>
                      <p className="mt-2">
                        <strong>OpenCollection (YAML):</strong> Industry-standard YAML format (.yml files)
                      </p>
                      <p className="mt-1">
                        <strong>BRU:</strong> Tern's native file format (.bru files)
                      </p>
                    </Help>
                  </label>
                  <Select
                    className="mt-2"
                    data={[
                      { value: 'yml', label: 'OpenCollection (YAML)' },
                      { value: 'bru', label: 'BRU Format (.bru)' }
                    ]}
                    value={formik.values.format}
                    allowDeselect={false}
                    onChange={(value) => formik.setFieldValue('format', value)}
                    data-testid="create-format"
                  />
                  {formik.touched.format && formik.errors.format ? (
                    <div className="text-red-500">{formik.errors.format}</div>
                  ) : null}
                </div>
              )}
            </div>
            <div className="flex justify-between items-center mt-8 bruno-modal-footer">
              <div className="flex advanced-options">
                <Dropdown onCreate={onDropdownCreate} icon={<AdvancedOptions />} placement="bottom-start">
                  <div
                    className="dropdown-item"
                    key="show-advanced-options"
                    data-testid="show-advanced-options-toggle"
                    onClick={(e) => {
                      dropdownTippyRef.current.hide();
                      setShowAdvancedOptions(!showAdvancedOptions);
                    }}
                  >
                    {showAdvancedOptions ? 'Hide Advanced Options' : 'Show Advanced Options'}
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

export default CreateCollection;
