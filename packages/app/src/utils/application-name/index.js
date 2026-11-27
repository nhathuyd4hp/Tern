import { getWorkspaceCollections } from 'utils/collections';
import { selectActiveWorkspace, selectCollections } from 'src/selectors/collections';

// Applications of a workspace are told apart by their name: the same name in another case or with spaces around is the same name.
export const normalizeApplicationName = (name) => String(name ?? '').trim().toLowerCase();

/** The application of `applications` that has this name, other than `exceptUid`, or undefined. */
export const findApplicationByName = (applications, name, exceptUid = null) => {
  const wanted = normalizeApplicationName(name);
  return applications.find((application) => application.uid !== exceptUid && normalizeApplicationName(application.name) === wanted);
};

/** The applications of the active workspace. */
export const selectWorkspaceApplications = (state) => getWorkspaceCollections({
  collections: selectCollections(state),
  workspaces: state.workspaces.workspaces,
  activeWorkspace: selectActiveWorkspace(state)
});

export const DUPLICATE_APPLICATION_NAME_ERROR = 'An application with this name already exists';
