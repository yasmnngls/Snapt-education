import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Icon from '../components/Icon';
import SaveStatus from '../components/SaveStatus';
import ToolIcon from '../components/ToolIcon';
import { db } from '../db';
import { useAutosave } from '../editor/autosave';
import EditorSidebar, { slideTitle } from '../editor/EditorSidebar';
import { useAnnotationHistory } from '../editor/history';
import SlideStage from '../editor/SlideStage';
import { COLORS, SIZE_OPTIONS, type Tool } from '../editor/tools';
import { useSheet, useSheetLayout } from '../editor/useSheet';
import { downloadBlob, renderSlidePng, safeName } from '../export/exportSlide';
import ChatPanel, { type ChatMessage } from '../chat/ChatPanel';
import { assist, type ChatDraft } from '../chat/assist';
import { inkColorFromSample } from '../hand/ink';
import { loadHandProfile, saveHandProfile } from '../hand/profile';
import { handStyle } from '../hand/styles';
import ReviewPanel, { type PanelTab } from '../read/ReviewPanel';
import { recognizeSlide } from '../read/ocr';
import { draftToPreview, noteFromDraft, suggestNotes, type NoteDraft } from '../read/suggest';
import type {
  ClassRecord,
  DetectedBlock,
  HandProfile,
  LectureRecord,
  SlideReading,
  SlideRecord,
  TextAnnotation,
} from '../types';

const TOOLS: { id: Tool; label: string; shortcut: string }[] = [
  { id: 'pan', label: 'Move', shortcut: 'M' },
  { id: 'text', label: 'Text', shortcut: 'T' },
  { id: 'pen', label: 'Pen', shortcut: 'P' },
  { id: 'highlight', label: 'Highlight', shortcut: 'H' },
  { id: 'underline', label: 'Underline', shortcut: 'U' },
  { id: 'circle', label: 'Circle', shortcut: 'C' },
  { id: 'arrow', label: 'Arrow', shortcut: 'A' },
  { id: 'eraser', label: 'Erase', shortcut: 'E' },
];

