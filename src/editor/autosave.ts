import { useEffect, useRef, useState } from 'react';
import type { Annotation } from '../types';
import { db } from '../db';

export type SaveStatus = 'saved' | 'saving' | 'unsaved';

export function useAutosave(slideId: string, annotations: Annotation[]) {
  const [status, setStatus] = useState<SaveStatus>('saved');
  const [error, setError] = useState<string | null>(null);
  const savedJson = useRef(JSON.stringify(annotations));
  const latest = useRef(annotations);
  const writing = useRef(false);
  const mounted = useRef(true);
  latest.current = annotations;

  async function flush() {
    if (writing.current) return;
    const snapshot = latest.current;
    const json = JSON.stringify(snapshot);
    if (json === savedJson.current) return;
    writing.current = true;
    if (mounted.current) setStatus('saving');
    try {
      await db.slides.update(slideId, { annotations: snapshot, updatedAt: Date.now() });
      savedJson.current = json;
      if (mounted.current) {
        setError(null);
        setStatus(JSON.stringify(latest.current) === json ? 'saved' : 'unsaved');
      }
    } catch {
      if (mounted.current) {
        setStatus('unsaved');
        setError('Could not save on this device.');
      }
    } finally {
      writing.current = false;
      const pending = JSON.stringify(latest.current);
      if (pending !== json && pending !== savedJson.current) void flush();
    }
  }

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const json = JSON.stringify(annotations);
    if (json === savedJson.current) return;
    setStatus('unsaved');
    const handle = window.setTimeout(() => {
      void flush();
    }, 400);
    return () => {
      window.clearTimeout(handle);
      void flush();
    };
  }, [annotations, slideId]);

  useEffect(() => {
    function onLeave() {
      void flush();
    }
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [slideId]);

  return { status, error };
}
