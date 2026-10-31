// One icon family: 24px grid, 1.75 stroke, rounded caps and joins.

function Svg({ size = 24, children, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

/* ---------- Interface ---------- */

// Points left: "forward" in a right-to-left layout.
export const IconArrow = (p) => (
  <Svg {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Svg>
);

export const IconCheck = (p) => (
  <Svg {...p}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </Svg>
);

export const IconClose = (p) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);

export const IconPlus = (p) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const IconMenu = (p) => (
  <Svg {...p}>
    <path d="M4 8h16M4 16h16" />
  </Svg>
);

/* ---------- Occasions ---------- */

export const IconRings = (p) => (
  <Svg {...p}>
    <circle cx="8.5" cy="14.5" r="5" />
    <circle cx="15.5" cy="14.5" r="5" />
    <path d="m8.5 9.5-2-2.5 2-2.5 2 2.5z" />
  </Svg>
);

export const IconRing = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="15.5" r="5.5" />
    <path d="M9 3h6l2.5 3L12 10 6.5 6z" />
  </Svg>
);

export const IconCap = (p) => (
  <Svg {...p}>
    <path d="m2.5 9 9.5-4.5L21.5 9 12 13.5z" />
    <path d="M6.5 11.5V16c1.5 1.5 3.3 2 5.5 2s4-.5 5.5-2v-4.5" />
    <path d="M21.5 9v6" />
  </Svg>
);

export const IconBottle = (p) => (
  <Svg {...p}>
    <path d="M8.5 10.5h7V20a1.5 1.5 0 0 1-1.5 1.5h-4A1.5 1.5 0 0 1 8.5 20z" />
    <path d="M7.5 7.5h9v3h-9z" />
    <path d="M10 7.5v-2a2 2 0 0 1 4 0v2" />
    <path d="M8.5 14.5h3M8.5 17.5h3" />
  </Svg>
);

export const IconParty = (p) => (
  <Svg {...p}>
    <path d="M3.5 20.5 8 8l8 8z" />
    <path d="M14 3v3M19 5l-2.5 2.5M21 10h-3" />
    <path d="M10.5 4.5v.01M20 14.5v.01" />
  </Svg>
);

export const IconStore = (p) => (
  <Svg {...p}>
    <path d="M4 10v10.5h16V10" />
    <path d="M2.5 9.5 4.5 4h15l2 5.5" />
    <path d="M2.5 9.5a3.17 3.17 0 0 0 6.33 0 3.17 3.17 0 0 0 6.34 0 3.17 3.17 0 0 0 6.33 0" />
    <path d="M10 20.5v-5h4v5" />
  </Svg>
);

// Dallah — the Arabic coffee pot, for gatherings and family dinners.
export const IconDallah = (p) => (
  <Svg {...p}>
    <path d="M12 2v1.5" />
    <path d="M9.25 7.5c0-2.5 1.05-4 2.75-4s2.75 1.5 2.75 4" />
    <path d="M8.75 7.5h6.5" />
    <path d="M9.5 7.5c0 2.5-2.5 4.5-2.5 8.5 0 2 .8 3.7 1.5 5h7c.7-1.3 1.5-3 1.5-5 0-4-2.5-6-2.5-8.5" />
    <path d="M8.6 10 3 8.5l3.8 5" />
    <path d="M15.2 9.5c3.3-.3 5.3 1.5 5.3 4 0 2.3-1.5 3.8-3.6 4.2" />
  </Svg>
);

export const IconPencil = (p) => (
  <Svg {...p}>
    <path d="M4 20h4L20 8l-4-4L4 16z" />
    <path d="m13.5 6.5 4 4" />
  </Svg>
);

/* ---------- Product ---------- */

export const IconQr = (p) => (
  <Svg {...p}>
    <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z" />
    <path
      d="M14 14h2v2h-2zM18 14h2v2h-2zM16 16h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z"
      fill="currentColor"
      stroke="none"
    />
  </Svg>
);

export const IconChat = (p) => (
  <Svg {...p}>
    <path d="M3.5 4h17v12.5h-10l-5 4v-4h-2z" />
    <path d="m8.5 10.25 2.5 2.5 4.5-5" />
  </Svg>
);

export const IconPin = (p) => (
  <Svg {...p}>
    <path d="M12 21.5s7-6.6 7-11.5a7 7 0 1 0-14 0c0 4.9 7 11.5 7 11.5z" />
    <path d="M10 8h4v4h-4z" />
  </Svg>
);

export const IconCalendar = (p) => (
  <Svg {...p}>
    <path d="M4 5.5h16v15H4z" />
    <path d="M4 10h16M8 3v4M16 3v4" />
  </Svg>
);

export const IconClock = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7v5.5l3.5 2" />
  </Svg>
);

