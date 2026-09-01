export default function HayLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`hayLogo ${compact ? "compact" : ""}`} aria-label="HAY Engine">
      <svg className="hayGlyph" viewBox="0 0 64 64" role="img" aria-hidden="true">
        <path d="M32 5c6 8 13 11 24 11-5 7-6 14-3 24-9-1-16 2-21 12-5-10-12-13-21-12 3-10 2-17-3-24 11 0 18-3 24-11Z" fill="currentColor" opacity=".13"/>
        <path d="M18 18v28M46 18v28M18 31h28M27 18v28" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round"/>
        <circle cx="46" cy="18" r="3.2" fill="currentColor"/>
      </svg>
      <div className="hayWordmark"><strong>HAY</strong><span>ENGINE</span>{!compact && <small>Հայկական AI ենթակառուցվածք</small>}</div>
    </div>
  );
}
