import React, { useRef, useEffect } from 'react';
import get from 'lodash/get';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import toast from 'react-hot-toast';
import { uuid } from 'utils/common';
import Modal from 'components/Modal';
import { useDispatch, useSelector } from 'react-redux';
import { newEphemeralHttpRequest } from 'providers/ReduxStore/slices/collections';
import { newHttpRequest, newGrpcRequest, newWsRequest } from 'providers/ReduxStore/slices/collections/actions';
import { addTab } from 'providers/ReduxStore/slices/tabs';
import HttpMethodSelector from 'components/RequestPane/QueryUrl/HttpMethodSelector';
import { getDefaultRequestPaneTab } from 'utils/collections';
import {
  IconBrandGraphql,
  IconPlugConnected,
  IconServerBolt,
  IconWorld
} from '@tabler/icons';
import { sanitizeName, validateName, validateNameError } from 'utils/common/regex';
import Portal from 'components/Portal';
import StyledWrapper from './StyledWrapper';
import SingleLineEditor from 'components/SingleLineEditor/index';
import { useTheme } from 'styled-components';
import Button from 'ui/Button';
import SegmentedControl from 'ui/SegmentedControl';

const REQUEST_TYPE_OPTIONS = [
  { value: 'http-request', label: 'HTTP', Icon: IconWorld, getColor: (request) => request.methods.get },
  { value: 'grpc-request', label: 'gRPC', Icon: IconServerBolt, getColor: (request) => request.grpc },
  { value: 'graphql-request', label: 'GraphQL', Icon: IconBrandGraphql, getColor: (request) => request.gql },
  { value: 'ws-request', label: 'WebSocket', Icon: IconPlugConnected, getColor: (request) => request.ws }
];

