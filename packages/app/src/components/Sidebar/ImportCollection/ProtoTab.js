import React from 'react';
import { useDispatch } from 'react-redux';
import { browseFiles } from 'providers/ReduxStore/slices/collections/actions';
import { loadGrpcMethodsFromProtoFile } from 'utils/network/index';
import Button from 'ui/Button';

const ProtoTab = ({ setIsLoading, handleSubmit, setErrorMessage }) => {
  const dispatch = useDispatch();

  const handleChooseFile = async () => {
    try {
      const [filePath] = (await dispatch(browseFiles([{ name: 'Proto Files', extensions: ['proto'] }], [''])) || []);
      if (!filePath) return;

      setIsLoading(true);
      const { success, methods, error } = await loadGrpcMethodsFromProtoFile(filePath);
      if (!success) {
        setErrorMessage(`Could not read the proto file: ${error}`);
        return;
      }
      handleSubmit({ rawData: { filePath, methods }, type: 'proto' });
    } catch (err) {
      console.error(err);
      setErrorMessage('Could not read the proto file.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div className="text-sm flex-1 min-w-0">
        Service → collection, method → request.
      </div>
      <Button type="button" data-testid="choose-proto-file-btn" variant="filled" color="primary" className="flex-shrink-0" onClick={handleChooseFile}>
        Choose .proto file
      </Button>
    </div>
  );
};

export default ProtoTab;
