import { useSelector, useDispatch } from 'react-redux';
import { useMemo } from 'react';
import { getLanguages } from 'utils/codegenerator/targets';
import { updateGenerateCode } from 'providers/ReduxStore/slices/app';
import Select from 'ui/Select';
import StyledWrapper from './StyledWrapper';

const CodeViewToolbar = () => {
  const dispatch = useDispatch();
  const languages = getLanguages();
  const generateCodePrefs = useSelector((state) => state.app.generateCode);

  // Group languages by their main language type
  const languageGroups = useMemo(() => {
    return languages.reduce((acc, lang) => {
      const mainLang = lang.name.split('-')[0];
      if (!acc[mainLang]) {
        acc[mainLang] = [];
      }
      acc[mainLang].push({
        ...lang,
        libraryName: lang.name.split('-')[1] || 'default'
      });
      return acc;
    }, {});
  }, [languages]);

  const mainLanguages = useMemo(() => Object.keys(languageGroups), [languageGroups]);

  const availableLibraries = useMemo(() => {
    return languageGroups[generateCodePrefs.mainLanguage] || [];
  }, [generateCodePrefs.mainLanguage, languageGroups]);

  // Event handlers
  const handleMainLanguageChange = (newMainLang) => {
    const defaultLibrary = languageGroups[newMainLang][0].libraryName;

    dispatch(updateGenerateCode({
      mainLanguage: newMainLang,
      library: defaultLibrary
    }));
  };

  const handleLibraryChange = (libraryName) => {
    dispatch(updateGenerateCode({
      library: libraryName
    }));
  };

  const handleInterpolateChange = (e) => {
    dispatch(updateGenerateCode({
      shouldInterpolate: e.target.checked
    }));
  };

  return (
    <StyledWrapper>
      <div className="toolbar">
        <div className="left-controls">
          <div className="select-wrapper">
            <Select
              size="sm"
              data={mainLanguages}
              value={generateCodePrefs.mainLanguage}
              onChange={handleMainLanguageChange}
              allowDeselect={false}
            />
          </div>

          {availableLibraries.length > 1 && (
            <div className="library-options">
              {availableLibraries.map((lib) => (
                <button
                  key={lib.libraryName}
                  className={`lib-btn ${generateCodePrefs.library === lib.libraryName ? 'active' : ''}`}
                  onClick={() => handleLibraryChange(lib.libraryName)}
                >
                  {lib.libraryName}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="right-controls">
          <label className="interpolate-checkbox">
            <input
              type="checkbox"
              data-testid="interpolate-vars-toggle"
              checked={generateCodePrefs.shouldInterpolate}
              onChange={handleInterpolateChange}
            />
            <span>Interpolate Variables</span>
          </label>
        </div>
      </div>
    </StyledWrapper>
  );
};

export default CodeViewToolbar;
