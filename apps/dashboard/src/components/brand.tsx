import { useId } from 'react';

/** The documentation site's lockup: the replay mark and the "Turborepo Remote Cache" wordmark. */
export function Lockup({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240.656 20"
      className={className}
      role="img"
      aria-label="Turborepo Remote Cache"
    >
      <g transform="scale(0.6667)">
        <ReplayMark />
      </g>
      <g>
        <path
          d="M25.25 3V16M23 6.65H28.5M30.35 6V11A4.35 4.35 0 0 0 39.05 11M39.05 6V16M42.55 6V16M42.55 11A4.35 4.35 0 0 1 46.9 6.65H47.4M49.45 11A4.35 4.35 0 1 0 58.15 11A4.35 4.35 0 1 0 49.45 11ZM49.45 1V16M61.05 11A4.35 4.35 0 1 0 69.75 11A4.35 4.35 0 1 0 61.05 11ZM72.85 6V16M72.85 11A4.35 4.35 0 0 1 77.2 6.65H77.7M79.25 11H87.95A4.35 4.35 0 1 0 86.676 14.076M91.15 11A4.35 4.35 0 1 0 99.85 11A4.35 4.35 0 1 0 91.15 11ZM91.15 6V20M102.75 11A4.35 4.35 0 1 0 111.45 11A4.35 4.35 0 1 0 102.75 11Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
        />
        <path
          d="M118.3 6V16M118.3 11A4 4 0 0 1 122.3 7H122.8M124.7 11H132.7A4 4 0 1 0 131.528 13.828M136.9 6V16M136.9 10.5A3.5 3.5 0 0 1 143.9 10.5V16M143.9 10.5A3.5 3.5 0 0 1 150.9 10.5V16M154.7 11A4 4 0 1 0 162.7 11A4 4 0 1 0 154.7 11ZM167.15 3V16M164.9 7H170.4M172.4 11H180.4A4 4 0 1 0 179.228 13.828"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M194.428 8.172A4 4 0 1 0 194.428 13.828M197.828 11A4 4 0 1 0 205.828 11A4 4 0 1 0 197.828 11ZM205.828 6V16M216.256 8.172A4 4 0 1 0 216.256 13.828M219.956 1V16M219.956 11A4 4 0 0 1 227.956 11V16M231.656 11H239.656A4 4 0 1 0 238.484 13.828"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      </g>
    </svg>
  );
}

/** The cache mark alone, for narrow screens. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} role="img" aria-label="Turborepo Remote Cache">
      <ReplayMark />
    </svg>
  );
}

/**
 * The header renders the lockup and the mark and hides one of them. A gradient defined inside a hidden SVG
 * paints nothing, so each copy defines its own.
 */
function ReplayMark() {
  const gradient = useId();
  const paint = `url(#${gradient})`;
  return (
    <>
      <defs>
        <linearGradient id={gradient} x1="20" y1="4" x2="4" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--brand-from)" />
          <stop offset="1" stopColor="var(--brand-to)" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="4.8" fill="none" stroke="currentColor" strokeWidth="3.1" />
      <path
        d="M16.557 4.707A8.6 8.6 0 1 1 6.026 5.814"
        fill="none"
        stroke={paint}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M8.184 3.73L4.289 4.015L7.763 7.612Z"
        fill={paint}
        stroke={paint}
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
    </>
  );
}
