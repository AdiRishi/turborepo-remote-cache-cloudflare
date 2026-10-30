import { cn } from 'cn';

/** A trend line scaled from zero to its own maximum, drawn in the current text colour. */
export function Sparkline({
  values,
  className,
}: {
  values: readonly number[];
  className?: string;
}) {
  const max = Math.max(1, ...values);
  const step = 100 / Math.max(1, values.length - 1);
  const points = values
    .map((value, index) => `${index * step},${100 - (value / max) * 100}`)
    .join(' ');
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={cn('overflow-visible', className)}
      aria-hidden
    >
      <polygon points={`0,100 ${points} 100,100`} fill="currentColor" opacity={0.1} />
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.25}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
