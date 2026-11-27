import { useRef } from 'react';
import StyledWrapper from './StyledWrapper';

// A thin bar between two panels: drag it sideways to give the panel before it more or less room.
const ResizeHandle = ({ onResize, label }) => {
  const lastX = useRef(null);

  const start = (event) => {
    lastX.current = event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const move = (event) => {
    if (lastX.current === null) return;
    onResize(event.clientX - lastX.current);
    lastX.current = event.clientX;
  };

  const stop = () => {
    lastX.current = null;
  };

  return (
    <StyledWrapper
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={stop}
      onPointerCancel={stop}
    />
  );
};

export default ResizeHandle;