export default function EditorPage() {
  const { slideId = '' } = useParams();
  const [slide, setSlide] = useState<SlideRecord | null | undefined>(undefined);
  const [lecture, setLecture] = useState<LectureRecord | null>(null);
  const [course, setCourse] = useState<ClassRecord | null>(null);

  useEffect(() => {
    let cancelled = false;
    db.slides.get(slideId).then(async (found) => {
      if (cancelled) return;
      setSlide(found ?? null);
      if (!found) return;
      const parent = (await db.lectures.get(found.lectureId)) ?? null;
      if (cancelled) return;
      setLecture(parent);
      if (parent) setCourse((await db.classes.get(parent.classId)) ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [slideId]);

  if (slide === undefined) return <p className="loading">Opening slide…</p>;
  if (!slide) {
    return (
      <main className="page">
        <p className="lead">This slide is not on this device.</p>
        <Link to="/">Back to classes</Link>
      </main>
    );
  }

  return <EditorWorkspace key={slide.id} slide={slide} lecture={lecture} course={course} />;
}

function EditorWorkspace({
  slide,
  lecture,
  course,
}: {
  slide: SlideRecord;
  lecture: LectureRecord | null;
  course: ClassRecord | null;
}) {
  const history = useAnnotationHistory(slide.annotations);
  const { status, error } = useAutosave(slide.id, history.annotations);
  const [tool, setTool] = useState<Tool>('text');
  const [color, setColor] = useState<string>(COLORS[0].value);
  const [sizeIndex, setSizeIndex] = useState(1);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [draftDirty, setDraftDirty] = useState(false);
  const [siblings, setSiblings] = useState<SlideRecord[]>([]);
  const [profile, setProfile] = useState<HandProfile | null>(null);
  const [sampleUrl, setSampleUrl] = useState<string | null>(null);
  const [reading, setReading] = useState<SlideReading | null>(slide.reading ?? null);
  const [tab, setTab] = useState<PanelTab>('suggestions');
  const [focusId, setFocusId] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [draftEdits, setDraftEdits] = useState<Record<string, string>>({});
  const [chatBusy, setChatBusy] = useState(false);
  const [chatDraft, setChatDraft] = useState<ChatDraft | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'snapt',
      text: 'Tell me a note and I’ll put it beside the right part of the slide. Click OK to keep it.',
    },
  ]);
  const autoRead = useRef(false);
  const readingJob = useRef<Promise<DetectedBlock[] | null> | null>(null);
  const studioRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const sheetActive = useSheetLayout();
  const sheet = useSheet(sheetActive);

  useEffect(() => {
    const dock = dockRef.current;
    const studio = studioRef.current;
    if (!dock || !studio) return;
    const observer = new ResizeObserver(() => studio.style.setProperty('--dock-h', `${dock.offsetHeight}px`));
    observer.observe(dock);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (sheetActive && chatDraft) sheet.setSnap('peek');
  }, [chatDraft !== null, sheetActive]);

  const style = handStyle(profile?.styleId);
  const inkColor = profile?.inkFromSample ? profile.inkColor : style.ink;

  useEffect(() => {
    let cancelled = false;
    loadHandProfile()
      .then((loaded) => {
        if (!cancelled) setProfile(loaded);
      })
      .catch(() => {
        if (!cancelled) setReadError('Could not open your handwriting style on this device.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!profile?.sampleBlob) {
      setSampleUrl(null);
      return;
    }
    const url = URL.createObjectURL(profile.sampleBlob);
    setSampleUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [profile?.sampleBlob]);

  useEffect(() => {
    let cancelled = false;
    db.slides
      .where('lectureId')
      .equals(slide.lectureId)
      .sortBy('order')
      .then((rows) => {
        if (!cancelled) setSiblings(rows);
      });
    return () => {
      cancelled = true;
    };
  }, [slide.lectureId]);

  useEffect(() => {
    const url = URL.createObjectURL(slide.imageBlob);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [slide]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const tag = (event.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) history.redo();
        else history.undo();
        return;
      }
      if (meta && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        history.redo();
        return;
      }
      if (meta) return;
      const next = TOOLS.find((item) => item.shortcut.toLowerCase() === event.key.toLowerCase());
      if (next) setTool(next.id);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [history]);

  const textNotes = history.annotations.filter((annotation): annotation is TextAnnotation => annotation.type === 'text');
  const suggested = textNotes.filter((note) => note.origin === 'suggested');
  const studentNotes = textNotes.filter((note) => note.origin !== 'suggested');
  const slideIndex = Math.max(0, siblings.findIndex((row) => row.id === slide.id));
  const title = slideTitle({ ...slide, reading: reading ?? undefined }, slideIndex);

  const drafts = useMemo(() => {
    if (!reading) return [];
    const placedBlockIds = suggested.flatMap((note) => (note.sourceBlockId ? [note.sourceBlockId] : []));
    const placedText = new Set(suggested.map((note) => note.text.trim().toLowerCase()));
    return suggestNotes({
      blocks: reading.blocks,
      dismissedBlockIds: reading.dismissedBlockIds,
      placedBlockIds,
      taken: textNotes.map((note) => ({ x: note.x, y: note.y })),
      slideWidth: slide.width,
      slideHeight: slide.height,
    })
      .filter((draft) => !placedText.has(draft.text.trim().toLowerCase()))
      .map((draft) => ({ ...draft, text: draftEdits[draft.id] ?? draft.text }));
  }, [draftEdits, history.annotations, reading, slide.height, slide.width]);

  const previews = useMemo(
    () =>
      tab === 'suggestions'
        ? drafts
            .filter((draft) => draft.text.trim())
            .map((draft) => draftToPreview(draft, slide.width, style.id, inkColor))
        : [],
    [drafts, inkColor, slide.width, style.id, tab],
  );

  const chatPreview = useMemo(() => {
    if (!chatDraft?.text.trim()) return null;
    return {
      ...draftToPreview(chatNoteDraft(chatDraft), slide.width, style.id, inkColor),
      id: 'chat-draft',
      origin: 'student' as const,
    };
  }, [chatDraft, inkColor, slide.width, style.id]);

  async function readSlide(): Promise<DetectedBlock[] | null> {
    if (readingJob.current) return readingJob.current;
    const job = (async () => {
      setReadError(null);
      setProgress(0);
      try {
        const blocks = await recognizeSlide(slide.imageBlob, slide.width, slide.height, setProgress);
        const next: SlideReading = { blocks, dismissedBlockIds: [], readAt: Date.now() };
        setReading(next);
        setDraftEdits({});
        setSiblings((rows) => rows.map((row) => (row.id === slide.id ? { ...row, reading: next } : row)));
        await db.slides.update(slide.id, { reading: next, updatedAt: Date.now() });
        return blocks;
      } catch (err) {
        setReadError(err instanceof Error ? err.message : 'Snapt could not read this slide.');
        return null;
      } finally {
        setProgress(null);
      }
    })();
    readingJob.current = job;
    try {
      return await job;
    } finally {
      readingJob.current = null;
    }
  }

  useEffect(() => {
    if (autoRead.current || slide.reading) return;
    autoRead.current = true;
    void readSlide();
  }, [slide.reading]);

  function chatNoteDraft(draft: ChatDraft): NoteDraft {
    return {
      id: 'chat',
      blockId: draft.blockId ?? 'chat',
      text: draft.text.trim(),
      x: draft.x,
      y: draft.y,
      reason: '',
      quote: draft.quote ?? '',
      anchor: draft.anchor,
    };
  }

  function commitChat(draft: ChatDraft) {
    if (!draft.text.trim()) return;
    const note = { ...noteFromDraft(chatNoteDraft(draft), slide.width, style.id, inkColor), origin: 'student' as const };
    history.commit([...history.annotations, note]);
  }

  function say(text: string) {
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'snapt', text }]);
  }

  async function onChatSend(message: string) {
    const text = message.trim();
    if (!text || chatBusy) return;
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'user', text }]);
    setChatBusy(true);
    try {
      const blocks = reading ? reading.blocks : ((await readSlide()) ?? []);
      const taken = [...textNotes, ...drafts].map((note) => ({ x: note.x, y: note.y }));
      const result = assist({
        message: text,
        draft: chatDraft,
        blocks,
        taken,
        slideWidth: slide.width,
        slideHeight: slide.height,
      });
      if (result.confirm && chatDraft) commitChat(chatDraft);
      setChatDraft(result.draft);
      say(result.say);
    } finally {
      setChatBusy(false);
    }
  }

  function onChatOk() {
    if (!chatDraft?.text.trim()) return;
    commitChat(chatDraft);
    setChatDraft(null);
    setTab('mine');
    say('Added to your notes. Drag it on the slide to move it, or tell me the next one.');
  }

  function onChatDiscard() {
    setChatDraft(null);
    say('Cleared. Tell me the next note when you’re ready.');
  }

  function placeDrafts(list: NoteDraft[]) {
    const notes = list
      .filter((draft) => draft.text.trim())
      .map((draft) => noteFromDraft(draft, slide.width, style.id, inkColor));
    if (notes.length === 0) return;
    history.commit([...history.annotations, ...notes]);
  }

  async function saveReading(next: SlideReading) {
    setReading(next);
    await db.slides.update(slide.id, { reading: next, updatedAt: Date.now() });
  }

  async function dismiss(blockId: string) {
    if (!reading) return;
    await saveReading({ ...reading, dismissedBlockIds: [...reading.dismissedBlockIds, blockId] });
  }

  function unplace(note: TextAnnotation) {
    if (note.sourceBlockId) {
      setDraftEdits((current) => ({ ...current, [`suggest-${note.sourceBlockId}`]: note.text }));
    }
    history.commit(history.annotations.filter((annotation) => annotation.id !== note.id));
  }

  function remove(note: TextAnnotation) {
    history.commit(history.annotations.filter((annotation) => annotation.id !== note.id));
    if (note.origin === 'suggested' && note.sourceBlockId) void dismiss(note.sourceBlockId);
  }

  function editPlaced(id: string, text: string) {
    history.commit(
      history.annotations.map((annotation) =>
        annotation.id === id && annotation.type === 'text' ? { ...annotation, text } : annotation,
      ),
    );
  }

  async function onSample(file: File) {
    if (!profile) return;
    setReadError(null);
    try {
      const sampled = await inkColorFromSample(file);
      setProfile(await saveHandProfile({ ...profile, sampleBlob: file, inkColor: sampled, inkFromSample: true }));
    } catch (err) {
      setReadError(err instanceof Error ? err.message : 'Could not read that handwriting sample.');
    }
  }

  async function onExport() {
    setExporting(true);
    setExportError(null);
    try {
      const blob = await renderSlidePng({
        imageBlob: slide.imageBlob,
        width: slide.width,
        height: slide.height,
        annotations: history.annotations,
      });
      downloadBlob(blob, `${safeName(lecture?.title ?? 'slide')}-${slideIndex + 1}.png`);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Could not export this slide.');
    } finally {
      setExporting(false);
    }
  }

  const prev = siblings[slideIndex - 1];
  const next = siblings[slideIndex + 1];

  function onTab(nextTab: PanelTab) {
    setTab(nextTab);
    if (sheetActive && sheet.snap === 'peek') sheet.setSnap('half');
  }

  const historyButtons = (
    <>
      <button type="button" className="icon-btn" onClick={history.undo} disabled={!history.canUndo} aria-label="Undo">
        <ToolIcon name="undo" />
      </button>
      <button type="button" className="icon-btn" onClick={history.redo} disabled={!history.canRedo} aria-label="Redo">
        <ToolIcon name="redo" />
      </button>
    </>
  );

  return (
    <div className="studio" ref={studioRef} data-reserve={sheet.reserve}>
      <EditorSidebar course={course} lecture={lecture} slides={siblings} activeId={slide.id} />

      <section className="studio-main">
        <header className="studio-head">
          {lecture && (
            <Link to={`/lectures/${lecture.id}`} className="icon-btn head-back" aria-label={`Back to ${lecture.title}`}>
              <Icon name="back" />
            </Link>
          )}
          <nav className="head-crumbs" aria-label="Location">
            {lecture && (
              <>
                <Link className="crumb-lecture" to={`/lectures/${lecture.id}`}>
                  {lecture.title}
                </Link>
                <span aria-hidden="true">›</span>
              </>
            )}
            <h1>{title}</h1>
          </nav>
          <div className="head-actions">
            <SaveStatus status={draftDirty && status === 'saved' ? 'unsaved' : status} />
            {siblings.length > 1 && (
              <div className="head-pager" aria-label="Slides">
                {prev ? (
                  <Link className="icon-btn" to={`/lectures/${slide.lectureId}/slides/${prev.id}`} aria-label="Previous slide">
                    <Icon name="back" />
                  </Link>
                ) : (
                  <span className="icon-btn is-off" aria-hidden="true">
                    <Icon name="back" />
                  </span>
                )}
                <span className="pager-count">
                  {slideIndex + 1}
                  <span aria-hidden="true">/</span>
                  <span className="sr-only"> of </span>
                  {siblings.length}
                </span>
                {next ? (
                  <Link className="icon-btn pager-next" to={`/lectures/${slide.lectureId}/slides/${next.id}`} aria-label="Next slide">
                    <Icon name="back" />
                  </Link>
                ) : (
                  <span className="icon-btn pager-next is-off" aria-hidden="true">
                    <Icon name="back" />
                  </span>
                )}
              </div>
            )}
            <div className="head-history">{historyButtons}</div>
            <button
              type="button"
              className="btn-primary head-export"
              onClick={() => void onExport()}
              disabled={exporting || !imageUrl}
              aria-label={exporting ? 'Exporting' : 'Export slide as PNG'}
            >
              <Icon name="upload" />
              <span>{exporting ? 'Exporting…' : 'Export'}</span>
            </button>
          </div>
        </header>

        <div className="studio-toolbar" role="toolbar" aria-label="Annotation tools">
          <div className="toolbar-group toolbar-history">{historyButtons}</div>
          <span className="toolbar-divider toolbar-history" aria-hidden="true" />
          <div className="toolbar-group">
            {TOOLS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={tool === item.id ? 'tool-btn active' : 'tool-btn'}
                aria-pressed={tool === item.id}
                aria-label={item.label}
                title={`${item.label} (${item.shortcut})`}
                onClick={() => setTool(item.id)}
              >
                <ToolIcon name={item.id} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
          <span className="toolbar-divider" aria-hidden="true" />
          <div className="toolbar-group" role="radiogroup" aria-label="Color">
            {COLORS.map((swatch) => (
              <button
                key={swatch.id}
                type="button"
                className={color === swatch.value ? 'swatch selected' : 'swatch'}
                style={{ background: swatch.value }}
                aria-label={swatch.label}
                aria-pressed={color === swatch.value}
                onClick={() => setColor(swatch.value)}
              />
            ))}
          </div>
          <span className="toolbar-divider" aria-hidden="true" />
          <div className="toolbar-group" role="radiogroup" aria-label="Size">
            {SIZE_OPTIONS.map((option, index) => (
              <button
                key={option.id}
                type="button"
                className={sizeIndex === index ? 'size-btn active' : 'size-btn'}
                aria-pressed={sizeIndex === index}
                onClick={() => setSizeIndex(index)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {(error || exportError) && (
          <p className="alert studio-alert" role="alert">
            {error || exportError}
          </p>
        )}

        {imageUrl && (
          <SlideStage
            imageUrl={imageUrl}
            width={slide.width}
            height={slide.height}
            annotations={history.annotations}
            tool={tool}
            color={color}
            sizeIndex={sizeIndex}
            handStyleId={style.id}
            handColor={inkColor}
            detected={tab === 'text' ? (reading?.blocks ?? null) : null}
            previews={[...previews, ...(chatPreview ? [chatPreview] : [])]}
            focusId={chatPreview ? 'chat-draft' : focusId}
            onCommit={history.commit}
            onReplace={history.replace}
            onCheckpoint={history.checkpoint}
            onDraftDirty={setDraftDirty}
          />
        )}
      </section>

      <ReviewPanel
        tab={tab}
        onTab={onTab}
        reading={reading}
        progress={progress}
        error={readError}
        drafts={drafts}
        suggested={suggested}
        studentNotes={studentNotes}
        styleId={style.id}
        inkColor={inkColor}
        inkFromSample={!!profile?.inkFromSample}
        sampleUrl={sampleUrl}
        onFocus={setFocusId}
        onDraftText={(id, text) => setDraftEdits((current) => ({ ...current, [id]: text }))}
        onPlace={(draft) => placeDrafts([draft])}
        onPlaceAll={() => placeDrafts(drafts)}
        onDismiss={(draft) => void dismiss(draft.blockId)}
        onUnplace={unplace}
        onRemove={remove}
        onEditPlaced={editPlaced}
        onReread={() => void readSlide()}
        onSample={(file) => void onSample(file)}
        sheet={{
          active: sheetActive,
          snap: sheet.snap,
          ref: sheet.sheetRef,
          headProps: sheet.headProps,
          onHandle: sheet.cycle,
        }}
      />
      <ChatPanel
        dockRef={dockRef}
        messages={messages}
        draft={chatDraft}
        styleId={style.id}
        inkColor={inkColor}
        busy={chatBusy}
        onSend={(message) => void onChatSend(message)}
        onDraftText={(text) => setChatDraft((current) => (current ? { ...current, text } : current))}
        onOk={onChatOk}
        onDiscard={onChatDiscard}
      />
    </div>
  );
}
