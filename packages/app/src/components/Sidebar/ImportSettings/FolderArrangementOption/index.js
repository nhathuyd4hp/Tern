import ImportSettingRow from 'components/Sidebar/ImportSettings/ImportSettingRow';
import ImportSettingDropdown from 'components/Sidebar/ImportSettings/ImportSettingDropdown';

const folderArrangementOptions = [
  { value: 'tags', label: 'Tags' },
  { value: 'path', label: 'Paths' }
];

const FolderArrangementOption = ({ value, onChange, disabled = false, className }) => (
  <ImportSettingRow
    className={className}
    label="Collection arrangement"
    description="Select whether to create collections according to the spec's paths or tags."
    disabled={disabled}
  >
    <ImportSettingDropdown options={folderArrangementOptions} value={value} onChange={onChange} testId="grouping" disabled={disabled} />
  </ImportSettingRow>
);

export default FolderArrangementOption;
