import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';

export type Snap = 'peek' | 'half' | 'full';

export const SHEET_QUERY = '(max-width: 760px), (max-width: 1100px) and (orientation: portrait)';
const SETTLE_MS = 360;
const HALF = 0.5;
const FLICK = 0.35;

export function useSheetLayout() {
  const [active, setActive] = useState(() => window.matchMedia(SHEET_QUERY).matches);
  useEffect(() => {
    const query = window.matchMedia(SHEET_QUERY);
    const onChange = () => setActive(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return active;
}

type Drag = {
  id: number;
  startY: number;
  base: number;
  pos: number;
  lastY: number;
  lastT: number;
  velocity: number;
  moved: boolean;
};

export function useSheet(active: boolean) {
  const sheetRef = useRef<HTMLElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const [snap, setSnapState] = useState<Snap>('peek');
  const [reserve, setReserve] = useState<'peek' | 'half'>('peek');
  const drag = useRef<Drag | null>(null);
  const swallowClick = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  const setSnap = useCallback((next: Snap) => {
    setSnapState(next);
    window.clearTimeout(timer.current);
    if (next === 'peek') setReserve('peek');
    else timer.current = window.setTimeout(() => setReserve('half'), SETTLE_MS);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    if (!active) setSnap('peek');
  }, [active, setSnap]);

  function offsets() {
    const sheet = sheetRef.current;
    const head = headRef.current;
    if (!sheet || !head) return null;
    const height = sheet.offsetHeight;
    const visible = { peek: head.offsetHeight, half: window.innerHeight * HALF, full: height };
    return {
      peek: Math.max(0, height - visible.peek),
      half: Math.max(0, height - visible.half),
      full: 0,
    } satisfies Record<Snap, number>;
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!active || drag.current || event.button !== 0) return;
    const spots = offsets();
    if (!spots) return;
    swallowClick.current = false;
    drag.current = {
      id: event.pointerId,
      startY: event.clientY,
      base: spots[snap],
      pos: spots[snap],
      lastY: event.clientY,
      lastT: event.timeStamp,
      velocity: 0,
      moved: false,
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  }

  function onPointerMove(event: PointerEvent) {
    const current = drag.current;
    const sheet = sheetRef.current;
    const spots = offsets();
    if (!current || !sheet || !spots || event.pointerId !== current.id) return;
    const dy = event.clientY - current.startY;
    if (!current.moved) {
      if (Math.abs(dy) < 6) return;
      current.moved = true;
      sheet.style.transition = 'none';
    }
    let next = current.base + dy;
    if (next < 0) next *= 0.2;
    if (next > spots.peek) next = spots.peek + (next - spots.peek) * 0.2;
    const elapsed = Math.max(1, event.timeStamp - current.lastT);
    current.velocity = (event.clientY - current.lastY) / elapsed;
    current.lastY = event.clientY;
    current.lastT = event.timeStamp;
    current.pos = next;
    sheet.style.transform = `translateY(${next}px)`;
  }

  function onPointerUp(event: PointerEvent) {
    const current = drag.current;
    if (!current || event.pointerId !== current.id) return;
    drag.current = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
    if (!current.moved) return;
    swallowClick.current = true;
    const sheet = sheetRef.current;
    const spots = offsets();
    if (sheet) {
      sheet.style.transition = '';
      sheet.style.transform = '';
    }
    if (!spots) return;
    const order: Snap[] = ['full', 'half', 'peek'];
    let target: Snap;
    if (current.velocity < -FLICK) {
      target = [...order].reverse().find((item) => spots[item] < current.pos - 1) ?? 'full';
    } else if (current.velocity > FLICK) {
      target = order.find((item) => spots[item] > current.pos + 1) ?? 'peek';
    } else {
      target = order.reduce((best, item) =>
        Math.abs(spots[item] - current.pos) < Math.abs(spots[best] - current.pos) ? item : best,
      );
    }
    setSnap(target);
  }

  function onClickCapture(event: ReactMouseEvent) {
    if (!swallowClick.current) return;
    swallowClick.current = false;
    event.preventDefault();
    event.stopPropagation();
  }

  function cycle() {
    setSnap(snap === 'peek' ? 'half' : snap === 'half' ? 'full' : 'peek');
  }

  return {
    sheetRef,
    snap,
    reserve,
    setSnap,
    cycle,
    headProps: {
      ref: headRef,
      onPointerDown,
      onClickCapture,
    },
  };
}
