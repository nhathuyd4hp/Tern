import Docs from '../Docs';
import Info from './Info';
import { IconBox } from '@tabler/icons';
import RequestsNotLoaded from './RequestsNotLoaded';
import CollectionList from './CollectionList';
import ReloadApplication from './ReloadApplication';

const Overview = ({ collection }) => {
  return (
    <div className="h-full overflow-hidden">
      <div className="grid grid-cols-5 gap-5 h-full">
        <div className="col-span-2 overflow-y-auto overflow-x-clip text-ellipsis pr-2">
          <div className="flex gap-2 items-center min-w-0">
            <IconBox size={20} stroke={1.5} className="flex-shrink-0" />
            <span className="overflow-hidden text-lg font-medium whitespace-nowrap text-ellipsis">
              {collection?.name}
            </span>
            <span className="ml-auto flex-shrink-0">
              <ReloadApplication application={collection} />
            </span>
          </div>
          <CollectionList collection={collection} />
          <Info collection={collection} />
          <RequestsNotLoaded collection={collection} />
        </div>
        <div className="col-span-3 overflow-hidden">
          <Docs collection={collection} />
        </div>
      </div>
    </div>
  );
};

export default Overview;
