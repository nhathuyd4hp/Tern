import '@testing-library/jest-dom';
import React, { useState } from 'react';
import { fireEvent, waitFor } from '@testing-library/react';
import { renderWithTheme } from 'components/OpenAPISyncTab/testUtils';
import ConnectSpecForm from './index';

const ConnectSpecFormHost = ({ onConnect }) => {
  const [sourceUrl, setSourceUrl] = useState('');
  const [error, setError] = useState(null);

  return (
    <ConnectSpecForm
      sourceUrl={sourceUrl}
      setSourceUrl={setSourceUrl}
      isLoading={false}
      error={error}
      setError={setError}
      onConnect={onConnect}
    />
  );
};

const renderForm = () => {
  const onConnect = jest.fn();
  const utils = renderWithTheme(<ConnectSpecFormHost onConnect={onConnect} />);
  return { ...utils, onConnect };
};

describe('ConnectSpecForm', () => {
  it('shows the OpenAPI sync icon above the title', () => {
    const { getByTestId, getByRole } = renderForm();
    const icon = getByTestId('openapi-connect-icon');
    const title = getByRole('heading', { name: 'Connect to OpenAPI Spec' });

    expect(icon.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('opens on the URL tab with its hint', () => {
    const { getByTestId, getByText } = renderForm();

    expect(getByTestId('tab-url')).toHaveAttribute('aria-selected', 'true');
    expect(getByText('Supports OpenAPI 3.x specifications in JSON or YAML format')).toBeInTheDocument();
  });

  it('clears a browsed file when the next browse fails', async () => {
    const originalIpcRenderer = window.ipcRenderer;
    window.ipcRenderer = { getFilePath: jest.fn().mockReturnValue('/specs/pets.json') };
    const { getByRole, getByTestId, findByText } = renderForm();
    const chooseFile = (contents) => {
      const file = new File([contents], 'pets.json', { type: 'application/json' });
      file.text = () => Promise.resolve(contents);
      fireEvent.change(getByTestId('spec-source-file-input'), { target: { files: [file] } });
    };
    fireEvent.click(getByTestId('tab-file'));

    chooseFile(JSON.stringify({ openapi: '3.0.0', info: { title: 'Pets' }, paths: {} }));
    await waitFor(() => expect(getByRole('button', { name: 'Connect' })).toBeEnabled());

    chooseFile('{ not json');

    expect(await findByText('Failed to parse the file – ensure it is valid JSON or YAML')).toBeInTheDocument();
    expect(getByTestId('spec-source-file-button')).toHaveTextContent('Select File');
    expect(getByRole('button', { name: 'Connect' })).toBeDisabled();
    window.ipcRenderer = originalIpcRenderer;
  });

  it('announces a validation error to screen readers', async () => {
    const originalIpcRenderer = window.ipcRenderer;
    window.ipcRenderer = { getFilePath: jest.fn().mockReturnValue('/specs/legacy.json') };
    const { getByRole, getByTestId } = renderForm();
    fireEvent.click(getByTestId('tab-file'));
    const contents = JSON.stringify({ swagger: '2.0', info: { title: 'Legacy' }, paths: {} });
    const file = new File([contents], 'legacy.json', { type: 'application/json' });
    file.text = () => Promise.resolve(contents);

    fireEvent.change(getByTestId('spec-source-file-input'), { target: { files: [file] } });

    await waitFor(() => expect(getByRole('alert')).toHaveTextContent('Swagger 2.0 is not supported. Please convert your spec to OpenAPI 3.x.'));
    window.ipcRenderer = originalIpcRenderer;
  });

  it('clears the source and its error when switching tabs', async () => {
    const { getByTestId } = renderForm();

    fireEvent.change(getByTestId('spec-source-url-input'), { target: { value: 'https://api.example.com/openapi.json' } });
    fireEvent.click(getByTestId('tab-file'));
    fireEvent.click(getByTestId('tab-url'));

    expect(getByTestId('spec-source-url-input')).toHaveValue('');
  });

  it('enables Connect on the URL tab only for an http URL and connects', () => {
    const { getByRole, getByTestId, onConnect } = renderForm();
    const urlInput = getByTestId('spec-source-url-input');

    fireEvent.change(urlInput, { target: { value: 'not a url' } });
    expect(getByRole('button', { name: 'Connect' })).toBeDisabled();

    fireEvent.change(urlInput, { target: { value: 'https://api.example.com/openapi.json' } });
    expect(getByRole('button', { name: 'Connect' })).toBeEnabled();

    fireEvent.click(getByRole('button', { name: 'Connect' }));
    expect(onConnect).toHaveBeenCalled();
  });

  it('shows the file hint on the File tab', () => {
    const { getByTestId, getByText } = renderForm();

    fireEvent.click(getByTestId('tab-file'));

    expect(getByText('Select a local OpenAPI/Swagger JSON or YAML file')).toBeInTheDocument();
  });
});
