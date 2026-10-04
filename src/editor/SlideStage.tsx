import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Ellipse, Group, Image as KonvaImage, Layer, Line, Rect, Stage, Text } from 'react-konva';
import { fontFamilyFor, loadHandFonts } from '../hand/styles';
import type { Annotation, DetectedBlock, NoteOrigin, Point, ShapeKind } from '../types';
import { arrowGeometry, connectorFor, connectorPoints, hitTest, MARK_COLOR, strokeOutline } from './geometry';
import { clamp, strokeWidthFor, textSizeFor, type Tool } from './tools';
import { fitView, zoomAt, type View } from './view';

type StrokeGesture = {
  kind: 'stroke';
  tool: 'pen' | 'highlight';
  points: Point[];
  color: string;
  width: number;
};

type ShapeGesture = {
  kind: 'shape';
  shape: ShapeKind;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
};

type EraseGesture = { kind: 'erase'; ids: string[] };

type PlaceTextGesture = {
  kind: 'place-text';
  x: number;
  y: number;
  originX: number;
  originY: number;
  moved: boolean;
};

type MoveTextGesture = {
  kind: 'move-text';
  id: string;
  originX: number;
  originY: number;
  dx: number;
  dy: number;
  moved: boolean;
};

type Gesture = StrokeGesture | ShapeGesture | EraseGesture | MoveTextGesture | PlaceTextGesture;

type Editing = {
  id: string;
  draft: string;
  fresh: boolean;
  checkpointed: boolean;
  x: number;
  y: number;
  color: string;
  size: number;
  boxWidth: number;
  styleId?: string;
  origin?: NoteOrigin;
};

type SlideStageProps = {
  imageUrl: string;
  width: number;
  height: number;
  annotations: Annotation[];
  tool: Tool;
  color: string;
  sizeIndex: number;
  handStyleId: string;
  handColor: string;
  detected: DetectedBlock[] | null;
  previews: Annotation[];
  focusId: string | null;
  onCommit: (next: Annotation[]) => void;
  onReplace: (next: Annotation[]) => void;
  onCheckpoint: () => void;
  onDraftDirty: (dirty: boolean) => void;
};

