import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import Select from './index';
import themes from 'themes/index';

const renderSelect = (props) => render(
  <ThemeProvider theme={themes.dark}>
    <Select data={['a', 'b', 'c']} {...props} />
  </ThemeProvider>
);

describe('Select multiple', () => {
  beforeAll(() => {
    window.HTMLElement.prototype.scrollIntoView = jest.fn();
  });

  it('adds and removes values without closing the list', () => {
    const onChange = jest.fn();
    renderSelect({ multiple: true, value: ['a'], onChange });
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(screen.getAllByRole('option')[1]);
    expect(onChange).toHaveBeenCalledWith(['a', 'b']);
    fireEvent.click(screen.getAllByRole('option')[0]);
    expect(onChange).toHaveBeenLastCalledWith([]);
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });
});
