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
  // the list of a select scrolls its focused option into view
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
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

// a request is added to the flow with the + of its row; a click on the row only shows its details
const addRequest = (getByText, label) => fireEvent.click(getByText(label, { selector: '.palette-path' }).closest('.palette-row').querySelector('button[aria-label="Add to flow"]'));

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

  it('lists gRPC and WebSocket requests too, and filters the list by type, method and name', async () => {
    const path = '/apps/FlowsSpecKinds';
    const items = [
      ...application.items.map((item) => ({ ...item, pathname: item.pathname.replace('/apps/FlowsSpec/', path + '/') })),
      { uid: 'g1', type: 'grpc-request', name: 'Get user', request: { method: '/users.Users/GetUser', url: 'grpc://host', params: [], headers: [] }, pathname: path + '/getUser.yml' },
      { uid: 'w1', type: 'ws-request', name: 'Live feed', request: { method: 'GET', url: 'wss://host/live', params: [], headers: [] }, pathname: path + '/live.yml' }
    ];
    const { getByText, getByLabelText, getByRole, queryByText } = await renderTab({ ...application, pathname: path, items });
    fireEvent.click(getByText('Create a flow'));

    expect(getByText('/users.Users/GetUser', { selector: '.palette-path' })).toBeInTheDocument();
    expect(getByText('/live', { selector: '.palette-path' })).toBeInTheDocument();

    fireEvent.click(getByLabelText('Type'));
    fireEvent.click(getByRole('option', { name: 'gRPC' }));
    expect(getByText('/users.Users/GetUser', { selector: '.palette-path' })).toBeInTheDocument();
    expect(queryByText('/live', { selector: '.palette-path' })).not.toBeInTheDocument();
    expect(queryByText('/me', { selector: '.palette-path' })).not.toBeInTheDocument();

    fireEvent.click(getByLabelText('Type'));
    fireEvent.click(getByRole('option', { name: 'All types' }));
    fireEvent.click(getByLabelText('Method'));
    fireEvent.click(getByRole('option', { name: 'WS' }));
    expect(getByText('/live', { selector: '.palette-path' })).toBeInTheDocument();
    expect(queryByText('/me', { selector: '.palette-path' })).not.toBeInTheDocument();

    fireEvent.click(getByLabelText('Method'));
    fireEvent.click(getByRole('option', { name: 'All methods' }));
    fireEvent.change(getByLabelText('Search requests'), { target: { value: 'get user' } });
    expect(getByText('/users.Users/GetUser', { selector: '.palette-path' })).toBeInTheDocument();
    expect(queryByText('/live', { selector: '.palette-path' })).not.toBeInTheDocument();
  });

  it('lets a WebSocket node hold the messages it sends and the text it waits for', async () => {
    const path = '/apps/FlowsSpecSocket';
    const socket = { uid: 'w2', type: 'ws-request', name: 'Feed', request: { method: 'GET', url: 'wss://host/feed', params: [], headers: [], body: { mode: 'ws', ws: [{ name: 'm', content: '', selected: true }] } }, pathname: path + '/feed.yml' };
    const { getByText, getByLabelText, getByTitle, queryByLabelText } = await renderTab({ ...application, pathname: path, items: [socket] });
    fireEvent.click(getByText('Create a flow'));
    addRequest(getByText, '/feed');

    expect(queryByLabelText('Message 1 to send')).not.toBeInTheDocument();
    fireEvent.click(getByText('Add a message'));
    fireEvent.change(getByLabelText('Message 1 to send'), { target: { value: '{"type":"subscribe"}' } });
    fireEvent.change(getByLabelText('Text a received message must hold'), { target: { value: 'ready' } });

    expect(getByLabelText('Message 1 to send')).toHaveValue('{"type":"subscribe"}');
    expect(getByLabelText('Text a received message must hold')).toHaveValue('ready');
    expect(getByLabelText('Seconds to wait for a message')).toBeInTheDocument();

    fireEvent.click(getByTitle('Remove message'));
    expect(queryByLabelText('Message 1 to send')).not.toBeInTheDocument();
  });

  it('shows the details of a request when its row is clicked, and adds it only from the + or Add to flow', async () => {
    const { getByText, getAllByTestId, queryAllByTestId, getByTestId } = await renderTab(applicationAt('FlowsSpecDetails'));
    fireEvent.click(getByText('Create a flow'));

    fireEvent.click(getByText('/sign-in', { selector: '.palette-path' }));
    expect(queryAllByTestId('flow-node')).toHaveLength(0);
    expect(getByTestId('request-details')).toHaveTextContent('/sign-in');
    expect(getByTestId('request-details')).toHaveTextContent('login.yml');

    fireEvent.click(getByText('Add to flow'));
    expect(getAllByTestId('flow-node')).toHaveLength(1);
  });

  it('shows the whole url of the request at the top of the details of a node, the variables that have a value filled in', async () => {
    const path = '/apps/FlowsSpecIdentity';
    const known = { ...application.items[0], name: 'Sign in', pathname: path + '/login.yml', request: { ...application.items[0].request, vars: { req: [{ name: 'baseUrl', value: 'https://api.test', enabled: true }] } } };
    const unknown = { ...application.items[1], name: 'Me', pathname: path + '/info.yml' };
    const { getByText, getByTestId } = await renderTab({ ...application, pathname: path, items: [known, unknown] });
    fireEvent.click(getByText('Create a flow'));

    addRequest(getByText, '/sign-in');
    expect(getByTestId('node-panel')).toHaveTextContent('https://api.test/sign-in');

    addRequest(getByText, '/me');
    expect(getByTestId('node-panel')).toHaveTextContent('{{baseUrl}}/me');
  });

  it('hides the list of flows and the list of requests, and shows them again from the bar left behind', async () => {
    const { getByText, getByLabelText, queryByTestId, getByTestId } = await renderTab(applicationAt('FlowsSpecCollapse'));
    fireEvent.click(getByText('Create a flow'));

    fireEvent.click(getByLabelText('Hide the list of requests'));
    expect(queryByTestId('flow-palette')).not.toBeInTheDocument();
    fireEvent.click(getByLabelText('Show Requests'));
    expect(getByTestId('flow-palette')).toBeInTheDocument();

    fireEvent.click(getByLabelText('Hide the list of flows'));
    expect(queryByTestId('flow-new')).not.toBeInTheDocument();
    fireEvent.click(getByLabelText('Show Flows'));
    expect(getByTestId('flow-new')).toBeInTheDocument();
  });

  it('adds requests of the palette to the canvas with a handle per documented status, and removes one', async () => {
    const { getByText, getAllByTestId, queryAllByTestId, queryByTestId, getByTestId, getByTitle } = await renderTab(applicationAt('FlowsSpecThree'));

    fireEvent.click(getByText('Create a flow'));
    addRequest(getByText, '/sign-in');
    addRequest(getByText, '/me');

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
    addRequest(getByText, '/sign-in');

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

  it('lets the user add a status to a node by picking it from the list, and take it away again', async () => {
    const { getByText, getByLabelText, getByRole, getByTestId, queryByLabelText, queryByTestId } = await renderTab(applicationAt('FlowsSpecNine'));

    fireEvent.click(getByText('Create a flow'));
    addRequest(getByText, '/me');

    expect(queryByTestId('flow-status-418')).not.toBeInTheDocument();

    fireEvent.click(getByLabelText('Add a status'));
    fireEvent.click(getByRole('option', { name: /^418/ }));

    expect(getByTestId('flow-status-418')).toBeInTheDocument();
    expect(getByLabelText('Remove status 418')).toBeInTheDocument();

    fireEvent.click(getByLabelText('Remove status 418'));
    expect(queryByTestId('flow-status-418')).not.toBeInTheDocument();
    expect(queryByLabelText('Remove status 418')).not.toBeInTheDocument();
  });

  it('no longer offers a status once it is added, and offers Other again after it was taken away', async () => {
    const { getByText, getByLabelText, getByRole, getByTestId, queryByRole } = await renderTab(applicationAt('FlowsSpecTen'));

    fireEvent.click(getByText('Create a flow'));
    addRequest(getByText, '/me');

    fireEvent.click(getByLabelText('Add a status'));
    expect(queryByRole('option', { name: /^Other/ })).not.toBeInTheDocument();
    fireEvent.click(getByRole('option', { name: /^404/ }));
    expect(getByTestId('flow-status-404')).toBeInTheDocument();

    fireEvent.click(getByLabelText('Add a status'));
    expect(queryByRole('option', { name: /^404/ })).not.toBeInTheDocument();
    fireEvent.keyDown(getByLabelText('Add a status'), { key: 'Escape' });

    fireEvent.click(getByLabelText('Remove status other'));
    fireEvent.click(getByLabelText('Add a status'));
    expect(getByRole('option', { name: /^Other/ })).toBeInTheDocument();
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
