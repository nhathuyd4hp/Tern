import { IconBrandSafari } from '@tabler/icons';
import EarlyAccess from '../../components/EarlyAccess';

const POINTS = [
  'List your API’s application straight from its public repo',
  'Search applications by API, company or topic',
  'They open it in Kevin in one click and get your updates'
];

const ApiCatalogPage = () => (
  <EarlyAccess
    feature="catalog"
    icon={IconBrandSafari}
    title="Kevin API Catalog"
    subtitle="The public home for Kevin applications"
    points={POINTS}
    waitlistUrl="https://link.usebruno.com/catalog-waitlist"
    learnMoreUrl="https://link.usebruno.com/docs/catalog"
  />
);

export default ApiCatalogPage;
