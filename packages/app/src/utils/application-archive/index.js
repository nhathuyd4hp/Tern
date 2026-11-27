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

/** Unpacks an application zip into the default location. Resolves with { path } of the new folder. */
export const importApplicationZip = (zipPath) => callIpc('renderer:import-application-zip', zipPath);
