const path = require('path');
const fs = require('fs');
const os = require('os');
const yaml = require('js-yaml');
const {
  reorderWorkspaceCollections,
  getWorkspaceCollections
} = require('../../src/utils/workspace-config');

const collection = (name, pathSegment, extra = {}) => ({ name, path: pathSegment, ...extra });

describe('reorderWorkspaceCollections', () => {
  let workspacePath;

  /** Writes workspace.yml with the given collections (relative paths). */
  const writeWorkspaceYml = (collections) => {
    const content = [
      'opencollection: 1.0.0',
      'info:',
      '  name: Test',
      '  type: workspace',
      'collections:',
      ...collections.flatMap((c) => [`  - name: ${c.name}`, `    path: ${c.path}`]),
      'specs: []',
      'docs: \'\''
    ].join('\n');
    fs.writeFileSync(path.join(workspacePath, 'workspace.yml'), content);
  };

  /** Returns collection paths (relative) in order as stored in workspace.yml. */
  const getCollectionPathsFromYml = () => {
    const raw = fs.readFileSync(path.join(workspacePath, 'workspace.yml'), 'utf8');
    const config = yaml.load(raw);
    return (config.collections || []).map((c) => c.path);
  };

  /** Resolves a relative collection path segment to an absolute path under the current workspace. */
  const absPath = (relativePath) => path.resolve(workspacePath, relativePath);

  beforeEach(() => {
    workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), 'bruno-ws-'));
  });

  afterEach(() => {
    fs.rmSync(workspacePath, { recursive: true, force: true });
  });

  test('reorders collections to match given path list', async () => {
    writeWorkspaceYml([
      collection('API', 'collections/api'),
      collection('Backend', 'collections/backend'),
      collection('Frontend', 'collections/frontend')
    ]);

    await reorderWorkspaceCollections(workspacePath, [
      absPath('collections/frontend'),
      absPath('collections/api'),
      absPath('collections/backend')
    ]);

    expect(getCollectionPathsFromYml()).toEqual(['collections/frontend', 'collections/api', 'collections/backend']);
  });

  test('deduplicates when reorder list contains duplicate paths', async () => {
    writeWorkspaceYml([
      collection('API', 'collections/api'),
      collection('Backend', 'collections/backend')
    ]);

    await reorderWorkspaceCollections(workspacePath, [
      absPath('collections/api'),
      absPath('collections/backend'),
      absPath('collections/api'),
      absPath('collections/api')
    ]);

    expect(getCollectionPathsFromYml()).toEqual(['collections/api', 'collections/backend']);
  });
});

describe('getUnopenableWorkspaceCollections', () => {
  const { getUnopenableWorkspaceCollections } = require('../../src/utils/workspace-config');

  let workspacePath;

  const writeYml = (collections) => {
    const lines = ['opencollection: 1.0.0', 'info:', '  name: "Test"', '  type: workspace', 'collections:'];
    for (const c of collections) {
      lines.push(`  - name: "${c.name}"`);
      lines.push(`    path: "${c.path}"`);
      if (c.remote) lines.push(`    remote: "${c.remote}"`);
    }
    lines.push('specs: []');
    lines.push('docs: \'\'');
    fs.writeFileSync(path.join(workspacePath, 'workspace.yml'), lines.join('\n'));
  };

  const absPath = (relativePath) => path.resolve(workspacePath, relativePath);

  const ensureCollectionDir = (relativePath) => {
    const dir = path.join(workspacePath, relativePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'bruno.json'), JSON.stringify({ name: 'x', version: '1', type: 'collection' }));
  };

  beforeEach(() => {
    workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), 'bruno-ws-unopenable-'));
  });

  afterEach(() => {
    fs.rmSync(workspacePath, { recursive: true, force: true });
  });

  test('leaves out entries that point at a valid collection directory', () => {
    ensureCollectionDir('collections/api');
    writeYml([collection('API', 'collections/api')]);

    expect(getUnopenableWorkspaceCollections(workspacePath)).toEqual([]);
  });

  test('reports an entry whose folder does not exist', () => {
    writeYml([collection('Missing', 'collections/missing')]);

    expect(getUnopenableWorkspaceCollections(workspacePath)).toEqual([
      { name: 'Missing', path: absPath('collections/missing') }
    ]);
  });

  test('reports an entry whose folder has no collection config', () => {
    fs.mkdirSync(path.join(workspacePath, 'collections/empty'), { recursive: true });
    writeYml([collection('Empty', 'collections/empty')]);

    expect(getUnopenableWorkspaceCollections(workspacePath)).toEqual([
      { name: 'Empty', path: absPath('collections/empty') }
    ]);
  });

  test('leaves out git-backed entries that are not cloned yet', () => {
    writeYml([collection('Ghost', 'collections/ghost', { remote: 'https://github.com/x/ghost' })]);

    expect(getUnopenableWorkspaceCollections(workspacePath)).toEqual([]);
  });

  test('reports a duplicated broken entry only once', () => {
    writeYml([
      collection('Missing', 'collections/missing'),
      collection('Missing Again', 'collections/missing')
    ]);

    expect(getUnopenableWorkspaceCollections(workspacePath)).toEqual([
      { name: 'Missing', path: absPath('collections/missing') }
    ]);
  });

  test('reports only the broken entries when the workspace mixes healthy and broken ones', () => {
    ensureCollectionDir('collections/api');
    fs.mkdirSync(path.join(workspacePath, 'collections/empty'), { recursive: true });
    writeYml([
      collection('API', 'collections/api'),
      collection('Missing', 'collections/missing'),
      collection('Empty', 'collections/empty'),
      collection('Ghost', 'collections/ghost', { remote: 'https://github.com/x/ghost' })
    ]);

    expect(getUnopenableWorkspaceCollections(workspacePath).map((c) => c.name)).toEqual(['Missing', 'Empty']);
  });
});

describe('legacy specs key', () => {
  const { readWorkspaceConfig, writeWorkspaceConfig } = require('../../src/utils/workspace-config');
  let workspacePath;

  beforeEach(() => {
    workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), 'bruno-ws-'));
  });

  afterEach(() => {
    fs.rmSync(workspacePath, { recursive: true, force: true });
  });

  test.each([
    ['a list', ['specs:', '  - name: foo', '    path: foo.yaml']],
    ['a map', ['specs:', '  brokenEntry: not a list']],
    ['a scalar', ['specs: 42']]
  ])('a workspace.yml with specs as %s still loads and is dropped on the next write', async (_label, specsLines) => {
    fs.writeFileSync(
      path.join(workspacePath, 'workspace.yml'),
      ['opencollection: 1.0.0', 'info:', '  name: Test', '  type: workspace', 'collections: []', ...specsLines, 'docs: \'\''].join('\n')
    );

    const config = readWorkspaceConfig(workspacePath);
    expect(config.name).toBe('Test');

    await writeWorkspaceConfig(workspacePath, config);
    expect(fs.readFileSync(path.join(workspacePath, 'workspace.yml'), 'utf8')).not.toContain('specs');
  });
});
