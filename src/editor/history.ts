import { useCallback, useState } from 'react';
import type { Annotation } from '../types';

const HISTORY_LIMIT = 50;

type HistoryState = {
  past: Annotation[][];
  present: Annotation[];
  future: Annotation[][];
};

function cloneAnnotations(list: Annotation[]): Annotation[] {
  return list.map((annotation) =>
    annotation.type === 'stroke'
      ? { ...annotation, points: annotation.points.map((point) => ({ ...point })) }
      : { ...annotation },
  );
}

export function useAnnotationHistory(initial: Annotation[]) {
  const [state, setState] = useState<HistoryState>({
    past: [],
    present: initial,
    future: [],
  });

  const commit = useCallback((next: Annotation[]) => {
    setState((current) => ({
      past: [...current.past, cloneAnnotations(current.present)].slice(-HISTORY_LIMIT),
      present: next,
      future: [],
    }));
  }, []);

  const replace = useCallback((next: Annotation[]) => {
    setState((current) => ({ ...current, present: next }));
  }, []);

  const checkpoint = useCallback(() => {
    setState((current) => ({
      past: [...current.past, cloneAnnotations(current.present)].slice(-HISTORY_LIMIT),
      present: current.present,
      future: [],
    }));
  }, []);

  const undo = useCallback(() => {
    setState((current) => {
      if (current.past.length === 0) return current;
      const previous = current.past[current.past.length - 1];
      return {
        past: current.past.slice(0, -1),
        present: previous,
        future: [cloneAnnotations(current.present), ...current.future].slice(0, HISTORY_LIMIT),
      };
    });
  }, []);

  const redo = useCallback(() => {
    setState((current) => {
      if (current.future.length === 0) return current;
      const next = current.future[0];
      return {
        past: [...current.past, cloneAnnotations(current.present)].slice(-HISTORY_LIMIT),
        present: next,
        future: current.future.slice(1),
      };
    });
  }, []);

  return {
    annotations: state.present,
    commit,
    replace,
    checkpoint,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
}
