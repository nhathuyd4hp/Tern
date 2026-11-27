import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { ThemeProvider } from 'styled-components';
import themes from 'themes/index';
import { ThemeContext } from 'providers/Theme';
import { askDuplicateApplication } from 'utils/duplicate-application';
import DuplicateApplicationModal from './index';

const renderModal = () => {
  const store = configureStore({
    reducer: { app: (state = { preferences: { general: { defaultLocation: 'C:\\apps' } } }) => state }
  });
  return render(
    <Provider store={store}>
      <ThemeContext.Provider value={{ theme: themes.light }}>
        <ThemeProvider theme={themes.light}>
          <DuplicateApplicationModal />
        </ThemeProvider>
      </ThemeContext.Provider>
    </Provider>
  );
};

const ask = (isTaken = () => false) => {
  let answer;
  act(() => {
    askDuplicateApplication({ name: 'Orders', isTaken }).then((value) => {
      answer = value;
    });
  });
  return () => answer;
};

describe('DuplicateApplicationModal', () => {
  it('shows nothing until a name is in question', () => {
    renderModal();

    expect(screen.queryByTestId('duplicate-application-modal')).not.toBeInTheDocument();
  });

  it('names the application and offers the three ways out', () => {
    renderModal();
    ask();

    expect(screen.getByText('“Orders” already exists')).toBeInTheDocument();
    expect(screen.getByTestId('duplicate-application-keep')).toBeInTheDocument();
    expect(screen.getByTestId('duplicate-application-replace')).toBeInTheDocument();
    expect(screen.getByTestId('duplicate-application-rename')).toBeInTheDocument();
  });

  it('keeps the existing application', async () => {
    renderModal();
    const answer = ask();

    await act(async () => {
      fireEvent.click(screen.getByTestId('duplicate-application-keep'));
    });

    expect(answer()).toEqual({ choice: 'keep' });
    expect(screen.queryByText('“Orders” already exists')).not.toBeInTheDocument();
  });

  it('uses the new one and says the old files stay on disk', async () => {
    renderModal();
    const answer = ask();

    expect(screen.getByText('The existing application leaves the workspace. Its files stay on disk.')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByTestId('duplicate-application-replace'));
    });

    expect(answer()).toEqual({ choice: 'replace' });
  });

  it('refuses another name that is taken or empty, then accepts a free one', async () => {
    renderModal();
    const answer = ask((name) => name === 'Billing');

    fireEvent.click(screen.getByTestId('duplicate-application-rename'));
    const input = screen.getByTestId('duplicate-application-name-input');

    fireEvent.change(input, { target: { value: 'Billing' } });
    fireEvent.click(screen.getByTestId('duplicate-application-continue'));
    expect(screen.getByTestId('duplicate-application-error')).toHaveTextContent('An application with this name already exists');

    fireEvent.change(input, { target: { value: '  ' } });
    fireEvent.click(screen.getByTestId('duplicate-application-continue'));
    expect(screen.getByTestId('duplicate-application-error')).toHaveTextContent('Application name is required');
    expect(answer()).toBeUndefined();

    fireEvent.change(input, { target: { value: ' Shipping ' } });
    await act(async () => {
      fireEvent.click(screen.getByTestId('duplicate-application-continue'));
    });

    expect(answer()).toEqual({ choice: 'rename', name: 'Shipping' });
  });
});
