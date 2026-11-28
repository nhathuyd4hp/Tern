import React from 'react';

const ColorBadge = ({ color, size = 10 }) => {
  const sizeValue = typeof size === 'string' ? size : `${size}px`;

  return (
    <div
      className="flex-shrink-0 rounded-full"
      data-testid="color-badge"
      style={{
        width: sizeValue,
        height: sizeValue,
        backgroundColor: color || 'transparent'
      }}
    />
  );
};

export default ColorBadge;
