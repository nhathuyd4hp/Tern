import '@testing-library/jest-dom';
import React from 'react';
import { renderWithTheme } from 'components/OpenAPISyncTab/testUtils';
import ResponseView from './index';

describe('ResponseView', () => {
  it('shows the status line, the headers and the body of the response', () => {
    const { getByText, getByLabelText } = renderWithTheme(
      <ResponseView response={{ status: 201, statusText: 'Created', duration: 120, size: 2048, headers: { 'content-type': 'application/json' }, data: { id: 7 } }} />
    );

    expect(getByText('201 Created · 120 ms · 2.0 KB')).toBeInTheDocument();
    expect(getByText('Headers (1)')).toBeInTheDocument();
    expect(getByText('content-type')).toBeInTheDocument();
    expect(getByLabelText('Response body').textContent).toBe('{\n  "id": 7\n}');
  });

  it('pretty prints a JSON string and accepts headers as pairs', () => {
    const { getByLabelText, getByText } = renderWithTheme(<ResponseView response={{ status: 200, headers: [['x-id', '9']], data: '{"a":1}' }} />);

    expect(getByLabelText('Response body').textContent).toBe('{\n  "a": 1\n}');
    expect(getByText('x-id')).toBeInTheDocument();
  });

  it('says when there is no body', () => {
    const { getByLabelText } = renderWithTheme(<ResponseView response={{ status: 204 }} />);

    expect(getByLabelText('Response body')).toHaveTextContent('No body');
  });
});
