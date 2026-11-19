import type { Child } from "hono/jsx";

/** Inline line icons: 24px grid, 2px round strokes, coloured by currentColor. Decorative; the text beside each says it. */
function Icon({ children, class: cls = "icon" }: { children: Child; class?: string }) {
  return (
    <svg
      class={cls}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const HomeIcon = () => (
  <Icon>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9v11h5v-6h4v6h5V9" />
  </Icon>
);

/** A receipt inside scanner corners. */
export const ScanIcon = () => (
  <Icon>
    <path d="M3 7V4h3M18 4h3v3M21 17v3h-3M6 20H3v-3" />
    <path d="M8 7h8v10l-2-1-2 1-2-1-2 1z" />
    <path d="M10 10h4M10 13h3" />
  </Icon>
);

export const ProfileIcon = () => (
  <Icon>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
  </Icon>
);

/** Overdue: a circle with a cross. */
export const OverdueIcon = () => (
  <Icon class="icon status-icon">
    <circle cx="12" cy="12" r="9" />
    <path d="m9 9 6 6M15 9l-6 6" />
  </Icon>
);

/** Due soon: a clock. */
export const SoonIcon = () => (
  <Icon class="icon status-icon">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Icon>
);

/** Unknown: a pencil, because the fix is to fill something in. */
export const UnknownIcon = () => (
  <Icon class="icon status-icon">
    <path d="M4 20h4L19 9l-4-4L4 16z" />
    <path d="m13.5 6.5 4 4" />
  </Icon>
);

export const ChevronIcon = () => (
  <Icon class="icon chevron">
    <path d="m9 6 6 6-6 6" />
  </Icon>
);

export const BackIcon = () => (
  <Icon class="icon chevron">
    <path d="m15 6-6 6 6 6" />
  </Icon>
);

/** The icon for a due status; "ok" has none, so OK rows stay quiet. */
export function StatusIcon({ status }: { status: "overdue" | "soon" | "ok" | "unknown" }) {
  if (status === "overdue") return <OverdueIcon />;
  if (status === "soon") return <SoonIcon />;
  if (status === "unknown") return <UnknownIcon />;
  return null;
}

/** Odometer: a gauge with its needle. */
export const GaugeIcon = () => (
  <Icon class="icon status-icon">
    <path d="M4.5 18a9 9 0 1 1 15 0" />
    <path d="m12 14 4-5" />
    <circle cx="12" cy="14" r="1.2" />
  </Icon>
);

/** Camera, for taking or choosing a receipt photo. */
export const CameraIcon = () => (
  <Icon class="icon capture-icon">
    <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
    <circle cx="12" cy="13" r="3.5" />
  </Icon>
);