export default function SlideStage({
  imageUrl,
  width,
  height,
  annotations,
  tool,
  color,
  sizeIndex,
  handStyleId,
  handColor,
  detected,
  previews,
  focusId,
  onCommit,
  onReplace,
  onCheckpoint,
  onDraftDirty,
}: SlideStageProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const viewRef = useRef(view);
  const gestureRef = useRef<Gesture | null>(null);
  const annotationsRef = useRef(annotations);
  const toolRef = useRef(tool);
  const editingRef = useRef(editing);
  const userMoved = useRef(false);
  const panRef = useRef<{ sx: number; sy: number; vx: number; vy: number } | null>(null);
  const [fontEpoch, setFontEpoch] = useState(0);
  viewRef.current = view;
  annotationsRef.current = annotations;
  toolRef.current = tool;
  editingRef.current = editing;

  function updateGesture(next: Gesture | null) {
    gestureRef.current = next;
    setGesture(next);
  }

  useEffect(() => {
    const element = wrapRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      setSize({ w: element.clientWidth, h: element.clientHeight });
    });
    observer.observe(element);
    setSize({ w: element.clientWidth, h: element.clientHeight });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadHandFonts([handStyleId]).then(() => {
      if (!cancelled) setFontEpoch((value) => value + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [handStyleId]);

  useEffect(() => {
    const next = new Image();
    next.onload = () => setImage(next);
    next.src = imageUrl;
  }, [imageUrl]);

  useEffect(() => {
    if (userMoved.current) return;
    if (size.w < 2 || size.h < 2) return;
    setView(fitView(size.w, size.h, width, height));
  }, [size, imageUrl, width, height]);

  useEffect(() => {
    const element = wrapRef.current;
    if (!element) return;

    function onWheel(event: WheelEvent) {
      event.preventDefault();
      const rect = element!.getBoundingClientRect();
      const factor = event.deltaY < 0 ? 1.08 : 1 / 1.08;
      const current = viewRef.current;
      const nextScale = clamp(current.scale * factor, 0.15, 8);
      userMoved.current = true;
      setView(zoomAt(current, event.clientX - rect.left, event.clientY - rect.top, nextScale));
    }

    let pinch: { dist: number; scale: number; imageX: number; imageY: number } | null = null;

    function touchDistance(touches: TouchList) {
      return Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
    }

    function onTouchStart(event: TouchEvent) {
      if (event.touches.length !== 2) return;
      updateGesture(null);
      panRef.current = null;
      const rect = element!.getBoundingClientRect();
      const midX = (event.touches[0].clientX + event.touches[1].clientX) / 2 - rect.left;
      const midY = (event.touches[0].clientY + event.touches[1].clientY) / 2 - rect.top;
      const current = viewRef.current;
      pinch = {
        dist: touchDistance(event.touches),
        scale: current.scale,
        imageX: (midX - current.x) / current.scale,
        imageY: (midY - current.y) / current.scale,
      };
    }

    function onTouchMove(event: TouchEvent) {
      if (!pinch || event.touches.length !== 2) return;
      event.preventDefault();
      const rect = element!.getBoundingClientRect();
      const midX = (event.touches[0].clientX + event.touches[1].clientX) / 2 - rect.left;
      const midY = (event.touches[0].clientY + event.touches[1].clientY) / 2 - rect.top;
      const nextScale = clamp(pinch.scale * (touchDistance(event.touches) / pinch.dist), 0.15, 8);
      userMoved.current = true;
      setView({
        scale: nextScale,
        x: midX - pinch.imageX * nextScale,
        y: midY - pinch.imageY * nextScale,
      });
    }

    function onTouchEnd() {
      pinch = null;
    }

    element.addEventListener('wheel', onWheel, { passive: false });
    element.addEventListener('touchstart', onTouchStart, { passive: true });
    element.addEventListener('touchmove', onTouchMove, { passive: false });
    element.addEventListener('touchend', onTouchEnd);
    return () => {
      element.removeEventListener('wheel', onWheel);
      element.removeEventListener('touchstart', onTouchStart);
      element.removeEventListener('touchmove', onTouchMove);
      element.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  function imagePoint(event: { clientX: number; clientY: number }): Point {
    const rect = wrapRef.current!.getBoundingClientRect();
    const current = viewRef.current;
    return {
      x: clamp((event.clientX - rect.left - current.x) / current.scale, 0, width),
      y: clamp((event.clientY - rect.top - current.y) / current.scale, 0, height),
    };
  }

  function finishGesture() {
    const current = gestureRef.current;
    panRef.current = null;
    if (!current) return;
    updateGesture(null);
    const existing = annotationsRef.current;
    if (current.kind === 'stroke') {
      onCommit([
        ...existing,
        {
          id: crypto.randomUUID(),
          type: 'stroke',
          tool: current.tool,
          points: current.points,
          color: current.color,
          width: current.width,
        },
      ]);
      return;
    }
    if (current.kind === 'shape') {
      const dragged = Math.hypot(current.x2 - current.x1, current.y2 - current.y1);
      if (dragged < 4 / viewRef.current.scale) return;
      onCommit([
        ...existing,
        {
          id: crypto.randomUUID(),
          type: 'shape',
          kind: current.shape,
          x1: current.x1,
          y1: current.y1,
          x2: current.x2,
          y2: current.y2,
          color: current.color,
          width: current.width,
        },
      ]);
      return;
    }
    if (current.kind === 'place-text') {
      if (!current.moved) {
        const size = textSizeFor(width, sizeIndex);
        setEditing({
          id: crypto.randomUUID(),
          draft: '',
          fresh: true,
          checkpointed: true,
          x: clamp(current.x, 0, Math.max(0, width - size)),
          y: clamp(current.y, 0, Math.max(0, height - size * 1.3)),
          color: handColor,
          size,
          boxWidth: Math.round(width * 0.32),
          styleId: handStyleId,
          origin: 'student',
        });
      }
      return;
    }
    if (current.kind === 'erase') {
      if (current.ids.length === 0) return;
      const removed = new Set(current.ids);
      onCommit(existing.filter((annotation) => !removed.has(annotation.id)));
      return;
    }
    if (!current.moved) {
      const note = existing.find((annotation) => annotation.id === current.id);
      if (note?.type === 'text') {
        setEditing({
          id: note.id,
          draft: note.text,
          fresh: false,
          checkpointed: false,
          x: note.x,
          y: note.y,
          color: note.color,
          size: note.size,
          boxWidth: note.boxWidth ?? Math.round(width * 0.32),
          styleId: note.styleId,
          origin: note.origin,
        });
      }
      return;
    }
    onCommit(
      existing.map((annotation) =>
        annotation.id === current.id && annotation.type === 'text'
          ? { ...annotation, x: annotation.x + current.dx, y: annotation.y + current.dy }
          : annotation,
      ),
    );
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('button, input, textarea')) return;
    if (editingRef.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = imagePoint(event);
    const active = toolRef.current;
    if (active === 'pan') {
      userMoved.current = true;
      panRef.current = {
        sx: event.clientX,
        sy: event.clientY,
        vx: viewRef.current.x,
        vy: viewRef.current.y,
      };
      return;
    }
    if (active === 'pen' || active === 'highlight') {
      updateGesture({
        kind: 'stroke',
        tool: active,
        points: [point],
        color,
        width: strokeWidthFor(width, sizeIndex),
      });
      return;
    }
    if (active === 'underline' || active === 'circle' || active === 'arrow') {
      updateGesture({
        kind: 'shape',
        shape: active,
        x1: point.x,
        y1: point.y,
        x2: point.x,
        y2: point.y,
        color,
        width: strokeWidthFor(width, sizeIndex),
      });
      return;
    }
    if (active === 'eraser') {
      const hit = hitTest(annotationsRef.current, point, 22 / viewRef.current.scale);
      updateGesture({ kind: 'erase', ids: hit ? [hit.id] : [] });
      return;
    }
    const hit = hitTest(annotationsRef.current, point, 22 / viewRef.current.scale);
    if (hit?.type === 'text') {
      updateGesture({
        kind: 'move-text',
        id: hit.id,
        originX: point.x,
        originY: point.y,
        dx: 0,
        dy: 0,
        moved: false,
      });
      return;
    }
    updateGesture({
      kind: 'place-text',
      x: point.x,
      y: point.y,
      originX: point.x,
      originY: point.y,
      moved: false,
    });
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (panRef.current) {
      setView({
        scale: viewRef.current.scale,
        x: panRef.current.vx + (event.clientX - panRef.current.sx),
        y: panRef.current.vy + (event.clientY - panRef.current.sy),
      });
      return;
    }
    const current = gestureRef.current;
    if (!current) return;
    const point = imagePoint(event);
    if (current.kind === 'stroke') {
      const last = current.points[current.points.length - 1];
      if (last && Math.hypot(point.x - last.x, point.y - last.y) < 0.6) return;
      updateGesture({ ...current, points: [...current.points, point] });
      return;
    }
    if (current.kind === 'shape') {
      updateGesture({ ...current, x2: point.x, y2: point.y });
      return;
    }
    if (current.kind === 'place-text') {
      const dx = point.x - current.originX;
      const dy = point.y - current.originY;
      if (!current.moved && Math.hypot(dx, dy) > 3 / viewRef.current.scale) {
        updateGesture({ ...current, moved: true });
      }
      return;
    }
    if (current.kind === 'erase') {
      const removed = new Set(current.ids);
      const remaining = annotationsRef.current.filter((annotation) => !removed.has(annotation.id));
      const hit = hitTest(remaining, point, 22 / viewRef.current.scale);
      if (!hit || current.ids.includes(hit.id)) return;
      updateGesture({ ...current, ids: [...current.ids, hit.id] });
      return;
    }
    const dx = point.x - current.originX;
    const dy = point.y - current.originY;
    updateGesture({
      ...current,
      dx,
      dy,
      moved: current.moved || Math.hypot(dx, dy) > 3 / viewRef.current.scale,
    });
  }

  function commitEditing(nextDraft: string) {
    const current = editingRef.current;
    if (!current) return;
    const trimmed = nextDraft.trim();
    onDraftDirty(false);
    if (current.fresh) {
      if (trimmed) {
        onCommit([
          ...annotationsRef.current,
          {
            id: current.id,
            type: 'text',
            x: current.x,
            y: current.y,
            text: trimmed,
            color: current.color,
            size: current.size,
            boxWidth: current.boxWidth,
            origin: current.origin ?? 'student',
            styleId: current.styleId,
          },
        ]);
      }
    } else if (!trimmed && current.checkpointed) {
      onReplace(annotationsRef.current.filter((annotation) => annotation.id !== current.id));
    }
    setEditing(null);
  }

  function onDraftChange(value: string) {
    const current = editingRef.current;
    if (!current) return;
    if (current.fresh) {
      const next = { ...current, draft: value };
      editingRef.current = next;
      setEditing(next);
      onDraftDirty(value.trim().length > 0);
      return;
    }
    if (!current.checkpointed) onCheckpoint();
    const next = { ...current, draft: value, checkpointed: true };
    editingRef.current = next;
    setEditing(next);
    onReplace(
      annotationsRef.current.map((annotation) =>
        annotation.id === current.id && annotation.type === 'text' ? { ...annotation, text: value } : annotation,
      ),
    );
  }

  const visible = displayAnnotations(annotations, gesture);
  const editorStyle = editing
    ? {
        left: editing.x * view.scale + view.x,
        top: editing.y * view.scale + view.y,
        fontSize: editing.size * view.scale,
        color: editing.color,
        fontFamily: fontFamilyFor(editing.styleId),
        width: editing.boxWidth * view.scale,
      }
    : null;

  function zoomBy(factor: number) {
    userMoved.current = true;
    const nextScale = clamp(view.scale * factor, 0.15, 8);
    setView(zoomAt(view, size.w / 2, size.h / 2, nextScale));
  }

  return (
    <div
      ref={wrapRef}
      className="stage-wrap"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishGesture}
      onPointerCancel={finishGesture}
    >
      {image && size.w > 0 && (
        <Stage width={size.w} height={size.h} scaleX={view.scale} scaleY={view.scale} x={view.x} y={view.y} listening={false}>
          <Layer>
            <KonvaImage
              image={image}
              width={width}
              height={height}
              shadowColor="#3a2c17"
              shadowBlur={36 / view.scale}
              shadowOffsetY={10 / view.scale}
              shadowOpacity={0.14}
            />
            {detected?.map((block) => (
              <Rect
                key={block.id}
                x={block.x - 4}
                y={block.y - 4}
                width={block.w + 8}
                height={block.h + 8}
                cornerRadius={6}
                stroke="#2447c6"
                strokeWidth={Math.max(1.5, 1.5 / view.scale)}
                dash={[8 / view.scale, 6 / view.scale]}
                opacity={0.6}
                listening={false}
              />
            ))}
            {visible.map((annotation) => (
              <AnnotationShape
                key={`${annotation.id}-${fontEpoch}`}
                annotation={annotation}
                hidden={editing?.id === annotation.id}
              />
            ))}
            {previews.map((annotation) => (
              <Group
                key={`${annotation.id}-${fontEpoch}`}
                opacity={focusId === null || focusId === annotation.id ? 0.85 : 0.32}
                listening={false}
              >
                <AnnotationShape annotation={annotation} hidden={false} />
              </Group>
            ))}
          </Layer>
        </Stage>
      )}
      {editorStyle && editing && (
        <input
          className="text-editor"
          style={editorStyle}
          value={editing.draft}
          placeholder="Write a note"
          aria-label="Note text"
          autoFocus
          onChange={(event) => onDraftChange(event.target.value)}
          onBlur={() => commitEditing(editing.draft)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
        />
      )}
      <div className="zoom-pill">
        <button type="button" onClick={() => zoomBy(1 / 1.15)} aria-label="Zoom out">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 12h12" />
          </svg>
        </button>
        <button
          type="button"
          className="zoom-value"
          title="Fit slide"
          onClick={() => {
            userMoved.current = false;
            setView(fitView(size.w, size.h, width, height));
          }}
        >
          {Math.round(view.scale * 100)}%
        </button>
        <button type="button" onClick={() => zoomBy(1.15)} aria-label="Zoom in">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 12h12M12 6v12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function displayAnnotations(annotations: Annotation[], gesture: Gesture | null): Annotation[] {
  let list = annotations;
  if (gesture?.kind === 'erase') {
    const removed = new Set(gesture.ids);
    list = list.filter((annotation) => !removed.has(annotation.id));
  }
  if (gesture?.kind === 'move-text') {
    list = list.map((annotation) =>
      annotation.id === gesture.id && annotation.type === 'text'
        ? { ...annotation, x: annotation.x + gesture.dx, y: annotation.y + gesture.dy }
        : annotation,
    );
  }
  if (gesture?.kind === 'stroke') {
    list = [
      ...list,
      {
        id: 'draft-stroke',
        type: 'stroke',
        tool: gesture.tool,
        points: gesture.points,
        color: gesture.color,
        width: gesture.width,
      },
    ];
  }
  if (gesture?.kind === 'shape') {
    list = [
      ...list,
      {
        id: 'draft-shape',
        type: 'shape',
        kind: gesture.shape,
        x1: gesture.x1,
        y1: gesture.y1,
        x2: gesture.x2,
        y2: gesture.y2,
        color: gesture.color,
        width: gesture.width,
      },
    ];
  }
  return list;
}

function AnnotationShape({ annotation, hidden }: { annotation: Annotation; hidden: boolean }) {
  if (hidden) return null;
  if (annotation.type === 'stroke') {
    const points = strokeOutline(annotation.points, annotation.width, annotation.tool === 'highlight');
    if (points.length < 4) return null;
    return (
      <Line
        points={points}
        closed
        fill={annotation.color}
        opacity={annotation.tool === 'highlight' ? 0.45 : 1}
        listening={false}
      />
    );
  }
  if (annotation.type === 'text') {
    if (!annotation.text) return null;
    const link = connectorFor(annotation);
    const mark = annotation.mark;
    return (
      <Group listening={false}>
        {mark && (
          <Rect
            x={mark.x - mark.h * 0.15}
            y={mark.y + mark.h * 0.08}
            width={mark.w + mark.h * 0.3}
            height={mark.h * 0.92}
            cornerRadius={mark.h * 0.3}
            fill={MARK_COLOR}
            globalCompositeOperation="multiply"
            listening={false}
          />
        )}
        {link && (
          <>
            <Line
              points={connectorPoints(link)}
              stroke={annotation.color}
              strokeWidth={link.width}
              lineCap="round"
              lineJoin="round"
              listening={false}
            />
            <Line
              points={[link.head[0].x, link.head[0].y, link.end.x, link.end.y, link.head[1].x, link.head[1].y]}
              stroke={annotation.color}
              strokeWidth={link.width}
              lineCap="round"
              lineJoin="round"
              listening={false}
            />
          </>
        )}
        <Text
          x={annotation.x}
          y={annotation.y}
          text={annotation.text}
          fontSize={annotation.size}
          fontFamily={fontFamilyFor(annotation.styleId)}
          lineHeight={1.35}
          fill={annotation.color}
          width={annotation.boxWidth}
          listening={false}
        />
      </Group>
    );
  }
  if (annotation.kind === 'circle') {
    return (
      <Ellipse
        x={(annotation.x1 + annotation.x2) / 2}
        y={(annotation.y1 + annotation.y2) / 2}
        radiusX={Math.max(1, Math.abs(annotation.x2 - annotation.x1) / 2)}
        radiusY={Math.max(1, Math.abs(annotation.y2 - annotation.y1) / 2)}
        stroke={annotation.color}
        strokeWidth={annotation.width}
        listening={false}
      />
    );
  }
  if (annotation.kind === 'underline') {
    return (
      <Line
        points={[annotation.x1, annotation.y1, annotation.x2, annotation.y2]}
        stroke={annotation.color}
        strokeWidth={annotation.width}
        lineCap="round"
        listening={false}
      />
    );
  }
  const { endX, endY, headPoints } = arrowGeometry(
    annotation.x1,
    annotation.y1,
    annotation.x2,
    annotation.y2,
    annotation.width,
  );
  return (
    <Group listening={false}>
      <Line
        points={[annotation.x1, annotation.y1, endX, endY]}
        stroke={annotation.color}
        strokeWidth={annotation.width}
        lineCap="round"
        listening={false}
      />
      <Line
        points={headPoints.flatMap(([x, y]) => [x, y])}
        closed
        fill={annotation.color}
        listening={false}
      />
    </Group>
  );
}
