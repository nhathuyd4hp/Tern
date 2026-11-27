import styled from 'styled-components';
import { rgba } from 'utils/color';

const StyledWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  width: 100%;
  min-width: 0;

  .settings-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 0;
  }

  .settings-label {
    font-size: ${(props) => props.theme.font.size.sm};
    font-weight: 600;
    color: ${(props) => props.theme.text};
  }

  .settings-hint {
    font-size: ${(props) => props.theme.font.size.sm};
    color: ${(props) => props.theme.colors.text.muted};
  }

  .settings-toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.625rem 0.75rem;
    border: 1px solid ${(props) => props.theme.input.border};
    border-radius: ${(props) => props.theme.border.radius.md};

    .toggle-text {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
      min-width: 0;
    }
  }

  .toggle-switch {
    position: relative;
    flex-shrink: 0;
    width: 36px;
    height: 20px;
    padding: 0;
    border: none;
    border-radius: 10px;
    background: ${(props) => props.theme.colors.text.muted};
    cursor: pointer;
    transition: background 0.2s;

    &.active {
      background: ${(props) => props.theme.button2.color.primary.bg};
    }

    .toggle-knob {
      position: absolute;
      top: 3px;
      left: 3px;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
      transition: left 0.2s;
    }

    &.active .toggle-knob {
      left: 19px;
    }
  }

  .interval-buttons {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(72px, 1fr));
    gap: 0.5rem;

    button {
      padding: 0.375rem 0.5rem;
      border: 1px solid ${(props) => props.theme.border.border1};
      border-radius: ${(props) => props.theme.border.radius.md};
      background: ${(props) => props.theme.background.default};
      color: ${(props) => props.theme.colors.text.subtext0};
      font-size: ${(props) => props.theme.font.size.sm};
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;

      &.active {
        border-color: ${(props) => props.theme.accents.primary};
        background: ${(props) => rgba(props.theme.accents.primary, 0.08)};
        color: ${(props) => props.theme.accents.primary};
      }
    }
  }

  .settings-footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid ${(props) => props.theme.input.border};
  }

  .settings-actions {
    display: flex;
    gap: 0.5rem;
    margin-left: auto;
  }
`;

export default StyledWrapper;
