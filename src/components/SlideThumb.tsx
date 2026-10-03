import { useEffect, useState } from 'react';
import type { SlideRecord } from '../types';

export default function SlideThumb({ slide }: { slide: SlideRecord }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const next = URL.createObjectURL(slide.imageBlob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [slide]);
  return <img src={url ?? undefined} alt="" />;
}
