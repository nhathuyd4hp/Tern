import { IconChevronRight } from '@tabler/icons';
import StyledWrapper from './StyledWrapper';

// What is left of a panel that was collapsed: a thin bar with its name, to bring the panel back.
const CollapsedRail = ({ label, onExpand }) => (
  <StyledWrapper type="button" onClick={onExpand} title={`Show ${label}`} aria-label={`Show ${label}`}>
    <IconChevronRight size={14} />
    <span className="rail-label">{label}</span>
  </StyledWrapper>
);

export default CollapsedRail;
