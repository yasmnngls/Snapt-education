import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import SlideThumb from '../components/SlideThumb';
import TopBar from '../components/TopBar';
import { db, deleteLecture } from '../db';
import { downloadBlob, lectureToPdf, safeName } from '../export/exportSlide';
import type { ClassRecord, LectureRecord, SlideRecord } from '../types';

export default function LecturePage() {
  const { lectureId = '' } = useParams();
  const [lecture, setLecture] = useState<LectureRecord | null | undefined>(undefined);
  const [course, setCourse] = useState<ClassRecord | null>(null);
  const [slides, setSlides] = useState<SlideRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  async function refresh(id: string) {
    const found = await db.lectures.get(id);
    setLecture(found ?? null);
    if (!found) return;
    setCourse((await db.classes.get(found.classId)) ?? null);
    const rows = await db.slides.where('lectureId').equals(id).sortBy('order');
    setSlides(rows);
  }

  useEffect(() => {
    refresh(lectureId).catch(() => setError('Could not open saved slides on this device.'));
  }, [lectureId]);

  async function onDeleteSlide(slide: SlideRecord) {
    if (!window.confirm('Remove this slide from the lecture?')) return;
    await db.slides.delete(slide.id);
    await refresh(lectureId);
  }

  async function onDeleteLecture() {
    if (!lecture) return;
    if (!window.confirm(`Delete ${lecture.title}? Its slides will be removed from this device.`)) return;
    await deleteLecture(lecture.id);
    window.location.assign(course ? `/classes/${course.id}` : '/');
  }

  async function onPdf() {
    if (!lecture || slides.length === 0) return;
    setExporting(true);
    setError(null);
    try {
      const pdf = await lectureToPdf(slides);
      downloadBlob(pdf, `${safeName(lecture.title)}.pdf`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not export the PDF.');
    } finally {
      setExporting(false);
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

  return (
    <div className="shell">
      <TopBar
        crumbs={[
          ...(course ? [{ label: course.name, to: `/classes/${course.id}` }] : []),
          { label: lecture.title },
        ]}
        actions={
          <>
            <button type="button" className="text-button" onClick={() => void onDeleteLecture()}>
              Delete lecture
            </button>
            <button type="button" className="ghost-link" onClick={() => void onPdf()} disabled={slides.length === 0 || exporting}>
              {exporting ? 'Exporting…' : 'Download PDF'}
            </button>
          </>
        }
      />
      <main className="page page-wide">
        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}
        {slides.length === 0 ? (
          <>
            <p className="lead">Add a slide from a photo or screenshot.</p>
            <p className="sub">Snapt reads it and suggests notes. You approve what goes on the slide.</p>
          </>
        ) : (
          <ul className="slide-strip">
            {slides.map((slide, index) => (
              <li key={slide.id}>
                <Link className="slide-card" to={`/lectures/${lecture.id}/slides/${slide.id}`}>
                  <SlideThumb slide={slide} />
                  <span>Slide {index + 1}</span>
                </Link>
                <button type="button" className="text-button" onClick={() => void onDeleteSlide(slide)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <Link className="button-link" to={`/lectures/${lecture.id}/capture`}>
          Add a slide
        </Link>
      </main>
    </div>
  );
}
