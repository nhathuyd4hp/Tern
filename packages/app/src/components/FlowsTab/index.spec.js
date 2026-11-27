import '@testing-library/jest-dom';
import React from 'react';
import { fireEvent } from '@testing-library/react';
import { renderWithTheme } from 'components/OpenAPISyncTab/testUtils';
import FlowsTab from './index';

const application = {
  uid: 'app-1',
  pathname: '/apps/FlowsSpec',
  items: [
    { uid: 'r1', type: 'http-request', request: { method: 'POST', url: '{{baseUrl}}/sign-in' }, pathname: '/apps/FlowsSpec/login.yml' },
    { uid: 'r2', type: 'http-request', request: { method: 'GET', url: '{{baseUrl}}/me' }, pathname: '/apps/FlowsSpec/info.yml' }
  ]
};

describe('FlowsTab', () => {
  it('invites to create a flow, then shows its editor with Run off until there is a step', () => {
    const { getByText, getByTestId, queryByText } = renderWithTheme(<FlowsTab collection={application} />);

    expect(getByText('No flows yet')).toBeInTheDocument();

    fireEvent.click(getByText('Create a flow'));

    expect(queryByText('No flows yet')).not.toBeInTheDocument();
    expect(getByTestId('flow-editor')).toBeInTheDocument();
    expect(getByTestId('flow-run')).toBeDisabled();
  });

  it('renames and deletes a flow', () => {
    const { getByLabelText, getByTestId, getByText } = renderWithTheme(<FlowsTab collection={{ ...application, pathname: '/apps/FlowsSpecTwo' }} />);

    fireEvent.click(getByText('Create a flow'));
    fireEvent.change(getByLabelText('Flow name'), { target: { value: 'Login and get info' } });
    expect(getByText('Login and get info', { selector: '.flow-list-name' })).toBeInTheDocument();

    fireEvent.click(getByTestId('flow-delete'));
    expect(getByText('No flows yet')).toBeInTheDocument();
  });
});
