/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { ThemeProvider } from 'styled-components';

const mockDispatch = jest.fn();

jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useDispatch: () => mockDispatch
}));

jest.mock('providers/ReduxStore/slices/collections', () => ({
  updateResponseExampleStatusCode: (payload) => ({ type: 'updateResponseExampleStatusCode', payload }),
  updateResponseExampleStatusText: (payload) => ({ type: 'updateResponseExampleStatusText', payload })
}));

jest.mock('./StyledWrapper', () => {
  return function MockStyledWrapper({ children, className }) {
    return <div className={className}>{children}</div>;
  };
});

import themes from 'themes/index';
import ResponseExampleStatusInput from './index';

const item = { uid: 'item-1' };
const collection = { uid: 'col-1' };

const renderStatusInput = (props = {}) => {
  const store = configureStore({
    reducer: {
      collections: (state = {}) => state
    }
  });

  return render(
    <Provider store={store}>
      <ThemeProvider theme={themes.dark}>
        <ResponseExampleStatusInput
          item={item}
          collection={collection}
          exampleUid="ex-1"
          status={200}
          statusText="OK"
          {...props}
        />
      </ThemeProvider>
    </Provider>
  );
};

const openSelect = () => fireEvent.click(screen.getByTestId('response-status-input'));

describe('ResponseExampleStatusInput', () => {
  beforeAll(() => {
    window.HTMLElement.prototype.scrollIntoView = jest.fn();
  });

  beforeEach(() => {
    mockDispatch.mockClear();
  });

  it('renders the themed select showing the current status', () => {
    renderStatusInput({ status: 404, statusText: 'Not Found' });

    expect(screen.getByTestId('response-status-input')).toHaveTextContent('404 Not Found');
  });

  it('shows a placeholder when status is empty instead of inventing 200', () => {
    renderStatusInput({ status: '', statusText: '' });

    expect(screen.getByTestId('response-status-input')).toHaveTextContent('Select status');
  });

  it('keeps a custom statusText label for a known status code', () => {
    renderStatusInput({ status: 200, statusText: 'All Good' });
    openSelect();

    expect(screen.getByRole('option', { name: '200 All Good' })).toBeInTheDocument();
  });

  it('includes a custom status option when the current code is unknown', () => {
    renderStatusInput({ status: 999, statusText: 'Custom Error' });

    expect(screen.getByTestId('response-status-input')).toHaveTextContent('999 Custom Error');
  });

  it('dispatches status code and text when a known option is selected', () => {
    renderStatusInput({ status: 200, statusText: 'OK' });
    openSelect();

    fireEvent.click(screen.getByRole('option', { name: '404 Not Found' }));

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'updateResponseExampleStatusCode',
      payload: {
        itemUid: 'item-1',
        collectionUid: 'col-1',
        exampleUid: 'ex-1',
        statusCode: '404'
      }
    });
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'updateResponseExampleStatusText',
      payload: {
        itemUid: 'item-1',
        collectionUid: 'col-1',
        exampleUid: 'ex-1',
        statusText: 'Not Found'
      }
    });
  });
});
