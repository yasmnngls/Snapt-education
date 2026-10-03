import { useRef, type ChangeEvent, type CSSProperties, type HTMLAttributes, type Ref } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import type { Snap } from '../editor/useSheet';
import { fontFamilyFor, handStyle } from '../hand/styles';
import type { NoteDraft } from '../read/suggest';
import type { SlideReading, TextAnnotation } from '../types';

export type PanelTab = 'suggestions' | 'mine' | 'text';

type Item =
  | { kind: 'draft'; id: string; y: number; draft: NoteDraft }
  | { kind: 'placed'; id: string; y: number; note: TextAnnotation };

function clip(value: string, max: number) {
  const text = value.replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export default function ReviewPanel({
  tab,
  onTab,
  reading,
  progress,
  error,
  drafts,
  suggested,
  studentNotes,
  styleId,
  inkColor,
  inkFromSample,
  sampleUrl,
  onFocus,
  onDraftText,
  onPlace,
  onPlaceAll,
  onDismiss,
  onUnplace,
  onRemove,
  onEditPlaced,
  onReread,
  onSample,
  sheet,
}: {
  tab: PanelTab;
  onTab: (tab: PanelTab) => void;
  reading: SlideReading | null;
  progress: number | null;
  error: string | null;
  drafts: NoteDraft[];
  suggested: TextAnnotation[];
  studentNotes: TextAnnotation[];
  styleId: string;
  inkColor: string;
  inkFromSample: boolean;
  sampleUrl: string | null;
  onFocus: (id: string | null) => void;
  onDraftText: (id: string, text: string) => void;
  onPlace: (draft: NoteDraft) => void;
  onPlaceAll: () => void;
  onDismiss: (draft: NoteDraft) => void;
  onUnplace: (note: TextAnnotation) => void;
  onRemove: (note: TextAnnotation) => void;
  onEditPlaced: (id: string, text: string) => void;
  onReread: () => void;
  onSample: (file: File) => void;
  sheet: {
    active: boolean;
    snap: Snap;
    ref: Ref<HTMLElement>;
    headProps: HTMLAttributes<HTMLDivElement> & { ref: Ref<HTMLDivElement> };
    onHandle: () => void;
  };
}) {
  const style = handStyle(styleId);
  const handFont = fontFamilyFor(styleId);
  const blocks = reading?.blocks ?? [];
  const quoteFor = (blockId?: string) => blocks.find((block) => block.id === blockId)?.text;

  const items: Item[] = [
    ...suggested.map((note) => ({ kind: 'placed' as const, id: note.id, y: note.y, note })),
    ...drafts.map((draft) => ({ kind: 'draft' as const, id: draft.id, y: draft.y, draft })),
  ].sort((a, b) => a.y - b.y);

  const tabs: { id: PanelTab; label: string; count?: number }[] = [
    { id: 'suggestions', label: 'Suggestions', count: items.length },
    { id: 'mine', label: 'My notes', count: studentNotes.length },
    { id: 'text', label: 'Slide text' },
  ];

  return (
    <aside className="studio-panel" aria-label="Notes" ref={sheet.ref} data-snap={sheet.snap}>
      <div className="sheet-head" {...sheet.headProps}>
        <button
          type="button"
          className="sheet-handle"
          aria-label={sheet.snap === 'full' ? 'Collapse notes' : 'Expand notes'}
          aria-expanded={sheet.snap !== 'peek'}
          aria-controls="panel-body"
          onClick={sheet.onHandle}
        />
        <div className="panel-tabs" role="tablist" aria-label="Notes">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`tab-${item.id}`}
              aria-selected={tab === item.id}
              aria-controls="panel-body"
              className={tab === item.id ? 'panel-tab active' : 'panel-tab'}
              onClick={() => onTab(item.id)}
            >
              {item.label}
              {item.count ? <span className="tab-count">{item.count}</span> : null}
            </button>
          ))}
        </div>
      </div>

      <div
        className="panel-body"
        id="panel-body"
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        inert={sheet.active && sheet.snap === 'peek'}
      >
        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}

        {progress !== null && tab !== 'mine' && (
          <div className="reading-card" role="status">
            <span className="reading-spark">
              <Icon name="sparkle" />
            </span>
            <div>
              <strong>Reading this slide</strong>
              <span>Finding key terms and where notes fit · {Math.round(progress * 100)}%</span>
              <div className="progress-track">
                <i style={{ transform: `scaleX(${Math.max(0.04, progress)})` }} />
              </div>
            </div>
          </div>
        )}

        {tab === 'suggestions' && progress === null && (
          <>
            <div className="panel-intro">
              <h2>{items.length > 0 ? `Snapt found ${items.length} ${items.length === 1 ? 'idea' : 'ideas'}` : 'Suggested notes'}</h2>
              <p>Tick a note to write it on the slide in your handwriting. Edit the wording first if you like.</p>
            </div>
            {reading && items.length === 0 && (
              <p className="panel-empty">
                Nothing new to suggest here. Ask Snapt below, or pick Text in the toolbar and tap the slide.
              </p>
            )}
            {items.length > 0 && (
              <ul className="note-list">
                {items.map((item, index) =>
                  item.kind === 'draft' ? (
                    <NoteCard
                      key={item.id}
                      index={index}
                      on={false}
                      label="Suggested"
                      quote={item.draft.quote}
                      fontFamily={handFont}
                      ink={inkColor}
                      value={item.draft.text}
                      onChange={(text) => onDraftText(item.draft.id, text)}
                      onToggle={() => onPlace(item.draft)}
                      onRemove={() => onDismiss(item.draft)}
                      removeLabel="Dismiss suggestion"
                      onFocus={() => onFocus(item.draft.id)}
                      onBlur={() => onFocus(null)}
                      toggleDisabled={!item.draft.text.trim()}
                    />
                  ) : (
                    <NoteCard
                      key={item.id}
                      index={index}
                      on
                      label="On the slide"
                      quote={quoteFor(item.note.sourceBlockId)}
                      fontFamily={fontFamilyFor(item.note.styleId)}
                      ink={item.note.color}
                      defaultValue={item.note.text}
                      onCommit={(text) => onEditPlaced(item.note.id, text)}
                      onToggle={() => onUnplace(item.note)}
                      onRemove={() => onRemove(item.note)}
                      removeLabel="Remove from slide"
                    />
                  ),
                )}
              </ul>
            )}
            {drafts.length > 1 && (
              <button type="button" className="btn-secondary block" onClick={onPlaceAll}>
                <Icon name="check" />
                Add all {drafts.length} to the slide
              </button>
            )}
          </>
        )}

        {tab === 'mine' && (
          <>
            <div className="panel-intro">
              <h2>My notes</h2>
              <p>Notes you wrote or asked Snapt for. Edit them here or drag them on the slide.</p>
            </div>
            {studentNotes.length === 0 ? (
              <p className="panel-empty">None yet. Pick Text in the toolbar and tap the slide, or ask Snapt below.</p>
            ) : (
              <ul className="note-list">
                {studentNotes.map((note, index) => (
                  <NoteCard
                    key={note.id}
                    index={index}
                    label="Yours"
                    quote={quoteFor(note.sourceBlockId)}
                    fontFamily={fontFamilyFor(note.styleId)}
                    ink={note.color}
                    defaultValue={note.text}
                    onCommit={(text) => onEditPlaced(note.id, text)}
                    onRemove={() => onRemove(note)}
                    removeLabel="Delete note"
                  />
                ))}
              </ul>
            )}
          </>
        )}

        {tab === 'text' && progress === null && (
          <>
            <div className="panel-intro">
              <h2>On the slide</h2>
              <p>Text Snapt read from your screenshot, outlined on the slide. It stays as the professor wrote it.</p>
            </div>
            {!reading ? (
              <p className="panel-empty">This slide hasn’t been read yet.</p>
            ) : blocks.length === 0 ? (
              <p className="panel-empty">Snapt couldn’t find readable text on this slide.</p>
            ) : (
              <ol className="text-list">
                {blocks.map((block) => (
                  <li key={block.id}>{block.text}</li>
                ))}
              </ol>
            )}
            <button type="button" className="btn-secondary block" onClick={onReread}>
              Read the slide again
            </button>
          </>
        )}

        {tab !== 'text' && (
          <HandCard
            styleName={style.name}
            fontFamily={handFont}
            ink={inkColor}
            inkFromSample={inkFromSample}
            sampleUrl={sampleUrl}
            onSample={onSample}
          />
        )}
      </div>
    </aside>
  );
}

