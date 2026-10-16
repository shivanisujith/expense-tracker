// Small icon buttons shared by the expense list and the Manage categories popup.

// `label` is read by screen readers and shown as a tooltip on hover.
export function IconButton({ label, onClick, disabled, children }) {
  return (
    <button
      type="button"
      className="icon-button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

export function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function BinIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// Trend icons for the insight line: decorative, since the words say it.
const TREND_PATHS = {
  down: 'M12 5v14M6 13l6 6 6-6',
  up: 'M12 19V5M6 11l6-6 6 6',
  same: 'M5 12h14',
}

export function TrendIcon({ trend }) {
  return (
    <svg
      className={`trend-icon trend-${trend}`}
      viewBox="0 0 24 24"
      width="16"
      height="16"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={TREND_PATHS[trend]}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// Category icons: simple line drawings, 24 x 24, in the circle's icon colour.
const CATEGORY_PATHS = {
  // Fork (three tines) and knife.
  food: 'M5 3v5a3 3 0 0 0 6 0V3M8 3v18M18 21V3c-2 1.5-3 4-3 8h3',
  // Bus with windows and wheels.
  transport: 'M6 4h12a2 2 0 0 1 2 2v11H4V6a2 2 0 0 1 2-2zM4 11h16M8 17v2M16 17v2M8 14h.01M16 14h.01',
  // Shopping bag with handles.
  shopping: 'M5 8h14l-1.2 12H6.2L5 8zM9 8V6a3 3 0 0 1 6 0v2',
  // Receipt with a zigzag bottom and two lines.
  bills: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3zM9 8h6M9 12h6',
  // Ticket with notches and a dashed tear line.
  entertainment: 'M3 6h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4V6zM14 6v2M14 11v2M14 16v2',
  // Three dots.
  other: 'M6 12h.01M12 12h.01M18 12h.01',
  // Price tag (the default for categories you create).
  tag: 'M3 12V4h8l10 10-8 8-10-10zM7.5 7.5h.01',
}

/** A category's icon in its soft circle. Decorative: the name is always shown next to it. */
export function CategoryIcon({ icon, colours }) {
  // Dots and the tag's hole are drawn as zero-length lines; a thicker
  // stroke makes them visible dots.
  const dotWidth = icon === 'other' ? 3.5 : 2
  return (
    <span
      className="category-icon"
      data-icon={icon}
      aria-hidden="true"
      style={{ backgroundColor: colours.circle, color: colours.icon }}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" focusable="false">
        <path
          d={CATEGORY_PATHS[icon]}
          fill="none"
          stroke="currentColor"
          strokeWidth={dotWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}
