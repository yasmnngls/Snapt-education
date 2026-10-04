import { useEffect, useRef, type Ref } from 'react';
import Icon from '../components/Icon';
import { fontFamilyFor } from '../hand/styles';
import type { ChatDraft } from './assist';

export type ChatMessage = {
  id: string;
  role: 'user' | 'snapt';
  text: string;
};

export default function ChatPanel({
  messages,
  draft,
  styleId,
  inkColor,
  busy,
  onSend,
  onDraftText,
  onOk,
  onDiscard,
  dockRef,
}: {
  dockRef?: Ref<HTMLDivElement>;
  messages: ChatMessage[];
  draft: ChatDraft | null;
  styleId: string;
  inkColor: string;
  busy: boolean;
  onSend: (message: string) => void;
  onDraftText: (text: string) => void;
  onOk: () => void;
  onDiscard: () => void;
}) {
  const logRef = useRef<HTMLDivElement>(null);
  const recent = messages.slice(-3);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, draft?.text]);

  return (
    <div className="chat-dock" ref={dockRef}>
      <div className="chat-log" ref={logRef} role="log" aria-live="polite" aria-relevant="additions" aria-label="Snapt chat">
        {recent.map((message) => (
          <p key={message.id} className={message.role === 'user' ? 'chat-bubble user' : 'chat-bubble snapt'}>
            {message.text}
          </p>
        ))}
      </div>
      {draft && (
        <div className="chat-draft">
          <div className="chat-draft-head">
            <label htmlFor="chat-note">Preview on the slide</label>
            <span>{draft.quote ? `Next to “${draft.quote.length > 28 ? `${draft.quote.slice(0, 27)}…` : draft.quote}”` : 'In the margin'}</span>
          </div>
          <textarea
            id="chat-note"
            className="hand-field"
            rows={2}
            style={{ fontFamily: fontFamilyFor(styleId), color: inkColor }}
            value={draft.text}
            onChange={(event) => onDraftText(event.target.value)}
          />
          <div className="chat-draft-actions">
            <button type="button" className="btn-ghost" onClick={onDiscard} disabled={busy}>
              Discard
            </button>
            <button type="button" className="btn-primary" onClick={onOk} disabled={!draft.text.trim() || busy}>
              <Icon name="check" size={16} />
              OK
            </button>
          </div>
        </div>
      )}
      <div className="chat-chips">
        <button type="button" className="chip" onClick={() => onSend('Summarize this slide')} disabled={busy}>
          Summarize this slide
        </button>
        <button type="button" className="chip" onClick={() => onSend('Make it shorter')} disabled={busy || !draft}>
          Make it shorter
        </button>
        <button type="button" className="chip" onClick={() => onSend('Make it clearer')} disabled={busy || !draft}>
          Make it clearer
        </button>
      </div>
      <form
        className="chat-form"
        onSubmit={(event) => {
          event.preventDefault();
          const field = event.currentTarget.elements.namedItem('message');
          if (!(field instanceof HTMLInputElement) || !field.value.trim()) return;
          const text = field.value;
          field.value = '';
          onSend(text);
        }}
      >
        <span className="chat-spark" aria-hidden="true">
          <Icon name="sparkle" size={17} />
        </span>
        <input name="message" aria-label="Ask Snapt to add a note" placeholder="Add a note about this slide…" disabled={busy} autoComplete="off" />
        <button type="submit" className="send-btn" disabled={busy} aria-label="Send">
          <Icon name="send" size={17} />
        </button>
      </form>
    </div>
  );
}
