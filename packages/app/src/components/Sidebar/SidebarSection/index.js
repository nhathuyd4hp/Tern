import StyledWrapper from './StyledWrapper';

const SidebarSection = ({
  title,
  icon: Icon,
  actions,
  children,
  className = ''
}) => {
  // The Applications list is the sidebar's only content, so the section is always open.
  return (
    <StyledWrapper className={className}>
      <div
        className="sidebar-section expanded single-expanded"
      >
        <div className="section-header">
          <div className="section-header-left">
            <div className="section-icon-wrapper">
              {Icon && <Icon size={14} stroke={1.5} className="section-icon" />}
            </div>
            <span className="section-title">{title}</span>
          </div>
          {actions && (
            <div className="section-actions">
              {actions}
            </div>
          )}
        </div>
        <div className="section-content">
          {children}
        </div>
      </div>
    </StyledWrapper>
  );
};

export default SidebarSection;
