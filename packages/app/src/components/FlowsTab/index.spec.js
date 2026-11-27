import '@testing-library/jest-dom';
import React from 'react';
import { fireEvent } from '@testing-library/react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
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

// the same application under another path, so each test has flows of its own
const applicationAt = (name) => ({
  ...application,
  pathname: `/apps/${name}`,
  items: application.items.map((item) => ({ ...item, pathname: item.pathname.replace('/apps/FlowsSpec/', `/apps/${name}/`) }))
});

describe('FlowsTab', () => {
  it('invites to create a flow, then shows its editor with Run off until there is a step', () => {
    const { getByText, getByTestId, queryByText } = renderWithTheme(<DndProvider backend={HTML5Backend}><FlowsTab collection={application} /></DndProvider>);

    expect(getByText('No flows yet')).toBeInTheDocument();

    fireEvent.click(getByText('Create a flow'));

    expect(queryByText('No flows yet')).not.toBeInTheDocument();
    expect(getByTestId('flow-editor')).toBeInTheDocument();
    expect(getByTestId('flow-run')).toBeDisabled();
  });

  it('renames and deletes a flow', () => {
    const { getByLabelText, getByTestId, getByText } = renderWithTheme(<DndProvider backend={HTML5Backend}><FlowsTab collection={{ ...application, pathname: '/apps/FlowsSpecTwo' }} /></DndProvider>);

    fireEvent.click(getByText('Create a flow'));
    fireEvent.change(getByLabelText('Flow name'), { target: { value: 'Login and get info' } });
    expect(getByText('Login and get info', { selector: '.flow-list-name' })).toBeInTheDocument();

    fireEvent.click(getByTestId('flow-delete'));
    expect(getByText('No flows yet')).toBeInTheDocument();
  });

  it('adds a request of the palette as a step, then moves and removes it', () => {
    const { getByText, getAllByTestId, queryAllByTestId, getAllByTitle, getByTestId } = renderWithTheme(
      <DndProvider backend={HTML5Backend}><FlowsTab collection={applicationAt('FlowsSpecThree')} /></DndProvider>
    );

    fireEvent.click(getByText('Create a flow'));
    fireEvent.click(getByText('login.yml', { selector: '.palette-path' }));
    fireEvent.click(getByText('info.yml', { selector: '.palette-path' }));

    const paths = () => getAllByTestId('flow-step').map((step) => step.querySelector('.step-request').textContent);
    expect(paths()).toEqual(['login.yml', 'info.yml']);
    expect(getByTestId('flow-run')).toBeEnabled();

    fireEvent.click(getAllByTitle('Move down')[0]);
    expect(paths()).toEqual(['info.yml', 'login.yml']);

    fireEvent.click(getAllByTitle('Remove step')[0]);
    fireEvent.click(getAllByTitle('Remove step')[0]);
    expect(queryAllByTestId('flow-step')).toHaveLength(0);
  });

  it('filters the palette', () => {
    const { getByLabelText, getByText, queryByText } = renderWithTheme(
      <DndProvider backend={HTML5Backend}><FlowsTab collection={applicationAt('FlowsSpecFour')} /></DndProvider>
    );

    fireEvent.click(getByText('Create a flow'));
    fireEvent.change(getByLabelText('Search requests'), { target: { value: 'info' } });

    expect(getByText('info.yml', { selector: '.palette-path' })).toBeInTheDocument();
    expect(queryByText('login.yml', { selector: '.palette-path' })).not.toBeInTheDocument();
  });
});
