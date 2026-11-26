import { IconCheck } from '@tabler/icons';
import StyledWrapper from './StyledWrapper';

// Compact "all clear" line shown when a sync section has nothing to review.
const SyncEmptyStatus = ({ title, description, children }) => (
  <StyledWrapper>
    <IconCheck size={18} strokeWidth={2} className="status-icon" />
    <div className="status-text">
      <div className="status-title">{title}</div>
      <div className="status-description">{description}</div>
    </div>
    {children}
  </StyledWrapper>
);

export default SyncEmptyStatus;
