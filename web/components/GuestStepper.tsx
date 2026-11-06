'use client';

/**
 * A guest count with − and + buttons. The number can still be typed.
 * An empty value counts as `fallback` when a button is pressed.
 */
export function GuestStepper({
  id,
  value,
  onChange,
  min = 1,
  max = 30,
  fallback = 2,
  label = 'guests',
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  fallback?: number;
  label?: string;
}) {
  const current = value === '' ? fallback : Number(value) || fallback;
  const step = (by: number) => onChange(String(Math.min(max, Math.max(min, current + by))));
  return (
    <div className="stepper">
      <button type="button" onClick={() => step(-1)} disabled={current <= min} aria-label={`Fewer ${label}`}>
        −
      </button>
      <input id={id} type="number" min={min} max={max} inputMode="numeric" placeholder={String(fallback)} value={value} onChange={(e) => onChange(e.target.value)} />
      <button type="button" onClick={() => step(1)} disabled={current >= max} aria-label={`More ${label}`}>
        +
      </button>
    </div>
  );
}
