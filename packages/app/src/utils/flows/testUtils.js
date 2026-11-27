// An in-memory stand-in for the flows.json files the main process reads and writes, keyed by application folder.
export const mockFlowFiles = (initial = {}) => {
  const files = { ...initial };
  const invoke = jest.fn((channel, applicationPath, flows) => {
    if (channel === 'renderer:read-flows') return Promise.resolve(files[applicationPath] ?? null);
    if (channel === 'renderer:write-flows') {
      files[applicationPath] = flows;
      return Promise.resolve();
    }
    return Promise.reject(new Error(`unexpected channel ${channel}`));
  });
  window.ipcRenderer = { invoke };
  return { files, invoke };
};

// Writes are delayed; leaving the page is the store's own cue to write them at once.
export const flushFlowWrites = () => window.dispatchEvent(new Event('beforeunload'));
