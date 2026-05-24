import React from 'react';

type TabName = 'zone' | 'map' | 'forecast' | 'wave' | 'hist';

interface Props {
  name: TabName;
  color?: string;
}

const S = 18;

export default function TabIcon({ name, color = 'currentColor' }: Props) {
  if (name === 'zone') return (
    <svg width={S} height={S} viewBox="0 0 18 18">
      <circle cx="9" cy="9" r="2.5" fill={color} />
      <circle cx="9" cy="9" r="6" stroke={color} strokeWidth="1" fill="none" />
    </svg>
  );
  if (name === 'map') return (
    <svg width={S} height={S} viewBox="0 0 18 18" fill="none" stroke={color} strokeWidth="1.2">
      <path d="M2 5l5-2 4 2 5-2v12l-5 2-4-2-5 2z" />
      <path d="M7 3v12M11 5v12" />
    </svg>
  );
  if (name === 'forecast') return (
    <svg width={S} height={S} viewBox="0 0 18 18" fill="none" stroke={color} strokeWidth="1.2">
      <path d="M2 13l4-5 3 3 5-7 2 2" />
    </svg>
  );
  if (name === 'wave') return (
    <svg width={S} height={S} viewBox="0 0 18 18" fill="none" stroke={color} strokeWidth="1.2">
      <path d="M2 9 C 4 9, 4 4, 6 4 S 8 14, 10 14 S 12 4, 14 9 L 16 9" />
    </svg>
  );
  if (name === 'hist') return (
    <svg width={S} height={S} viewBox="0 0 18 18" fill="none" stroke={color} strokeWidth="1.2">
      <rect x="3"    y="4" width="2.5" height="10" />
      <rect x="7.75" y="7" width="2.5" height="7" />
      <rect x="12.5" y="2" width="2.5" height="12" />
    </svg>
  );
  return null;
}
