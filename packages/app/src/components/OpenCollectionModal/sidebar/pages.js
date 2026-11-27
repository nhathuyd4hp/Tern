import {
  IconClock,
  IconDeviceLaptop,
  IconFolder
} from '@tabler/icons';
import ChooseFolderPage from './ChooseFolderPage';
import RecentsPage from './RecentsPage';
import MyComputerPage from './MyComputerPage';

/**
 * Pages of the Open collection modal, in menu order.
 *
 * @typedef {Object} OpenCollectionPage
 * @property {string} id - Stable id, stored as the current page and used in test ids.
 * @property {string} label - Menu item text.
 * @property {string} title - Page header title.
 * @property {string} description - Page header description.
 * @property {React.ComponentType} icon - Tabler icon shown in the menu.
 * @property {'sources'} [group] - Pages in the group are listed under the Sources heading.
 * @property {React.ComponentType} component - Page body. It takes no props.
 */

/** @type {OpenCollectionPage[]} */
export const OPEN_COLLECTION_PAGES = [
  {
    id: 'choose-folder',
    label: 'Choose folder…',
    title: 'Choose folder',
    description: 'Pick one or more application folders to open them in Kevin.',
    icon: IconFolder,
    component: ChooseFolderPage
  },
  {
    id: 'recents',
    label: 'Recents',
    title: 'Recents',
    description: 'Applications you opened recently, including ones you closed',
    icon: IconClock,
    component: RecentsPage
  },
  {
    id: 'my-computer',
    label: 'My computer',
    title: 'My computer',
    description: 'Applications Kevin found on your computer',
    icon: IconDeviceLaptop,
    group: 'sources',
    component: MyComputerPage
  }
];
