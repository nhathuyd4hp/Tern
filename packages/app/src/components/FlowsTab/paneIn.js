import { css, keyframes } from 'styled-components';

const slideIn = keyframes`
  from {
    opacity: 0;
    transform: translateX(-8px);
  }
  to {
    opacity: 1;
    transform: none;
  }
`;

// A pane that appears (a list that is shown again, the rail that replaces it) slides in; whoever asks for less motion gets none.
export const paneIn = css`
  animation: ${slideIn} 0.16s ease-out;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;
