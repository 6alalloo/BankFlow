import React from 'react';

export const Logo: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ 
  className, 
  style,
}) => (
  <img 
    src="/bankflow-logo-black.png"
    alt="Bankflow"
    className={className}
    style={{ ...style, maxHeight: '100%' }}
  />
);
