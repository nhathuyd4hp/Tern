/**
 * Builds a complete Redux state for selector unit tests, with every slice
 * initialized to the shape selectors expect. Tests only need to override the
 * fields relevant to them.
 *
 *   const state = buildTestState({
 *     tabs: { tabs: [tab], activeTabUid: tab.uid }
 *   });
 *
 * Keep the defaults aligned with each slice's `initialState` so selector tests
 * continue to reflect the real store shape as slices evolve.
 */
const defaults = () => ({
  collections: {
    collections: [],
    activeConnections: [],
    selectedSidebarUids: [],
    lastClickedSidebarUid: null,
    tempDirectories: {},
    saveTransientRequestModals: []
  },
  tabs: {
    tabs: [],
    activeTabUid: null,
    recentlyClosedTabs: []
  },
  workspaces: {
    workspaces: [],
    activeWorkspaceUid: null
  },
  globalEnvironments: {
    globalEnvironments: [],
    activeGlobalEnvironmentUid: null,
    globalEnvironmentDraft: null,
    _scriptGlobalEnvBaseline: null
  },
  app: {
    isDragging: false,
    preferences: {},
    leftSidebarWidth: 222,
    sidebarCollapsed: false,
    screenWidth: 1280
  }
});

export const buildTestState = (overrides = {}) => {
  const state = defaults();
  for (const [slice, value] of Object.entries(overrides)) {
    state[slice] = { ...(state[slice] || {}), ...value };
  }
  return state;
};

export default buildTestState;