function NoteCard({
  index,
  on,
  label,
  quote,
  fontFamily,
  ink,
  value,
  defaultValue,
  onChange,
  onCommit,
  onToggle,
  onRemove,
  removeLabel,
  onFocus,
  onBlur,
  toggleDisabled,
}: {
  index: number;
  on?: boolean;
  label: string;
  quote?: string;
  fontFamily: string;
  ink: string;
  value?: string;
  defaultValue?: string;
  onChange?: (text: string) => void;
  onCommit?: (text: string) => void;
  onToggle?: () => void;
  onRemove: () => void;
  removeLabel: string;
  onFocus?: () => void;
  onBlur?: () => void;
  toggleDisabled?: boolean;
}) {
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const controlled = value !== undefined;

  return (
    <li
      className={on ? 'note-card is-on' : 'note-card'}
      style={{ '--i': index } as CSSProperties}
      onMouseEnter={onFocus}
      onMouseLeave={onBlur}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      {onToggle && (
        <label className="note-check">
          <input
            type="checkbox"
            checked={!!on}
            disabled={toggleDisabled}
            onChange={onToggle}
            aria-label={on ? 'Take off the slide' : 'Write on the slide'}
          />
          <span className="note-check-box" aria-hidden="true">
            <Icon name="check" size={14} />
          </span>
        </label>
      )}
      <div className="note-main">
        <div className="note-paper">
          {controlled ? (
            <textarea
              ref={fieldRef}
              className="hand-field"
              aria-label="Note text"
              rows={2}
              style={{ fontFamily, color: ink }}
              value={value}
              onChange={(event) => onChange?.(event.target.value)}
            />
          ) : (
            <textarea
              ref={fieldRef}
              key={defaultValue}
              className="hand-field"
              aria-label="Note text"
              rows={2}
              style={{ fontFamily, color: ink }}
              defaultValue={defaultValue}
              onBlur={(event) => {
                const next = event.target.value.trim();
                if (next && next !== defaultValue) onCommit?.(next);
                else event.target.value = defaultValue ?? '';
              }}
            />
          )}
        </div>
        <p className="note-meta">
          <span className="note-label">{label}</span>
          {quote && (
            <span className="note-anchor">
              <Icon name="pin" size={13} />
              {clip(quote, 42)}
            </span>
          )}
        </p>
      </div>
      <div className="note-actions">
        <button type="button" className="icon-btn" aria-label="Edit note" onClick={() => fieldRef.current?.focus()}>
          <Icon name="pencil" size={16} />
        </button>
        <button type="button" className="icon-btn" aria-label={removeLabel} onClick={onRemove}>
          <Icon name="trash" size={16} />
        </button>
      </div>
    </li>
  );
}

function HandCard({
  styleName,
  fontFamily,
  ink,
  inkFromSample,
  sampleUrl,
  onSample,
}: {
  styleName: string;
  fontFamily: string;
  ink: string;
  inkFromSample: boolean;
  sampleUrl: string | null;
  onSample: (file: File) => void;
}) {
  function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) onSample(file);
  }

  return (
    <section className="hand-card" aria-labelledby="hand-title">
      <div className="hand-card-head">
        <h3 id="hand-title">Your handwriting</h3>
        <Link to="/handwriting">Change style</Link>
      </div>
      <p>
        Notes are written in your {styleName} hand
        {inkFromSample ? ', in the ink color from your sample.' : '. Upload a sample and Snapt matches your ink color.'}
      </p>
      <div className="hand-sample">
        {sampleUrl ? (
          <img src={sampleUrl} alt="Your handwriting sample" />
        ) : (
          <p style={{ fontFamily, color: ink }}>This is my handwriting!</p>
        )}
      </div>
      <label className="btn-primary block file-button">
        <Icon name="upload" />
        {sampleUrl ? 'Replace sample' : 'Upload sample'}
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onFile} />
      </label>
    </section>
  );
}
