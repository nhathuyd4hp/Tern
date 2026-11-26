jest.mock('electron', () => ({ ipcMain: { handle: jest.fn() } }));
jest.mock('../utils/git', () => ({
  cloneGitRepository: jest.fn(),
  listBranchesForRemoteUrl: jest.fn()
}));
jest.mock('../utils/filesystem', () => ({
  createDirectory: jest.fn(),
  removeDirectory: jest.fn()
}));

const { listBranchesForRemoteUrl } = require('../utils/git');
const { handleListRemoteBranches } = require('./git');

describe('handleListRemoteBranches', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the branch listing for the url', async () => {
    listBranchesForRemoteUrl.mockResolvedValue({ branches: ['main', 'develop'], defaultBranch: 'main' });

    expect(await handleListRemoteBranches({}, { url: '  https://github.com/org/repo.git  ' })).toEqual({
      branches: ['main', 'develop'],
      defaultBranch: 'main'
    });
    expect(listBranchesForRemoteUrl).toHaveBeenCalledWith({ url: 'https://github.com/org/repo.git' });
  });

  it('rejects a missing url', async () => {
    await expect(handleListRemoteBranches({}, { url: '   ' })).rejects.toThrow('Repository URL is required');
    expect(listBranchesForRemoteUrl).not.toHaveBeenCalled();
  });

  it('rejects a url that git would read as a command option', async () => {
    await expect(handleListRemoteBranches({}, { url: '--upload-pack=touch /tmp/pwned' }))
      .rejects.toThrow('Repository URL is not valid');
    expect(listBranchesForRemoteUrl).not.toHaveBeenCalled();
  });
});