export const IconNote = (p) => (
  <Svg {...p}>
    <path d="M5 3.5h9.5L19 8v12.5H5z" />
    <path d="M14.5 3.5V8H19" />
    <path d="M8.5 12.5h7M8.5 16H13" />
  </Svg>
);

export const IconUsers = (p) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.25" />
    <path d="M2.5 20v-1.5A4.5 4.5 0 0 1 7 14h4a4.5 4.5 0 0 1 4.5 4.5V20" />
    <path d="M16 4.9a3.25 3.25 0 0 1 0 6.2M18 14.2a4.5 4.5 0 0 1 3.5 4.3V20" />
  </Svg>
);

export const IconForm = (p) => (
  <Svg {...p}>
    <path d="M5 3.5h14v17H5z" />
    <path d="M8.5 8h7M8.5 12h7M8.5 16h4" />
  </Svg>
);

export const IconLayout = (p) => (
  <Svg {...p}>
    <path d="M4 4h16v16H4z" />
    <path d="M4 9.5h16M10 9.5V20" />
  </Svg>
);

export const IconLayers = (p) => (
  <Svg {...p}>
    <path d="m12 3.5 9 4.5-9 4.5L3 8z" />
    <path d="m3 12.5 9 4.5 9-4.5" />
    <path d="m3 16.5 9 4.5 9-4.5" />
  </Svg>
);

export const IconSend = (p) => (
  <Svg {...p}>
    <path d="M20.5 3.5 3.5 10l6.5 3 3 6.5z" />
    <path d="M10 13 20.5 3.5" />
  </Svg>
);

export const IconChart = (p) => (
  <Svg {...p}>
    <path d="M4 20V4M4 20h16" />
    <path d="M8.5 16v-5M13 16V8M17.5 16v-3" />
  </Svg>
);

export const IconGift = (p) => (
  <Svg {...p}>
    <path d="M4 11h16v9.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
    <path d="M3 7.5h18V11H3z" />
    <path d="M12 7.5v14" />
    <path d="M12 7.5C10.5 4 7.5 3.5 7 5.3c-.4 1.6 2.2 2.2 5 2.2zM12 7.5c1.5-3.5 4.5-4 5-2.2.4 1.6-2.2 2.2-5 2.2z" />
  </Svg>
);

// The four-point star from the logo, filled.
export const IconStar = (p) => (
  <Svg {...p} fill="currentColor" stroke="none">
    <path d="M12 2.5c.7 5.6 3.9 8.8 9.5 9.5-5.6.7-8.8 3.9-9.5 9.5-.7-5.6-3.9-8.8-9.5-9.5 5.6-.7 8.8-3.9 9.5-9.5z" />
  </Svg>
);

export const IconEye = (p) => (
  <Svg {...p}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);

export const IconEyeOff = (p) => (
  <Svg {...p}>
    <path d="M10.6 5.6A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.9 3.7M6.5 6.9C3.9 8.6 2.5 12 2.5 12S6 18.5 12 18.5c1.9 0 3.5-.6 4.9-1.5" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3.5 3.5l17 17" />
  </Svg>
);

export const IconShield = (p) => (
  <Svg {...p}>
    <path d="M12 3 4.5 6v5.5c0 4.5 3.2 8 7.5 9.5 4.3-1.5 7.5-5 7.5-9.5V6z" />
    <path d="m8.8 12 2.2 2.2 4.2-4.4" />
  </Svg>
);

export const IconLogout = (p) => (
  <Svg {...p}>
    <path d="M14 4.5h3.5a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H14" />
    <path d="M10 8 6 12l4 4M6 12h9.5" />
  </Svg>
);

export const IconChevron = (p) => (
  <Svg {...p}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
);

export const IconSun = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8" />
  </Svg>
);

export const IconMoon = (p) => (
  <Svg {...p}>
    <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
  </Svg>
);

export const IconCamera = (p) => (
  <Svg {...p}>
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </Svg>
);

export const IconKeyboard = (p) => (
  <Svg {...p}>
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M7 16h10" />
  </Svg>
);

export const IconAlert = (p) => (
  <Svg {...p}>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </Svg>
);

export const IconLock = (p) => (
  <Svg {...p}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </Svg>
);

export const IconPrint = (p) => (
  <Svg {...p}>
    <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <path d="M6 14h12v8H6z" />
  </Svg>
);
