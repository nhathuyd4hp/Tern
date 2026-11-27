import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { ThemeProvider } from 'styled-components';
import themes from 'themes/index';
import { ThemeContext } from 'providers/Theme';
import { createCollection } from 'providers/ReduxStore/slices/collections/actions';
import { resolveApplicationName } from 'providers/ReduxStore/slices/open-collection-modal/actions';
import { setApplicationColor } from 'utils/application-color';
import CreateCollection from './index';

jest.mock('nanoid', () => ({ customAlphabet: () => () => 'mock-id' }));
jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
jest.mock('providers/ReduxStore/slices/collections/actions', () => ({
  createCollection: jest.fn(),
  mountCollection: jest.fn(),
  newFolder: jest.fn(),
  updateBrunoConfig: jest.fn()
}));
jest.mock('providers/ReduxStore/slices/open-collection-modal/actions', () => ({ resolveApplicationName: jest.fn() }));
jest.mock('utils/application-color', () => ({
  ...jest.requireActual('utils/application-color'),
  setApplicationColor: jest.fn()
}));

const renderCreate = () => {
  const store = configureStore({
    reducer: {
      app: (state = { preferences: { general: { defaultLocation: 'C:\\apps' } } }) => state,
      collections: (state = { collections: [] }) => state,
      workspaces: (state = { workspaces: [], activeWorkspaceUid: null }) => state
    }
  });
  const onClose = jest.fn();
  render(
    <Provider store={store}>
      <ThemeContext.Provider value={{ theme: themes.light }}>
        <ThemeProvider theme={themes.light}>
          <CreateCollection onClose={onClose} />
        </ThemeProvider>
      </ThemeContext.Provider>
    </Provider>
  );
  return { onClose };
};

const create = (name) => {
  fireEvent.change(document.getElementById('collection-name'), { target: { value: name } });
  fireEvent.submit(document.querySelector('form'));
};

describe('CreateCollection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createCollection.mockReturnValue(() => Promise.resolve({ pathname: 'C:\\apps\\Orders', uid: 'new' }));
    resolveApplicationName.mockImplementation((name) => () => Promise.resolve({ name: name.trim() }));
  });

  it('has no location to choose and says where applications are stored', () => {
    renderCreate();

    expect(screen.queryByText('Browse')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Location')).not.toBeInTheDocument();
    expect(screen.getByTestId('create-location-note')).toHaveTextContent('Applications are stored in C:\\apps');
  });

  it('creates the application in the default location, taking only the names', async () => {
    renderCreate();

    create('Orders');

    await waitFor(() => expect(createCollection).toHaveBeenCalledWith('Orders', 'Orders'));
    expect(setApplicationColor).not.toHaveBeenCalled();
  });

  it('stores the color that was picked once the application is created', async () => {
    renderCreate();

    fireEvent.click(screen.getAllByRole('radio', { name: '#10b981' })[0]);
    expect(screen.getByTestId('create-application-logo')).toHaveStyle({ color: '#10b981' });
    create('Orders');

    await waitFor(() => expect(setApplicationColor).toHaveBeenCalledWith({ pathname: 'C:\\apps\\Orders', uid: 'new' }, '#10b981'));
  });

  it('stores no color after going back to the automatic one', async () => {
    renderCreate();

    fireEvent.click(screen.getAllByRole('radio', { name: '#10b981' })[0]);
    fireEvent.click(screen.getByTestId('create-color-automatic'));
    create('Orders');

    await waitFor(() => expect(createCollection).toHaveBeenCalled());
    expect(setApplicationColor).not.toHaveBeenCalled();
  });

  it('creates under the other name the user chose for a name already in use', async () => {
    resolveApplicationName.mockImplementation(() => () => Promise.resolve({ name: 'Orders 2' }));
    renderCreate();

    create('Orders');

    await waitFor(() => expect(createCollection).toHaveBeenCalledWith('Orders 2', 'Orders 2'));
  });

  it('creates nothing and closes when the existing application is kept', async () => {
    resolveApplicationName.mockImplementation(() => () => Promise.resolve({ stop: 'keep' }));
    const { onClose } = renderCreate();

    create('Orders');

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(createCollection).not.toHaveBeenCalled();
  });

  it('creates nothing and stays open when the question is cancelled', async () => {
    resolveApplicationName.mockImplementation(() => () => Promise.resolve({ stop: 'cancel' }));
    const { onClose } = renderCreate();

    create('Orders');

    await waitFor(() => expect(resolveApplicationName).toHaveBeenCalled());
    expect(createCollection).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
