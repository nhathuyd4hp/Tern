import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { ThemeProvider } from 'styled-components';
import { render } from '@testing-library/react';
import themes from 'themes/index';
import { ThemeContext } from 'providers/Theme';

export const validOpenApiSpec = { openapi: '3.0.0', info: { title: 'Pets' }, paths: {} };

export const renderWithTheme = (ui) => {
  const store = configureStore({ reducer: { openapiSync: (state = {}) => state, globalEnvironments: (state = { globalEnvironments: [], activeGlobalEnvironmentUid: null }) => state } });
  return render(
    <Provider store={store}>
      <ThemeContext.Provider value={{ theme: themes.light }}>
        <ThemeProvider theme={themes.light}>{ui}</ThemeProvider>
      </ThemeContext.Provider>
    </Provider>
  );
};
