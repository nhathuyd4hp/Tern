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
    fireEvent.click(getByText('/sign-in', { selector: '.palette-path' }));
    fireEvent.click(getByText('/me', { selector: '.palette-path' }));

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
    fireEvent.click(getByText('/sign-in', { selector: '.palette-path' }));

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

  it('offers a collection select only when the application has several collections', async () => {
    const inFolders = (name) => ({
      ...application,
      pathname: `/apps/${name}`,
      items: [
        { uid: 'f1', type: 'folder', name: 'Users', pathname: `/apps/${name}/Users`, items: [{ ...application.items[0], pathname: `/apps/${name}/Users/login.yml` }] },
        { uid: 'f2', type: 'folder', name: 'Orders', pathname: `/apps/${name}/Orders`, items: [{ ...application.items[1], pathname: `/apps/${name}/Orders/info.yml` }] }
      ]
    });

    const several = await renderTab(inFolders('FlowsSpecSeven'));
    fireEvent.click(several.getByText('Create a flow'));
    expect(several.getByLabelText('Collection')).toBeInTheDocument();
    expect(several.getByText('/sign-in', { selector: '.palette-path' })).toBeInTheDocument();
    expect(several.getByText('/me', { selector: '.palette-path' })).toBeInTheDocument();
    several.unmount();

    const single = await renderTab(applicationAt('FlowsSpecEight'));
    fireEvent.click(single.getByText('Create a flow'));
    expect(single.queryByLabelText('Collection')).not.toBeInTheDocument();
  });

  it('lets the user add a status to a node by typing its code, and take it away again', async () => {
    const { getByText, getByLabelText, getByTestId, getByTitle, queryByLabelText, queryByTestId } = await renderTab(applicationAt('FlowsSpecNine'));

    fireEvent.click(getByText('Create a flow'));
    fireEvent.click(getByText('/me', { selector: '.palette-path' }));

    expect(queryByTestId('flow-status-418')).not.toBeInTheDocument();

    fireEvent.change(getByLabelText('Type a status code'), { target: { value: '418' } });
    fireEvent.click(getByTitle('Add status'));

    expect(getByTestId('flow-status-418')).toBeInTheDocument();
    expect(getByLabelText('Remove status 418')).toBeInTheDocument();

    fireEvent.click(getByLabelText('Remove status 418'));
    expect(queryByTestId('flow-status-418')).not.toBeInTheDocument();
    expect(queryByLabelText('Remove status 418')).not.toBeInTheDocument();
  });

  it('adds a common status with one click and then no longer offers it', async () => {
    const { getByText, getByTestId, getByRole, queryByRole } = await renderTab(applicationAt('FlowsSpecTen'));

    fireEvent.click(getByText('Create a flow'));
    fireEvent.click(getByText('/me', { selector: '.palette-path' }));

    fireEvent.click(getByRole('button', { name: '404' }));

    expect(getByTestId('flow-status-404')).toBeInTheDocument();
    expect(queryByRole('button', { name: '404' })).not.toBeInTheDocument();
  });

  it('uses a value of an earlier request: the header gets the variable and the earlier request takes the field', async () => {
    const path = '/apps/FlowsSpecEleven';
    const login = { ...application.items[0], pathname: `${path}/login.yml`, examples: [{ response: { status: 200, body: { type: 'json', content: JSON.stringify({ data: { token: 'abc' } }) } } }] };
    const info = { ...application.items[1], pathname: `${path}/info.yml`, request: { ...application.items[1].request, headers: [{ uid: 'h9', name: 'Authorization', value: '', enabled: true }] } };
    const edge = { id: 'e1', source: 'n1', sourceHandle: '200', target: 'n2' };
    const node = (id, requestPath, x) => ({ id, requestPath, position: { x, y: 0 }, inputs: { params: {}, headers: {}, body: null }, statuses: [], extractions: [] });
    const flow = { id: 'f1', name: 'Flow', nodes: [node('n1', 'login.yml', 0), node('n2', 'info.yml', 300)], edges: [edge] };
    ipc.files[path] = [flow];

    const { getAllByTestId, getByLabelText, getByText, getByTestId } = await renderTab({ ...application, pathname: path, items: [login, info] });

    fireEvent.click(getAllByTestId('flow-node')[1]);
    fireEvent.click(getByLabelText('Use a value from an earlier request'));
    fireEvent.click(getByText('data.token'));

    expect(getByLabelText('Headers Authorization')).toHaveValue('{{token}}');
    // the values the earlier request shares are listed in the share section of this one
    expect(getByTestId('earlier-value-row')).toHaveTextContent('{{token}}');
    expect(getByTestId('earlier-value-row')).toHaveTextContent('POST /sign-in');
    await act(async () => flushFlowWrites());
    const saved = ipc.files[path][0];
    expect(saved.nodes[0].extractions).toEqual([{ name: 'token', expression: 'res.body.data.token' }]);
    expect(saved.nodes[1].inputs.headers).toEqual({ Authorization: '{{token}}' });
  });

  it('reports at once a shared value that has the name of another one, and keeps the flow from running', async () => {
    const path = '/apps/FlowsSpecTwelve';
    const login = { ...application.items[0], pathname: `${path}/login.yml` };
    const info = { ...application.items[1], pathname: `${path}/info.yml` };
    const node = (id, requestPath, x, extractions) => ({ id, requestPath, position: { x, y: 0 }, inputs: { params: {}, headers: {}, body: null }, statuses: [], extractions });
    const flow = {
      id: 'f2',
      name: 'Flow',
      nodes: [node('n1', 'login.yml', 0, [{ name: 'username', expression: 'res.body.data.user.username' }]), node('n2', 'info.yml', 300, [{ name: 'id', expression: 'res.body.id' }])],
      edges: [{ id: 'e1', source: 'n1', sourceHandle: '200', target: 'n2' }]
    };
    ipc.files[path] = [flow];

    const { getAllByTestId, getByLabelText, getByRole, getByTestId, queryByTestId } = await renderTab({ ...application, pathname: path, items: [login, info] });
    expect(queryByTestId('flow-name-problem')).not.toBeInTheDocument();

    fireEvent.click(getAllByTestId('flow-node')[1]);
    fireEvent.change(getByLabelText('Variable name'), { target: { value: 'username' } });

    expect(getByRole('alert')).toHaveTextContent('A value named "username" is already shared by another request');
    expect(getByTestId('flow-name-problem')).toBeInTheDocument();
    expect(getByTestId('flow-run')).toBeDisabled();

    fireEvent.change(getByLabelText('Variable name'), { target: { value: 'id' } });
    expect(queryByTestId('flow-name-problem')).not.toBeInTheDocument();
    expect(getByTestId('flow-run')).toBeEnabled();
  });

  it('suggests the variables of the earlier requests when {{ is typed, and completes the one picked', async () => {
    const path = '/apps/FlowsSpecThirteen';
    const login = { ...application.items[0], pathname: `${path}/login.yml` };
    const info = { ...application.items[1], pathname: `${path}/info.yml`, request: { ...application.items[1].request, headers: [{ uid: 'h9', name: 'Authorization', value: '', enabled: true }] } };
    const node = (id, requestPath, x, extractions) => ({ id, requestPath, position: { x, y: 0 }, inputs: { params: {}, headers: {}, body: null }, statuses: [], extractions });
    const flow = {
      id: 'f3',
      name: 'Flow',
      nodes: [node('n1', 'login.yml', 0, [{ name: 'token', expression: 'res.body.data.token' }, { name: 'username', expression: 'res.body.data.user.username' }]), node('n2', 'info.yml', 300, [])],
      edges: [{ id: 'e1', source: 'n1', sourceHandle: '200', target: 'n2' }]
    };
    ipc.files[path] = [flow];

    const { getAllByTestId, getByLabelText, getByRole, getAllByRole, queryByRole } = await renderTab({ ...application, pathname: path, items: [login, info] });
    fireEvent.click(getAllByTestId('flow-node')[1]);
    const header = getByLabelText('Headers Authorization');

    expect(queryByRole('listbox')).not.toBeInTheDocument();

    fireEvent.change(header, { target: { value: 'Bearer {{to', selectionStart: 11, selectionEnd: 11 } });
    expect(getAllByRole('option')).toHaveLength(1);
    expect(getByRole('option')).toHaveTextContent('{{token}}');

    fireEvent.mouseDown(getByRole('option'));
    expect(header).toHaveValue('Bearer {{token}}');
    expect(queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('filters the palette', async () => {
    const { getByLabelText, getByText, queryByText } = await renderTab(applicationAt('FlowsSpecFour'));

    fireEvent.click(getByText('Create a flow'));
    fireEvent.change(getByLabelText('Search requests'), { target: { value: 'info' } });

    expect(getByText('/me', { selector: '.palette-path' })).toBeInTheDocument();
    expect(queryByText('/sign-in', { selector: '.palette-path' })).not.toBeInTheDocument();
  });
});
