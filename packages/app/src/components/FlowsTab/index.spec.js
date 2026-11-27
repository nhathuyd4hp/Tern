import '@testing-library/jest-dom';
import React from 'react';
import { act, fireEvent } from '@testing-library/react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { renderWithTheme } from 'components/OpenAPISyncTab/testUtils';
import { flushFlowWrites, mockFlowFiles } from 'utils/flows/testUtils';
import FlowsTab from './index';

jest.mock('react-hot-toast', () => ({ __esModule: true, default: { error: jest.fn() } }));

// the canvas measures its container and its nodes
beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  global.DOMMatrixReadOnly = class {
    constructor() {
      this.m22 = 1;
    }
  };
});

const application = {
  uid: 'app-1',
  pathname: '/apps/FlowsSpec',
  items: [
    {
      uid: 'r1',
      type: 'http-request',
      request: { method: 'POST', url: '{{baseUrl}}/sign-in', params: [], headers: [{ uid: 'h1', name: 'Accept', value: 'application/json', enabled: true }], body: { mode: 'json', json: '{"user":""}' } },
      examples: [{ response: { status: 200 } }, { response: { status: 401 } }],
      pathname: '/apps/FlowsSpec/login.yml'
    },
    { uid: 'r2', type: 'http-request', request: { method: 'GET', url: '{{baseUrl}}/me', params: [], headers: [] }, pathname: '/apps/FlowsSpec/info.yml' }
  ]
};

// the same application under another path, so each test has flows of its own
const applicationAt = (name) => ({
  ...application,
  pathname: `/apps/${name}`,
  items: application.items.map((item) => ({ ...item, pathname: item.pathname.replace('/apps/FlowsSpec/', `/apps/${name}/`) }))
});

// the flows come from the application file, which is read after the first render
const renderTab = async (collection) => {
  const view = renderWithTheme(<DndProvider backend={HTML5Backend}><FlowsTab collection={collection} /></DndProvider>);
  await act(async () => {});
  return view;
};

describe('FlowsTab', () => {
  let ipc;

  beforeEach(() => {
    ipc = mockFlowFiles();
  });

  it('invites to create a flow, then shows its editor with Run off until there is a request', async () => {
    const { getByText, getByTestId, queryByText } = await renderTab(application);

    expect(getByText('No flows yet')).toBeInTheDocument();

    fireEvent.click(getByText('Create a flow'));

    expect(queryByText('No flows yet')).not.toBeInTheDocument();
    expect(getByTestId('flow-editor')).toBeInTheDocument();
    expect(getByTestId('flow-run')).toBeDisabled();
  });

  it('renames and deletes a flow', async () => {
    const { getByLabelText, getByTestId, getByText } = await renderTab(applicationAt('FlowsSpecTwo'));

    fireEvent.click(getByText('Create a flow'));
    fireEvent.change(getByLabelText('Flow name'), { target: { value: 'Login and get info' } });
    expect(getByText('Login and get info', { selector: '.flow-list-name' })).toBeInTheDocument();

    fireEvent.click(getByTestId('flow-delete'));
    expect(getByText('No flows yet')).toBeInTheDocument();
  });

  it('adds requests of the palette to the canvas with a handle per documented status, and removes one', async () => {
    const { getByText, getAllByTestId, queryAllByTestId, queryByTestId, getByTestId, getByTitle } = await renderTab(applicationAt('FlowsSpecThree'));

    fireEvent.click(getByText('Create a flow'));
    fireEvent.click(getByText('login.yml', { selector: '.palette-path' }));
    fireEvent.click(getByText('info.yml', { selector: '.palette-path' }));

    expect(getAllByTestId('flow-node')).toHaveLength(2);
    expect(getByTestId('flow-run')).toBeEnabled();
    // login documents 200 and 401; info documents nothing, so it gets the 200 assumed
    expect(getAllByTestId('flow-status-401')).toHaveLength(1);
    expect(getAllByTestId('flow-status-200')).toHaveLength(2);
    expect(getAllByTestId('flow-status-other')).toHaveLength(2);

    // the node just added is selected: remove it from its panel
    fireEvent.click(getByTitle('Remove request'));
    expect(getAllByTestId('flow-node')).toHaveLength(1);

    expect(queryByTestId('node-panel')).not.toBeInTheDocument();
    fireEvent.click(getAllByTestId('flow-node')[0]);
    fireEvent.click(getByTitle('Remove request'));
    expect(queryAllByTestId('flow-node')).toHaveLength(0);
  });

  it('shows the inputs of the selected request and keeps only what was changed', async () => {
    const { getByText, getByLabelText } = await renderTab(applicationAt('FlowsSpecFive'));

    fireEvent.click(getByText('Create a flow'));
    fireEvent.click(getByText('login.yml', { selector: '.palette-path' }));

    expect(getByLabelText('Headers Accept')).toHaveValue('application/json');
    expect(getByLabelText('Body')).toHaveValue('{"user":""}');

    fireEvent.change(getByLabelText('Headers Accept'), { target: { value: 'text/plain' } });
    fireEvent.change(getByLabelText('Body'), { target: { value: '{"user":"{{name}}"}' } });

    await act(async () => flushFlowWrites());
    expect(ipc.files['/apps/FlowsSpecFive'][0].nodes[0].inputs).toEqual({ params: {}, headers: { Accept: 'text/plain' }, body: '{"user":"{{name}}"}' });

    fireEvent.change(getByLabelText('Headers Accept'), { target: { value: 'application/json' } });
    await act(async () => flushFlowWrites());
    expect(ipc.files['/apps/FlowsSpecFive'][0].nodes[0].inputs.headers).toEqual({});
  });

  it('filters the palette', async () => {
    const { getByLabelText, getByText, queryByText } = await renderTab(applicationAt('FlowsSpecFour'));

    fireEvent.click(getByText('Create a flow'));
    fireEvent.change(getByLabelText('Search requests'), { target: { value: 'info' } });

    expect(getByText('info.yml', { selector: '.palette-path' })).toBeInTheDocument();
    expect(queryByText('login.yml', { selector: '.palette-path' })).not.toBeInTheDocument();
  });
});
