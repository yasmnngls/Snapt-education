import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import SlideThumb from '../components/SlideThumb';
import Wordmark from '../components/Wordmark';
import type { ClassRecord, LectureRecord, SlideRecord } from '../types';

export function slideTitle(slide: SlideRecord, index: number) {
  const first = slide.reading?.blocks.slice().sort((a, b) => a.y - b.y)[0]?.text.trim();
  if (!first) return `Slide ${index + 1}`;
  return first.length > 34 ? `${first.slice(0, 33).trimEnd()}…` : first;
}

export default function EditorSidebar({
  course,
  lecture,
  slides,
  activeId,
}: {
  course: ClassRecord | null;
  lecture: LectureRecord | null;
  slides: SlideRecord[];
  activeId: string;
}) {
  return (
    <aside className="studio-side" aria-label="Lecture">
      <Wordmark />
      <nav className="side-nav">
        <Link to="/">
          <Icon name="home" />
          Classes
        </Link>
        {course && (
          <Link to={`/classes/${course.id}`} className="side-class">
            <span className="side-class-icon">
              <Icon name="leaf" size={16} />
            </span>
            {course.name}
          </Link>
        )}
        <Link to="/handwriting">
          <Icon name="pen" />
          Handwriting
        </Link>
      </nav>
      {lecture && (
        <Link to={`/lectures/${lecture.id}`} className="side-lecture">
          <span className="side-label">Lecture</span>
          <span className="side-lecture-title">{lecture.title}</span>
        </Link>
      )}
      <ol className="side-slides">
        {slides.map((slide, index) => (
          <li key={slide.id}>
            <Link
              to={`/lectures/${slide.lectureId}/slides/${slide.id}`}
              className={slide.id === activeId ? 'side-slide active' : 'side-slide'}
              aria-current={slide.id === activeId ? 'page' : undefined}
            >
              <span className="side-slide-num">{index + 1}</span>
              <span className="side-slide-thumb">
                <SlideThumb slide={slide} />
              </span>
              <span className="side-slide-title">{slideTitle(slide, index)}</span>
            </Link>
          </li>
        ))}
      </ol>
      {lecture && (
        <Link to={`/lectures/${lecture.id}/capture`} className="side-add">
          <Icon name="plus" />
          Add slide
        </Link>
      )}
    </aside>
  );
}
