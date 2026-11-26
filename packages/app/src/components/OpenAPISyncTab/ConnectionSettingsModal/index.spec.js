import '@testing-library/jest-dom';
import React from 'react';
import toast from 'react-hot-toast';
import { fireEvent, waitFor } from '@testing-library/react';
import { renderWithTheme } from 'components/OpenAPISyncTab/testUtils';
import ConnectionSettingsModal from './index';

jest.mock('react-hot-toast', () => ({ __esModule: true, default: { error: jest.fn(), success: jest.fn() } }));

const collectionWithSource = (sourceUrl) => ({
  pathname: '/ws/collections/pets-api',
  brunoConfig: { openapi: [{ sourceUrl, autoCheck: true, autoCheckInterval: 15 }] }
});

const renderModal = (sourceUrl) => {
  const onSave = jest.fn().mockResolvedValue();
  const utils = renderWithTheme(
    <ConnectionSettingsModal
      collection={collectionWithSource(sourceUrl)}
      sourceUrl={sourceUrl}
      onSave={onSave}
      onDisconnect={jest.fn()}
      onClose={jest.fn()}
    />
  );
  return { ...utils, onSave };
};

describe('ConnectionSettingsModal', () => {
  afterEach(() => {
    toast.error.mockClear();
  });

  it('names the source tabs without an orphan label element', () => {
    const { getByRole, getByText } = renderModal('../../specs/pets.yaml');

    expect(getByRole('tablist', { name: 'Spec source' })).toBeInTheDocument();
    expect(getByText('Spec Source').tagName).not.toBe('LABEL');
  });

  it('opens on the File tab for a file source', async () => {
    const { findByTestId, getByTestId } = renderModal('../../../downloads/other.yaml');

    expect(await findByTestId('tab-file')).toHaveAttribute('aria-selected', 'true');
    expect(getByTestId('spec-source-file-button')).toHaveTextContent('other.yaml');
  });

  it('opens on the URL tab for a URL source', async () => {
    const { findByTestId, getByTestId } = renderModal('https://api.example.com/openapi.json');

    expect(await findByTestId('tab-url')).toHaveAttribute('aria-selected', 'true');
    expect(getByTestId('spec-source-url-input')).toHaveValue('https://api.example.com/openapi.json');
  });

  it('keeps the connected source when saved without changes', async () => {
    const { getByRole, onSave } = renderModal('../../specs/pets.yaml');

    fireEvent.click(getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ sourceUrl: '/ws/specs/pets.yaml' })
    ));
  });

  it('saves a newly entered URL with the auto-check settings', async () => {
    const { findByTestId, getByRole, getByTestId, onSave } = renderModal('../../specs/pets.yaml');

    fireEvent.click(await findByTestId('tab-url'));
    fireEvent.change(getByTestId('spec-source-url-input'), { target: { value: 'https://api.example.com/openapi.json' } });
    fireEvent.click(getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({
      sourceUrl: 'https://api.example.com/openapi.json',
      autoCheck: true,
      autoCheckInterval: 15
    }));
  });

  it('keeps the connected file when a browse fails', async () => {
    const { getByRole, getByTestId } = renderModal('../../../downloads/other.yaml');
    const file = new File(['{ not json'], 'broken.json', { type: 'application/json' });
    file.text = () => Promise.resolve('{ not json');

    fireEvent.change(getByTestId('spec-source-file-input'), { target: { files: [file] } });

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
      'Failed to parse the file – ensure it is valid JSON or YAML'
    ));
    expect(getByTestId('spec-source-file-button')).toHaveTextContent('other.yaml');
    expect(getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('blocks saving on a tab that has no source yet', async () => {
    const { findByTestId, getByRole } = renderModal('../../specs/pets.yaml');

    fireEvent.click(await findByTestId('tab-url'));
    expect(getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('keeps what was entered on each tab when switching between them', async () => {
    const { findByTestId, getByTestId } = renderModal('../../specs/pets.yaml');

    fireEvent.click(await findByTestId('tab-url'));
    fireEvent.change(getByTestId('spec-source-url-input'), { target: { value: 'https://api.example.com/openapi.json' } });
    fireEvent.click(await findByTestId('tab-file'));

    expect(getByTestId('spec-source-file-button')).toHaveTextContent('pets.yaml');

    fireEvent.click(await findByTestId('tab-url'));
    expect(getByTestId('spec-source-url-input')).toHaveValue('https://api.example.com/openapi.json');
  });
});
