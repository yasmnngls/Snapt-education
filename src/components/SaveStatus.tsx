import type { SaveStatus } from '../editor/autosave';
import Icon from './Icon';

export default function SaveStatus({ status }: { status: SaveStatus }) {
  const label = status === 'saving' ? 'Saving…' : status === 'unsaved' ? 'Unsaved' : 'Saved';
  return (
    <span className={`save-status save-${status}`} role="status" aria-live="polite" title={`${label} on this device`}>
      {status === 'saved' && <Icon name="cloud" size={17} />}
      {label}
    </span>
  );
}
