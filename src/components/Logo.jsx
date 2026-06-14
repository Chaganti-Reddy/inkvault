// Inline SVG mark: a document page whose lower half is a locked vault band —
// "your pages, kept private". Uses currentColor so it adapts to theme/accent.
export default function Logo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="6" y="3" width="20" height="26" rx="3" fill="var(--accent)" />
      <rect x="6" y="3" width="20" height="26" rx="3" fill="url(#iv-g)" opacity="0.25" />
      <path d="M11 9h10M11 13h10M11 17h6" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity="0.9" />
      <circle cx="16" cy="23" r="3.4" fill="#fff" />
      <rect x="15.2" y="22.4" width="1.6" height="2.6" rx="0.8" fill="var(--accent)" />
      <defs>
        <linearGradient id="iv-g" x1="6" y1="3" x2="26" y2="29" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}
