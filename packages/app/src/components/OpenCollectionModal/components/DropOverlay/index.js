import { IconUpload } from '@tabler/icons';
import StyledWrapper from './StyledWrapper';

const DropOverlay = () => (
  <StyledWrapper className="drop-overlay" role="status" data-testid="open-collection-drop-overlay">
    <div className="drop-overlay-content">
      <span className="drop-overlay-icon" aria-hidden="true">
        <IconUpload size={22} strokeWidth={1.75} />
      </span>
      <span className="drop-overlay-title">Drop to open</span>
      <span className="drop-overlay-text">
        Application folders open in place. An application .zip is unpacked into Tern's data folder and opened.
      </span>
    </div>
  </StyledWrapper>
);

export default DropOverlay;
