const fs = require('fs');
const path = require('path');
const { ipcMain } = require('electron');

const FLOWS_FILE = 'flows.json';
const FORMAT_VERSION = 1;

const flowsFilePath = (applicationPath) => {
  if (typeof applicationPath !== 'string' || !path.isAbsolute(applicationPath)) {
    throw new Error('Invalid application path');
  }
  return path.join(applicationPath, FLOWS_FILE);
};

/** The flows saved with an application, or null when it has no flows file yet. A file that cannot be read throws. */
const readFlows = async (applicationPath) => {
  let content;
  try {
    content = await fs.promises.readFile(flowsFilePath(applicationPath), 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  const parsed = JSON.parse(content);
  if (!parsed || !Array.isArray(parsed.flows)) throw new Error(`${FLOWS_FILE} has no flows list`);
  return parsed.flows;
};

// Written beside the target and renamed over it, so a crash never leaves half a file.
const writeFlows = async (applicationPath, flows) => {
  if (!Array.isArray(flows)) throw new Error('Flows must be a list');
  const target = flowsFilePath(applicationPath);
  const temporary = `${target}.${process.pid}.tmp`;
  await fs.promises.writeFile(temporary, `${JSON.stringify({ version: FORMAT_VERSION, flows }, null, 2)}\n`, 'utf8');
  await fs.promises.rename(temporary, target);
};

const registerFlowsIpc = () => {
  ipcMain.handle('renderer:read-flows', (event, applicationPath) => readFlows(applicationPath));
  ipcMain.handle('renderer:write-flows', (event, applicationPath, flows) => writeFlows(applicationPath, flows));
};

module.exports = registerFlowsIpc;
module.exports.readFlows = readFlows;
module.exports.writeFlows = writeFlows;
