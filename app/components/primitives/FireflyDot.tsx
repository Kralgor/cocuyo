import React from 'react';

interface Props {
  size?: number;
  color: string;
  pulse?: boolean;
}

export default function FireflyDot({ size = 14, color, pulse = true }: Props) {
  return (
    <span style={{
      display: 'inline-block',
      width: size,
      height: size,
      borderRadius: '50%',
      background: color,
      position: 'relative',
      flexShrink: 0,
      animation: pulse ? 'firefly-float 2.4s ease-in-out infinite' : 'none',
    }} />
  );
}
