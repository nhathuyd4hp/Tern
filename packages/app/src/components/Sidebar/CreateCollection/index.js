import React, { useRef, useEffect, useState } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { createCollection, mountCollection, newFolder, updateBrunoConfig } from 'providers/ReduxStore/slices/collections/actions';
import { resolveApplicationName } from 'providers/ReduxStore/slices/open-collection-modal/actions';
import { selectCollectionByUid } from 'src/selectors/collections';
import { buildOpenApiFolderImport, buildProtoFolderImport } from 'utils/importers/folder-source';
import { materializeProtoSource } from 'utils/importers/proto-source';
import toast from 'react-hot-toast';
import Portal from 'components/Portal';
import Modal from 'components/Modal';
import { sanitizeName, validateName, validateNameError } from 'utils/common/regex';
import { IconBox, IconPlus } from '@tabler/icons';
import Help from 'components/Help';
import ApplicationColorPicker from 'components/ApplicationColorPicker';
import { setApplicationColor } from 'utils/application-color';
import { multiLineMsg } from 'utils/common';
import { formatIpcError } from 'utils/common/error';
import StyledWrapper from './StyledWrapper';
import get from 'lodash/get';
import Button from 'ui/Button';
import SourceRow, { createSource } from './SourceRow';

const waitFor = async (predicate, timeoutMs = 10000) => {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('Timed out while preparing the new application');
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
};

const CreateCollection = ({ onClose, initialCollectionName = '' }) => {
  const inputRef = useRef();
  const dispatch = useDispatch();
  const store = useStore();
  const [color, setColor] = useState(null);
  const [sources, setSources] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const location = useSelector((state) => get(state.app.preferences, 'general.defaultLocation', ''));

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      collectionName: initialCollectionName,
      collectionFolderName: initialCollectionName ? sanitizeName(initialCollectionName) : ''
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
        .required('Folder name is required')
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
        // A name that another application already has is settled with the user before anything is created.
        const resolved = await dispatch(resolveApplicationName(values.collectionName));
        if (resolved.stop) {
          setIsSubmitting(false);
          if (resolved.stop === 'keep') onClose();
          return;
        }
        const created = await dispatch(createCollection(resolved.name, sanitizeName(resolved.name)));
        if (color && created?.pathname) {
          setApplicationColor(created, color);
        }

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

  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputRef && inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [inputRef]);

  return (
    <Portal>
      <StyledWrapper>
        <Modal size="md" title={<span className="inline-flex items-center gap-2"><IconBox size={18} strokeWidth={1.5} style={{ color: color || undefined }} data-testid="create-application-logo" />Create Application</span>} hideFooter={true} handleCancel={onClose}>
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
                  formik.setValues((values) => ({
                    ...values,
                    collectionName,
                    collectionFolderName: sanitizeName(collectionName)
                  }));
                }}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                value={formik.values.collectionName || ''}
              />
              {formik.touched.collectionName && (formik.errors.collectionName || formik.errors.collectionFolderName) ? (
                <div className="text-red-500">{formik.errors.collectionName || formik.errors.collectionFolderName}</div>
              ) : null}

              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <label className="flex items-center font-medium">Color</label>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    color="secondary"
                    disabled={!color}
                    onClick={() => setColor(null)}
                    data-testid="create-color-automatic"
                  >
                    Automatic
                  </Button>
                </div>
                <div className="mt-2">
                  <ApplicationColorPicker value={color} onChange={setColor} />
                </div>
              </div>
              <p className="mt-4 text-xs opacity-70" data-testid="create-location-note">
                Applications are stored in {location || 'the default location'}. Change it in Preferences &gt; General.
              </p>
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
            </div>
            <div className="flex justify-end items-center mt-8 bruno-modal-footer">
              <Button type="button" color="secondary" variant="ghost" onClick={onClose} className="mr-2">
                Cancel
              </Button>
              <Button type="submit" loading={isSubmitting} icon={<IconPlus size={16} strokeWidth={1.5} />}>
                Create
              </Button>
            </div>
          </form>
        </Modal>
      </StyledWrapper>
    </Portal>
  );
};

export default CreateCollection;
