import '@testing-library/jest-dom';
import React from 'react';
import { act, render, screen } from '@testing-library/react';
import ErrorBoundary from './index';

jest.mock('components/Logo', () => () => null);

describe('ErrorBoundary', () => {
  it('ignores the harmless ResizeObserver loop error', () => {
    render(<ErrorBoundary><div>app</div></ErrorBoundary>);

    act(() => {
      window.onerror('ResizeObserver loop completed with undelivered notifications.', '', 0, 0, null);
    });

    expect(screen.getByText('app')).toBeInTheDocument();
  });

  it('shows the error page for any other error', () => {
    render(<ErrorBoundary><div>app</div></ErrorBoundary>);

    act(() => {
      window.onerror('Something broke', '', 0, 0, new Error('Something broke'));
    });

    expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Something broke')).toBeInTheDocument();
  });
});
