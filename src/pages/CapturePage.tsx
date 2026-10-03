import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import TopBar from '../components/TopBar';
import { clampCrop, fileToImage, prepareSlideImage, renderRotatedPreview } from '../capture/prepareSlide';
import { db, nextSlideOrder } from '../db';
import type { LectureRecord, NormCrop, Rotation, SlideRecord } from '../types';

const HANDLES = ['nw', 'ne', 'sw', 'se'] as const;

export default function CapturePage() {
  const { lectureId = '' } = useParams();
  const navigate = useNavigate();
  const [lecture, setLecture] = useState<LectureRecord | null | undefined>(undefined);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rotation, setRotation] = useState<Rotation>(0);
  const [crop, setCrop] = useState<NormCrop>({ x: 0.06, y: 0.06, w: 0.88, h: 0.88 });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const previewRef = useRef<string | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    db.lectures
      .get(lectureId)
      .then((found) => setLecture(found ?? null))
      .catch(() => setError('Could not open this lecture.'));
  }, [lectureId]);

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  useEffect(() => {
    if (!image) return;
    let cancelled = false;
    renderRotatedPreview(image, rotation)
      .then((blob) => {
        if (cancelled) return;
        if (previewRef.current) URL.revokeObjectURL(previewRef.current);
        const url = URL.createObjectURL(blob);
        previewRef.current = url;
        setPreviewUrl(url);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not preview that image.');
      });
    return () => {
      cancelled = true;
    };
  }, [image, rotation]);

  async function takeFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Use a PNG or JPEG.');
      return;
    }
    setError(null);
    try {
      const next = await fileToImage(file);
      setImage(next);
      setRotation(0);
      setCrop({ x: 0.06, y: 0.06, w: 0.88, h: 0.88 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that image. Use a PNG or JPEG.');
    }
  }

  function startDrag(event: ReactPointerEvent, mode: 'move' | (typeof HANDLES)[number]) {
    event.preventDefault();
    event.stopPropagation();
    const frame = frameRef.current;
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    const start = { ...crop, px: event.clientX, py: event.clientY };
    setDragging(true);
    function move(next: PointerEvent) {
      const dx = (next.clientX - start.px) / rect.width;
      const dy = (next.clientY - start.py) / rect.height;
      setCrop(clampCrop(dragCrop(start, mode, dx, dy)));
    }
    function up() {
      setDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  async function onConfirm() {
    if (!image || saving) return;
    setSaving(true);
    setError(null);
    try {
      const prepared = await prepareSlideImage(image, rotation, crop);
      const slide: SlideRecord = {
        id: crypto.randomUUID(),
        lectureId,
        order: await nextSlideOrder(lectureId),
        imageBlob: prepared.blob,
        width: prepared.width,
        height: prepared.height,
        annotations: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await db.slides.add(slide);
      navigate(`/lectures/${lectureId}/slides/${slide.id}`);
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : 'Could not save the slide image.');
    }
  }

  if (lecture === undefined) return <p className="loading">Loading lecture…</p>;
  if (!lecture) {
    return (
      <main className="page">
        <p className="lead">This lecture is not on this device.</p>
        <Link to="/">Back to classes</Link>
      </main>
    );
  }

  const rotated =
    image && rotation % 180 !== 0
      ? { w: image.naturalHeight, h: image.naturalWidth }
      : { w: image?.naturalWidth ?? 1, h: image?.naturalHeight ?? 1 };

  return (
    <div className={image ? 'capture capture-dark' : 'shell'}>
      <TopBar
        dark={Boolean(image)}
        crumbs={[{ label: lecture.title, to: `/lectures/${lecture.id}` }, { label: 'New slide' }]}
      />
      {!image ? (
        <main className="page">
          <p className="lead">Choose a photo or screenshot.</p>
          <p className="sub">Snapt reads it next and suggests notes for you to approve.</p>
          <label
            className="dropzone"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              void takeFile(event.dataTransfer.files[0]);
            }}
          >
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                void takeFile(event.target.files?.[0]);
                event.target.value = '';
              }}
            />
            Drop an image here, or choose a file
          </label>
          {error && (
            <p className="alert" role="alert">
              {error}
            </p>
          )}
        </main>
      ) : (
        <>
          <div className="crop-frame">
            <div
              ref={frameRef}
              className="crop-image-wrap"
              style={{ aspectRatio: `${rotated.w} / ${rotated.h}`, ['--slide-ratio' as string]: String(rotated.w / rotated.h) }}
            >
              {previewUrl && <img src={previewUrl} alt="Slide to crop" draggable={false} />}
              <div
                className="crop-rect"
                style={{
                  left: `${crop.x * 100}%`,
                  top: `${crop.y * 100}%`,
                  width: `${crop.w * 100}%`,
                  height: `${crop.h * 100}%`,
                }}
                onPointerDown={(event) => startDrag(event, 'move')}
              >
                {HANDLES.map((handle) => (
                  <button
                    key={handle}
                    type="button"
                    className={`crop-handle handle-${handle}`}
                    aria-label={`Crop ${handle}`}
                    onPointerDown={(event) => startDrag(event, handle)}
                  />
                ))}
              </div>
            </div>
          </div>
          <footer className="capture-bar">
            {error && (
              <p className="alert" role="alert">
                {error}
              </p>
            )}
            <button
              type="button"
              className="text-button light"
              onClick={() => setRotation((current) => ((current + 90) % 360) as Rotation)}
              disabled={saving || dragging}
            >
              Rotate
            </button>
            <button
              type="button"
              className="text-button light"
              onClick={() => setCrop({ x: 0, y: 0, w: 1, h: 1 })}
              disabled={saving}
            >
              Use the whole slide
            </button>
            <button type="button" onClick={() => void onConfirm()} disabled={saving || !previewUrl}>
              {saving ? 'Saving slide…' : 'Read this slide'}
            </button>
          </footer>
        </>
      )}
    </div>
  );
}

function dragCrop(
  start: NormCrop & { px: number; py: number },
  mode: 'move' | (typeof HANDLES)[number],
  dx: number,
  dy: number,
): NormCrop {
  let { x, y, w, h } = start;
  if (mode === 'move') return { x: x + dx, y: y + dy, w, h };
  if (mode.includes('w')) {
    x += dx;
    w -= dx;
  }
  if (mode.includes('e')) w += dx;
  if (mode.includes('n')) {
    y += dy;
    h -= dy;
  }
  if (mode.includes('s')) h += dy;
  return { x, y, w, h };
}
