import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { ThemeProvider } from 'styled-components';
import themes from 'themes/index';
import { ThemeContext } from 'providers/Theme';
import { renameCollection } from 'providers/ReduxStore/slices/collections/actions';
import RenameCollection from './index';

jest.mock('nanoid', () => ({ customAlphabet: () => () => 'mock-id' }));
jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
jest.mock('providers/ReduxStore/slices/collections/actions', () => ({ renameCollection: jest.fn() }));

const collections = [
  { uid: 'a', name: 'Orders', pathname: '/apps/Orders', items: [] },
  { uid: 'b', name: 'Billing', pathname: '/apps/Billing', items: [] }
];

const renderRename = () => {
  const store = configureStore({
    reducer: {
      collections: (state = { collections }) => state,
      workspaces: (state = { workspaces: [{ uid: 'w1', collections: [{ path: '/apps/Orders' }, { path: '/apps/Billing' }] }], activeWorkspaceUid: 'w1' }) => state
    }
  });
  const onClose = jest.fn();
  render(
    <Provider store={store}>
      <ThemeContext.Provider value={{ theme: themes.light }}>
        <ThemeProvider theme={themes.light}>
          <RenameCollection collectionUid="a" onClose={onClose} />
        </ThemeProvider>
      </ThemeContext.Provider>
    </Provider>
  );
  return { onClose };
};

const submitName = (name) => {
  fireEvent.change(screen.getByTestId('rename-collection-name-input'), { target: { value: name } });
  fireEvent.click(screen.getByText('Rename'));
};

describe('RenameCollection', () => {
  beforeEach(() => {
    renameCollection.mockReset();
    renameCollection.mockReturnValue(() => Promise.resolve());
  });

  it('refuses a name another application already has, in any case', async () => {
    renderRename();

    submitName(' billing ');

    expect(await screen.findByText('An application with this name already exists')).toBeInTheDocument();
    expect(renameCollection).not.toHaveBeenCalled();
  });

  it('renames to a free name, and keeps its own name allowed', async () => {
    const { onClose } = renderRename();

    submitName('ORDERS');
    await waitFor(() => expect(renameCollection).toHaveBeenCalledWith('ORDERS', 'a'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
