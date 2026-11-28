import React from 'react';
import { act, createEvent, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { ThemeProvider } from 'providers/Theme';
import openCollectionModalReducer, {
  collectionsOpeningEnded,
  collectionsOpeningStarted,
  hideOpenCollectionModal,
  showOpenCollectionModal
} from 'providers/ReduxStore/slices/open-collection-modal';
import OpenCollectionModal from 'components/OpenCollectionModal';
import ModalShell from './index';

jest.mock('nanoid', () => {
  let count = 0;
  return { customAlphabet: () => () => `mock-id-${(count += 1)}` };
});
jest.mock('../ChooseFolderPage', () => ({
  __esModule: true,
  default: () => (
    <div>
      <a href="#docs" data-testid="page-link">Docs</a>
      <input type="checkbox" aria-label="Option" data-testid="page-checkbox" />
      <input type="file" hidden />
    </div>
  )
}));

const closedState = openCollectionModalReducer(undefined, { type: 'init' });

const createStore = (openCollectionModal = { isOpen: true }) =>
  configureStore({
    reducer: { openCollectionModal: openCollectionModalReducer },
    preloadedState: { openCollectionModal: { ...closedState, ...openCollectionModal } }
  });

const renderWithStore = (ui, store) =>
  render(
    <Provider store={store}>
      <ThemeProvider>{ui}</ThemeProvider>
    </Provider>
  );

const renderShell = () => {
  const store = createStore({ isOpen: true });
  renderWithStore(<ModalShell />, store);
  return store;
};

const isOpen = (store) => store.getState().openCollectionModal.isOpen;

describe('ModalShell', () => {
  beforeAll(() => {
    Element.prototype.checkVisibility = function () {
      return !this.closest('[hidden]');
    };
  });

  afterAll(() => {
    delete Element.prototype.checkVisibility;
  });

  it('shows the import title and description', () => {
    renderShell();

    expect(screen.getByTestId('open-collection-page-title')).toHaveTextContent('Import application');
    expect(screen.getByText('Pick a folder or a .zip file with a Tern application.')).toBeInTheDocument();
    expect(screen.getByTestId('open-collection-page-choose-folder')).toBeInTheDocument();
  });

  it('shows that applications are opening over the page and keeps the page out of reach', () => {
    const store = createStore({ isOpen: true, openingId: 'opening-1' });
    renderWithStore(<ModalShell />, store);

    const page = screen.getByTestId('open-collection-page-choose-folder');
    expect(within(page).getByTestId('open-collection-busy')).toHaveTextContent('Opening…');
    expect(page.querySelector('.modal-page-content')).toHaveAttribute('inert');
  });

  it('keeps Tab inside the dialog while the page is out of reach', () => {
    const store = createStore({ isOpen: true, openingId: 'opening-1' });
    renderWithStore(<ModalShell />, store);
    const close = screen.getByTestId('open-collection-close');
    close.focus();

    fireEvent.keyDown(close, { key: 'Tab' });
    expect(close).toHaveFocus();

    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(close).toHaveFocus();
  });

  it('gives focus back to the page once nothing opened', async () => {
    const store = renderShell();
    const checkbox = screen.getByTestId('page-checkbox');
    checkbox.focus();

    act(() => {
      store.dispatch(collectionsOpeningStarted('opening-1'));
    });
    checkbox.blur();
    act(() => {
      store.dispatch(collectionsOpeningEnded('opening-1'));
    });

    await waitFor(() => expect(checkbox).toHaveFocus());
  });

  describe('dragging over the modal', () => {
    const fileDrag = { types: ['Files'] };
    const dialog = () => screen.getByTestId('open-collection-modal');
    const queryOverlay = () => screen.queryByTestId('open-collection-drop-overlay');
    const dragLeaveTo = (relatedTarget) => {
      const event = createEvent.dragLeave(dialog(), { dataTransfer: fileDrag });
      Object.defineProperty(event, 'relatedTarget', { value: relatedTarget });
      fireEvent(dialog(), event);
    };

    it('shows the drop overlay while files are over it and hides it when they leave', () => {
      renderShell();

      fireEvent.dragEnter(dialog(), { dataTransfer: fileDrag });
      expect(queryOverlay()).toHaveTextContent('Drop to open');

      dragLeaveTo(screen.getByTestId('open-collection-backdrop'));
      expect(queryOverlay()).not.toBeInTheDocument();
    });

    it('hides the overlay when the drag leaves the window', () => {
      renderShell();

      fireEvent.dragEnter(dialog(), { dataTransfer: fileDrag });
      dragLeaveTo(null);

      expect(queryOverlay()).not.toBeInTheDocument();
    });

    it('keeps the overlay while the drag moves between elements inside the modal', () => {
      renderShell();

      fireEvent.dragEnter(dialog(), { dataTransfer: fileDrag });
      fireEvent.dragEnter(screen.getByTestId('page-link'), { dataTransfer: fileDrag });
      dragLeaveTo(screen.getByTestId('page-link'));

      expect(queryOverlay()).toBeInTheDocument();
    });

    it('leaves a dragged link or text to the field under it', () => {
      renderShell();
      const textDrag = { types: ['text/plain'] };

      expect(fireEvent.dragOver(dialog(), { dataTransfer: textDrag })).toBe(true);
      expect(fireEvent.drop(dialog(), { dataTransfer: textDrag })).toBe(true);
    });

    it('ignores a drag that carries no files', () => {
      renderShell();

      fireEvent.dragEnter(dialog(), { dataTransfer: { types: ['text/plain'] } });

      expect(queryOverlay()).not.toBeInTheDocument();
    });

    it('does not offer a drop while applications are opening', () => {
      const store = createStore({ isOpen: true, openingId: 'opening-1' });
      renderWithStore(<ModalShell />, store);

      fireEvent.dragEnter(dialog(), { dataTransfer: fileDrag });

      expect(queryOverlay()).not.toBeInTheDocument();
    });

    it('offers the drop once applications finish opening during the drag', () => {
      const store = createStore({ isOpen: true, openingId: 'opening-1' });
      renderWithStore(<ModalShell />, store);

      fireEvent.dragEnter(dialog(), { dataTransfer: fileDrag });
      act(() => {
        store.dispatch(collectionsOpeningEnded('opening-1'));
      });

      expect(queryOverlay()).toBeInTheDocument();
    });

    it('hides the overlay on drop and stays on the page when only files were dropped', async () => {
      window.ipcRenderer = { getFilePath: jest.fn(), send: jest.fn() };
      renderShell();
      const file = { name: 'notes.json', text: () => Promise.resolve('{}') };
      const item = { kind: 'file', webkitGetAsEntry: () => ({ isDirectory: false }), getAsFile: () => file };

      fireEvent.dragEnter(dialog(), { dataTransfer: fileDrag });
      fireEvent.drop(dialog(), { dataTransfer: { ...fileDrag, items: [item] } });

      expect(queryOverlay()).not.toBeInTheDocument();
      delete window.ipcRenderer;
    });
  });

  it('leaves the note without an action when it names no file', () => {
    const result = { id: 'search-1', type: 'message', note: { tone: 'info', text: 'Not an application.' } };
    const store = createStore({ isOpen: true, chooseFolder: { ...closedState.chooseFolder, result } });
    renderWithStore(<ModalShell />, store);

    expect(screen.queryByTestId('open-collection-note-action')).not.toBeInTheDocument();
  });

  it('leaves the page reachable when nothing is opening', () => {
    renderShell();

    const page = screen.getByTestId('open-collection-page-choose-folder');
    expect(page.querySelector('.modal-page-content')).not.toHaveAttribute('inert');
  });

  it('is a modal dialog labelled by its heading', () => {
    renderShell();

    expect(screen.getByRole('dialog', { name: 'Import application' })).toHaveAttribute('aria-modal', 'true');
  });

  it('closes from the Close button', () => {
    const store = renderShell();

    fireEvent.click(screen.getByTestId('open-collection-close'));

    expect(isOpen(store)).toBe(false);
  });

  it('closes when the backdrop is clicked', () => {
    const store = renderShell();

    fireEvent.click(screen.getByTestId('open-collection-backdrop'));

    expect(isOpen(store)).toBe(false);
  });

  it('closes on Escape', () => {
    const store = renderShell();

    fireEvent.keyDown(screen.getByTestId('open-collection-close'), { key: 'Escape' });

    expect(isOpen(store)).toBe(false);
  });

  it('closes on Escape when focus has left the dialog', () => {
    const store = renderShell();

    fireEvent.keyDown(document.body, { key: 'Escape' });

    expect(isOpen(store)).toBe(false);
  });

  it('stays open while applications are opening', () => {
    const store = createStore({ isOpen: true, openingId: 'opening-1' });
    renderWithStore(<ModalShell />, store);

    fireEvent.click(screen.getByTestId('open-collection-close'));
    fireEvent.click(screen.getByTestId('open-collection-backdrop'));
    fireEvent.keyDown(document.body, { key: 'Escape' });

    expect(isOpen(store)).toBe(true);
  });

  it('stays open when an inner control already handled Escape', () => {
    const store = renderShell();
    const item = screen.getByTestId('open-collection-close');
    item.addEventListener('keydown', (event) => event.preventDefault());

    fireEvent.keyDown(item, { key: 'Escape' });

    expect(isOpen(store)).toBe(true);
  });

  it('moves focus into the dialog when it opens', () => {
    renderShell();

    expect(screen.getByTestId('open-collection-modal')).toHaveFocus();
  });

  it('shows the Choose collection note between the header and the page, and dismisses it', () => {
    const note = { tone: 'info', text: 'work isn’t an application itself, but it has 2 applications inside. Pick the ones to open.' };
    const store = createStore({
      isOpen: true,
      chooseFolder: { ...closedState.chooseFolder, result: { id: 'search-1', type: 'list', collections: [], preselect: [], note } }
    });
    renderWithStore(<ModalShell />, store);

    const shownNote = screen.getByTestId('open-collection-note');
    expect(shownNote).toHaveTextContent(note.text);
    expect(shownNote.closest('.modal-page')).toBeNull();

    fireEvent.click(screen.getByTestId('open-collection-note-dismiss'));

    expect(screen.queryByTestId('open-collection-note')).not.toBeInTheDocument();
    expect(store.getState().openCollectionModal.chooseFolder.result.note).toBeNull();
  });

  it('moves focus to the page when the focused note is dismissed', () => {
    const store = createStore({
      isOpen: true,
      chooseFolder: { ...closedState.chooseFolder, result: { id: 'search-1', type: 'message', note: { tone: 'info', text: 'Note' } } }
    });
    renderWithStore(<ModalShell />, store);
    const dismiss = screen.getByTestId('open-collection-note-dismiss');
    dismiss.focus();

    fireEvent.click(dismiss);

    expect(screen.getByTestId('page-link')).toHaveFocus();
  });

  it('wraps Tab from the last tabbable element to the first, skipping hidden ones', () => {
    renderShell();
    const checkbox = screen.getByTestId('page-checkbox');
    checkbox.focus();

    fireEvent.keyDown(checkbox, { key: 'Tab' });

    expect(screen.getByTestId('open-collection-close')).toHaveFocus();
  });

  it('wraps Shift+Tab from the first tabbable element to the last', () => {
    renderShell();
    const first = screen.getByTestId('open-collection-close');
    first.focus();

    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });

    expect(screen.getByTestId('page-checkbox')).toHaveFocus();
  });

  it('lets Tab move between elements in the middle of the dialog', () => {
    renderShell();
    const link = screen.getByTestId('page-link');
    link.focus();

    const event = fireEvent.keyDown(link, { key: 'Tab' });

    expect(event).toBe(true);
    expect(link).toHaveFocus();
  });

  it('moves Tab from the dialog itself to its first tabbable element', () => {
    renderShell();
    const dialog = screen.getByTestId('open-collection-modal');
    dialog.focus();

    fireEvent.keyDown(dialog, { key: 'Tab' });

    expect(screen.getByTestId('open-collection-close')).toHaveFocus();
  });

  it('moves Shift+Tab from the dialog itself to its last tabbable element', () => {
    renderShell();
    const dialog = screen.getByTestId('open-collection-modal');
    dialog.focus();

    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });

    expect(screen.getByTestId('page-checkbox')).toHaveFocus();
  });

  it('brings Tab back into the dialog when focus has left it', () => {
    renderShell();
    document.activeElement.blur();

    fireEvent.keyDown(document.body, { key: 'Tab' });

    expect(screen.getByTestId('open-collection-close')).toHaveFocus();
  });

  it('takes focus back when a control behind it grabs focus', () => {
    const store = createStore();
    renderWithStore(
      <>
        <ModalShell />
        <input data-testid="background-search" aria-label="Search sidebar" />
      </>,
      store
    );
    const closeButton = screen.getByTestId('open-collection-close');
    closeButton.focus();

    screen.getByTestId('background-search').focus();

    expect(closeButton).toHaveFocus();
  });

  it('closes on Escape pressed on a control behind it', () => {
    const store = createStore();
    renderWithStore(
      <>
        <ModalShell />
        <button type="button" data-testid="background-button">Background</button>
      </>,
      store
    );

    fireEvent.keyDown(screen.getByTestId('background-button'), { key: 'Escape' });

    expect(isOpen(store)).toBe(false);
  });

  it('leaves Tab and Escape to another dialog that has focus', () => {
    const store = createStore();
    renderWithStore(
      <>
        <ModalShell />
        <div role="dialog">
          <button type="button" data-testid="other-dialog-button">Other</button>
        </div>
      </>,
      store
    );
    const otherButton = screen.getByTestId('other-dialog-button');
    otherButton.focus();

    expect(fireEvent.keyDown(otherButton, { key: 'Tab' })).toBe(true);
    expect(fireEvent.keyDown(otherButton, { key: 'Escape' })).toBe(true);
    expect(otherButton).toHaveFocus();
    expect(isOpen(store)).toBe(true);
  });

  it('returns focus to the element that opened it', () => {
    const store = createStore({ isOpen: false });
    renderWithStore(
      <>
        <button type="button" data-testid="opener">Open</button>
        <OpenCollectionModal />
      </>,
      store
    );
    const opener = screen.getByTestId('opener');
    opener.focus();

    act(() => {
      store.dispatch(showOpenCollectionModal());
    });
    expect(opener).not.toHaveFocus();

    act(() => {
      store.dispatch(hideOpenCollectionModal());
    });
    expect(screen.queryByTestId('open-collection-modal')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('stops handling keys once it is closed', () => {
    const store = createStore({ isOpen: true });
    renderWithStore(<OpenCollectionModal />, store);

    act(() => {
      store.dispatch(hideOpenCollectionModal());
    });
    act(() => {
      store.dispatch(showOpenCollectionModal());
    });
    act(() => {
      store.dispatch(hideOpenCollectionModal());
    });
    const event = fireEvent.keyDown(document.body, { key: 'Escape' });

    expect(event).toBe(true);
  });
});
