import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import TopBar from '../components/TopBar';
import { db, deleteLecture } from '../db';
import type { ClassRecord, LectureRecord } from '../types';

function formatWhen(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(timestamp);
}

export default function LecturesPage() {
  const { classId = '' } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState<ClassRecord | null | undefined>(undefined);
  const [lectures, setLectures] = useState<LectureRecord[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function refresh(id: string) {
    const [found, rows] = await Promise.all([
      db.classes.get(id),
      db.lectures.where('classId').equals(id).sortBy('createdAt'),
    ]);
    setCourse(found ?? null);
    setLectures(rows.reverse());
    const nextCounts: Record<string, number> = {};
    await Promise.all(
      rows.map(async (lecture) => {
        nextCounts[lecture.id] = await db.slides.where('lectureId').equals(lecture.id).count();
      }),
    );
    setCounts(nextCounts);
  }

  useEffect(() => {
    refresh(classId).catch(() => setError('Could not open saved slides on this device.'));
  }, [classId]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError('Name the lecture first.');
      return;
    }
    const created: LectureRecord = {
      id: crypto.randomUUID(),
      classId,
      title: trimmed.slice(0, 80),
      createdAt: Date.now(),
    };
    await db.lectures.add(created);
    navigate(`/lectures/${created.id}`);
  }

  async function onDelete(lecture: LectureRecord) {
    if (!window.confirm(`Delete ${lecture.title}? Its slides will be removed from this device.`)) return;
    await deleteLecture(lecture.id);
    await refresh(classId);
  }

  if (course === undefined) return <p className="loading">Loading class…</p>;
  if (!course) {
    return (
      <main className="page">
        <p className="lead">This class is not on this device.</p>
        <Link to="/">Back to classes</Link>
      </main>
    );
  }

  return (
    <div className="shell">
      <TopBar crumbs={[{ label: course.name }]} />
      <main className="page">
        <p className="lead">{course.name}</p>
        <p className="sub">Add a lecture, then capture its slides.</p>
        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}
        {lectures.length === 0 ? (
          <p className="empty">No lectures yet.</p>
        ) : (
          <ul className="card-list">
            {lectures.map((lecture) => (
              <li key={lecture.id}>
                <Link className="card" to={`/lectures/${lecture.id}`}>
                  <span className="card-title">{lecture.title}</span>
                  <span className="card-meta">
                    {formatWhen(lecture.createdAt)} · {counts[lecture.id] ?? 0} slides
                  </span>
                </Link>
                <button type="button" className="text-button" onClick={() => void onDelete(lecture)}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
        <form className="create-form" onSubmit={(event) => void onCreate(event)}>
          <label htmlFor="lecture-title">Lecture name</label>
          <div className="create-row">
            <input
              id="lecture-title"
              value={title}
              maxLength={80}
              placeholder="Tuesday lecture"
              onChange={(event) => {
                setTitle(event.target.value);
                setError(null);
              }}
            />
            <button type="submit">Create lecture</button>
          </div>
        </form>
      </main>
    </div>
  );
}
