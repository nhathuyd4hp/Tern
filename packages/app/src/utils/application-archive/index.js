import toast from 'react-hot-toast';
import { parseError } from 'utils/common/error';
import { callIpc } from 'utils/common/ipc';

/** Saves the whole application folder as one zip, asking where to put it. */
export const exportApplication = async (application) => {
  try {
    const result = await callIpc('renderer:export-collection-zip', application.pathname, application.name);
    if (result.success) {
      toast.success('Application exported');
    }
  } catch (error) {
    toast.error(`Failed to export the application. ${parseError(error)}`);
  }
};

/** The name of the application inside a zip, read without unpacking it. */
export const readApplicationZipName = (zipPath) => callIpc('renderer:read-application-zip-name', zipPath);

/** Unpacks an application zip into the default location, under `name` if given. Resolves with { path, name }. */
export const importApplicationZip = (zipPath, options = {}) => callIpc('renderer:import-application-zip', zipPath, options);

/** The name of the application in a folder. */
export const readApplicationFolderName = (folderPath) => callIpc('renderer:read-application-folder-name', folderPath);

/** Copies an application folder into the default location (one already there is used in place). Resolves with { path, name }. */
export const importApplicationFolder = (folderPath, options = {}) => callIpc('renderer:import-application-folder', folderPath, options);
