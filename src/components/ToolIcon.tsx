import type { Tool } from '../editor/tools';

export default function ToolIcon({ name }: { name: Tool | 'undo' | 'redo' }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  if (name === 'pen') {
    return (
      <svg {...common}>
        <path d="M14 4 20 10 9 21H4v-5z" />
        <path d="m13 6 5 5" />
      </svg>
    );
  }
  if (name === 'highlight') {
    return (
      <svg {...common}>
        <path d="M5 16h10l2-6-6-2-6 8z" />
        <path d="M5 19h14" />
      </svg>
    );
  }
  if (name === 'underline') {
    return (
      <svg {...common}>
        <path d="M7 5v6a5 5 0 0 0 10 0V5" />
        <path d="M5 19h14" />
      </svg>
    );
  }
  if (name === 'circle') {
    return (
      <svg {...common}>
        <ellipse cx="12" cy="12" rx="7" ry="5.5" />
      </svg>
    );
  }
  if (name === 'arrow') {
    return (
      <svg {...common}>
        <path d="M5 17 18 7" />
        <path d="M11 6h8v8" />
      </svg>
    );
  }
  if (name === 'text') {
    return (
      <svg {...common}>
        <path d="M6 6h12" />
        <path d="M12 6v12" />
      </svg>
    );
  }
  if (name === 'eraser') {
    return (
      <svg {...common}>
        <path d="M4 15 12 5l7 6-6 8H8z" />
        <path d="M8 19h12" />
      </svg>
    );
  }
  if (name === 'pan') {
    return (
      <svg {...common}>
        <path d="M12 3v18" />
        <path d="M3 12h18" />
        <path d="m8 7 4-4 4 4" />
        <path d="m8 17 4 4 4-4" />
      </svg>
    );
  }
  if (name === 'undo') {
    return (
      <svg {...common}>
        <path d="M9 14 4 9l5-5" />
        <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="m15 14 5-5-5-5" />
      <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
    </svg>
  );
}
