import { useTheme } from '../../../../providers/Theme';
import { useDispatch } from 'react-redux';
import { openImportApplicationDialog } from 'providers/ReduxStore/slices/open-collection-modal/actions';

import styled from 'styled-components';
import StyledWrapper from './StyledWrapper';

const LinkStyle = styled.span`
  color: ${(props) => props.theme['text-link']};
`;

const CreateOrOpenCollection = ({ onCreateClick }) => {
  const { theme } = useTheme();
  const dispatch = useDispatch();

  const handleOpenCollection = () => {
    dispatch(openImportApplicationDialog());
  };
  const CreateLink = () => (
    <LinkStyle
      className="underline text-link cursor-pointer"
      theme={theme}
      onClick={onCreateClick}
    >
      Create
    </LinkStyle>
  );
  const ImportLink = () => (
    <LinkStyle className="underline text-link cursor-pointer" theme={theme} onClick={() => handleOpenCollection(true)}>
      Import
    </LinkStyle>
  );

  return (
    <StyledWrapper className="px-2 mt-4">
      <div className="text-xs text-center">
        <div>No applications found.</div>
        <div className="mt-2">
          <CreateLink /> or <ImportLink /> Application.
        </div>
      </div>
    </StyledWrapper>
  );
};

export default CreateOrOpenCollection;
