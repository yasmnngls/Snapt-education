const PATHS = {
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  pencil: (
    <>
      <path d="M15.5 4.5 19.5 8.5 9 19H5v-4z" />
      <path d="m13.5 6.5 4 4" />
    </>
  ),
  trash: (
    <>
      <path d="M5 7h14" />
      <path d="M10 4h4" />
      <path d="M7 7l1 12h8l1-12" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s6-5.6 6-11a6 6 0 1 0-12 0c0 5.4 6 11 6 11z" />
      <circle cx="12" cy="10" r="2.2" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V5" />
      <path d="m7.5 9.5 4.5-4.5 4.5 4.5" />
      <path d="M5 15v4h14v-4" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  cloud: (
    <>
      <path d="M7.5 18.5h9a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 6.6 9.6 4.5 4.5 0 0 0 7.5 18.5z" />
      <path d="m9.5 13.8 1.8 1.8 3.4-3.6" />
    </>
  ),
  back: <path d="M14.5 6 8.5 12l6 6" />,
  home: (
    <>
      <path d="M4 11 12 4.5 20 11" />
      <path d="M6.5 9.5V19h11V9.5" />
    </>
  ),
  leaf: (
    <>
      <path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14z" />
      <path d="M5 19 13 11" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 4v4M12 16v4M4 12h4M16 12h4" />
      <path d="m7 7 1.8 1.8M15.2 15.2 17 17M17 7l-1.8 1.8M8.8 15.2 7 17" />
    </>
  ),
  send: (
    <>
      <path d="M5 12h13" />
      <path d="m12.5 6 6 6-6 6" />
    </>
  ),
  pen: <path d="M4 20c3-1 5-2 7-4l8-8-3-3-8 8c-2 2-3 4-4 7z" />,
} as const;

export type IconName = keyof typeof PATHS;

export default function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
