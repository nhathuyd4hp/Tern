import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import get from 'lodash/get';
import debounce from 'lodash/debounce';
import { useSelector, useDispatch } from 'react-redux';
import { savePreferences } from 'providers/ReduxStore/slices/app';
import StyledWrapper from './StyledWrapper';
import toast from 'react-hot-toast';
import Select from 'ui/Select';
import { getInstalledCodeFonts } from './utils';

const Font = () => {
  const dispatch = useDispatch();
  const preferences = useSelector((state) => state.app.preferences);
  const isInitialMount = useRef(true);

  const [codeFont, setCodeFont] = useState(get(preferences, 'font.codeFont', 'default'));
  const [codeFontSize, setCodeFontSize] = useState(get(preferences, 'font.codeFontSize', '13'));

  // A saved font that is not installed (or was typed by hand before this was a list) stays selectable.
  const fontOptions = useMemo(() => {
    const installedFonts = getInstalledCodeFonts();
    return codeFont === 'default' || installedFonts.includes(codeFont) ? installedFonts : [codeFont, ...installedFonts];
  }, []);

  const codeFontData = useMemo(
    () => [{ value: 'default', label: 'Default' }, ...fontOptions.map((fontName) => ({ value: fontName, label: fontName }))],
    [fontOptions]
  );

  const handleCodeFontSizeChange = (event) => {
    // Restrict to min/max value
    const clampedSize = Math.max(1, Math.min(event.target.value, 32));
    setCodeFontSize(clampedSize);
  };

  const handleSave = useCallback((font, fontSize) => {
    dispatch(
      savePreferences({
        ...preferences,
        font: {
          codeFont: font,
          codeFontSize: fontSize
        }
      })
    ).catch(() => {
      toast.error('Failed to save preferences');
    });
  }, [dispatch, preferences]);

  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;

  const debouncedSave = useCallback(
    debounce((font, fontSize) => {
      handleSaveRef.current(font, fontSize);
    }, 500),
    []
  );

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    debouncedSave(codeFont, codeFontSize);
    return () => {
      debouncedSave.flush();
    };
  }, [codeFont, codeFontSize, debouncedSave]);

  return (
    <StyledWrapper>
      <div className="flex flex-row gap-2 w-full">
        <div className="w-4/5">
          <label className="block">Code Editor Font</label>
          <Select
            className="mt-2"
            data-testid="code-font-select"
            data={codeFontData}
            value={codeFont}
            onChange={setCodeFont}
            allowDeselect={false}
            renderOption={({ option }) => <span style={{ fontFamily: option.value === 'default' ? undefined : `"${option.value}"` }}>{option.label}</span>}
          />
        </div>
        <div className="w-1/5">
          <label className="block">Font Size</label>
          <input
            type="number"
            className="block textbox mt-2 w-full"
            autoComplete="off"
            autoCorrect="off"
            inputMode="numeric"
            onChange={handleCodeFontSizeChange}
            defaultValue={codeFontSize}
          />
        </div>
      </div>
    </StyledWrapper>
  );
};

export default Font;