const NewRequest = ({ collectionUid, item, isEphemeral, onClose }) => {
  const dispatch = useDispatch();
  const inputRef = useRef();

  const storedTheme = useTheme();

  const collection = useSelector((state) => state.collections.collections?.find((c) => c.uid === collectionUid));
  const collectionPresets = get(
    collection,
    collection?.draft?.brunoConfig ? 'draft.brunoConfig.presets' : 'brunoConfig.presets',
    {}
  );

  const getRequestType = (collectionPresets) => {
    if (!collectionPresets || !collectionPresets.requestType) {
      return 'http-request';
    }

    // Note: Why different labels for the same thing?
    // http-request and graphql-request are used inside the app's json representation of a request
    // http and graphql are used in Bru DSL as well as collection exports
    // We need to eventually standardize the app's DSL to use the same labels as bru DSL
    if (collectionPresets.requestType === 'http') {
      return 'http-request';
    }

    if (collectionPresets.requestType === 'graphql') {
      return 'graphql-request';
    }

    if (collectionPresets.requestType === 'grpc') {
      return 'grpc-request';
    }

    if (collectionPresets.requestType === 'ws') {
      return 'ws-request';
    }

    return 'http-request';
  };

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      requestName: '',
      filename: '',
      requestType: getRequestType(collectionPresets),
      requestUrl: collectionPresets.requestUrl || '',
      requestMethod: 'GET'
    },
    validationSchema: Yup.object({
      requestName: Yup.string()
        .trim()
        .min(1, 'must be at least 1 character')
        .max(255, 'must be 255 characters or less')
        .required('name is required'),
      filename: Yup.string()
        .trim()
        .min(1, 'must be at least 1 character')
        .max(255, 'must be 255 characters or less')
        .required('filename is required')
        .test('is-valid-filename', function (value) {
          const isValid = validateName(value);
          return isValid ? true : this.createError({ message: validateNameError(value) });
        })
        .test(
          'not-reserved',
          `The file names "collection" and "folder" are reserved in bruno`,
          (value) => !['collection', 'folder'].includes(value)
        )
    }),
    onSubmit: (values) => {
      const isGrpcRequest = values.requestType === 'grpc-request';
      const isWsRequest = values.requestType === 'ws-request';
      const filename = values.filename;

      if (isGrpcRequest) {
        dispatch(
          newGrpcRequest({
            requestName: values.requestName,
            filename: filename,
            requestType: values.requestType,
            requestUrl: values.requestUrl,
            collectionUid: collection.uid,
            itemUid: item ? item.uid : null
          })
        )
          .then(() => {
            toast.success('New request created!');
            onClose();
          })
          .catch((err) => toast.error(err ? err.message : 'An error occurred while adding the request'));

        // will need to handle import from grpcurl command when we support it, now it is just for creating new requests
      } else if (isWsRequest) {
        dispatch(newWsRequest({
          requestName: values.requestName,
          requestMethod: values.requestMethod,
          filename: filename,
          requestType: values.requestType,
          requestUrl: values.requestUrl,
          collectionUid: collection.uid,
          itemUid: item ? item.uid : null
        }))
          .then(() => {
            toast.success('New request created!');
            onClose();
          })
          .catch((err) => toast.error(err ? err.message : 'An error occurred while adding the request'));
      } else if (isEphemeral) {
        const uid = uuid();
        dispatch(
          newEphemeralHttpRequest({
            uid: uid,
            requestName: values.requestName,
            filename: filename,
            requestType: values.requestType,
            requestUrl: values.requestUrl,
            requestMethod: values.requestMethod,
            collectionUid: collectionUid
          })
        )
          .then(() => {
            dispatch(
              addTab({
                uid: uid,
                collectionUid: collectionUid,
                requestPaneTab: getDefaultRequestPaneTab({ type: values.requestType })
              })
            );
            onClose();
          })
          .catch((err) => toast.error(err ? err.message : 'An error occurred while adding the request'));
      } else {
        dispatch(
          newHttpRequest({
            requestName: values.requestName,
            filename: filename,
            requestType: values.requestType,
            requestUrl: values.requestUrl,
            requestMethod: values.requestMethod,
            collectionUid: collectionUid,
            itemUid: item ? item.uid : null
          })
        )
          .then(() => {
            toast.success('New request created!');
            onClose();
          })
          .catch((err) => toast.error(err ? err.message : 'An error occurred while adding the request'));
      }
    }
  });

  useEffect(() => {
    if (inputRef && inputRef.current) {
      inputRef.current.focus();
    }
  }, [inputRef]);

  return (
    <Portal>
      <StyledWrapper>
        <Modal size="md" title="New Request" hideFooter handleCancel={onClose}>
          <form
            className="bruno-form"
            onSubmit={formik.handleSubmit}
          >
            <div>
              <label id="new-request-type-label" className="block font-medium">
                Type
              </label>

              <div className="mt-2">
                <SegmentedControl
                  ariaLabelledBy="new-request-type-label"
                  name="requestType"
                  fullWidth
                  value={formik.values.requestType}
                  onChange={(value) => formik.setFieldValue('requestType', value)}
                  items={REQUEST_TYPE_OPTIONS.map(({ value, label, Icon, getColor }) => ({
                    value,
                    label,
                    'icon': <Icon size={16} strokeWidth={1.5} style={{ color: getColor(storedTheme.request) }} />,
                    'data-testid': value
                  }))}
                />
              </div>
            </div>
            <div className="mt-4">
              <label htmlFor="requestName" className="block font-medium">
                Request Name
              </label>
              <input
                id="request-name"
                type="text"
                name="requestName"
                placeholder="Request Name"
                ref={inputRef}
                className="block textbox mt-2 w-full"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                onChange={(e) => {
                  formik.setFieldValue('requestName', e.target.value);
                  formik.setFieldValue('filename', sanitizeName(e.target.value));
                }}
                value={formik.values.requestName || ''}
                data-testid="request-name"
              />
              {formik.touched.requestName && (formik.errors.requestName || formik.errors.filename) ? (
                <div className="text-red-500" data-testid="form-error">{formik.errors.requestName || formik.errors.filename}</div>
              ) : null}
            </div>
            <div className="mt-4">
              <label htmlFor="request-url" className="block font-medium">
                URL
              </label>
              <div className="flex items-center mt-2 ">
                {!['grpc-request', 'ws-request'].includes(formik.values.requestType) ? (
                  <div className="flex items-center h-full method-selector-container">
                    <HttpMethodSelector
                      method={formik.values.requestMethod}
                      onMethodSelect={(val) => formik.setFieldValue('requestMethod', val)}
                      showCaret
                    />
                  </div>
                ) : null}
                <div
                  id="new-request-url"
                  data-testid="new-request-url"
                  className="flex px-2 items-center flex-grow input-container h-full min-w-0"
                >
                  <SingleLineEditor
                    onRun={() => formik.handleSubmit()}
                    placeholder="Request URL"
                    value={formik.values.requestUrl || ''}
                    theme={storedTheme}
                    onChange={(value) => {
                      formik.handleChange({
                        target: {
                          name: 'requestUrl',
                          value: value
                        }
                      });
                    }}
                    collection={collection}
                    item={item}
                    variablesAutocomplete={true}
                  />
                </div>
              </div>
              {formik.touched.requestUrl && formik.errors.requestUrl ? (
                <div className="text-red-500">{formik.errors.requestUrl}</div>
              ) : null}
            </div>
            <div className="flex justify-end items-center mt-8 bruno-modal-footer">
              <Button type="button" color="secondary" variant="ghost" onClick={onClose} className="mr-2">
                Cancel
              </Button>
              <Button type="submit" data-testid="create-new-request-button">
                Create
              </Button>
            </div>
          </form>
        </Modal>
      </StyledWrapper>
    </Portal>
  );
};

export default NewRequest;
