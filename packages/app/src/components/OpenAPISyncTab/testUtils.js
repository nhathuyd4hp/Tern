import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { ThemeProvider } from 'styled-components';
import { render } from '@testing-library/react';
import themes from 'themes/index';

export const validOpenApiSpec = { openapi: '3.0.0', info: { title: 'Pets' }, paths: {} };

export const renderWithTheme = (ui) => {
  const store = configureStore({ reducer: { openapiSync: (state = {}) => state } });
  return render(
    <Provider store={store}>
      <ThemeProvider theme={themes.light}>{ui}</ThemeProvider>
    </Provider>
  );
};
