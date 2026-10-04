import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar';
import { db, deleteClass } from '../db';
import type { ClassRecord } from '../types';

function formatWhen(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(timestamp);
}

export default function ClassesPage() {
  const navigate = useNavigate();
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setClasses(await db.classes.orderBy('createdAt').reverse().toArray());
  }

  useEffect(() => {
    refresh().catch(() => setError('Could not open saved slides on this device.'));
  }, []);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name the class first.');
      return;
    }
    const created: ClassRecord = { id: crypto.randomUUID(), name: trimmed.slice(0, 80), createdAt: Date.now() };
    await db.classes.add(created);
    navigate(`/classes/${created.id}`);
  }

  async function onDelete(course: ClassRecord) {
    if (!window.confirm(`Delete ${course.name}? Its lectures and slides will be removed from this device.`)) return;
    await deleteClass(course.id);
    await refresh();
  }

  return (
    <div className="shell">
      <TopBar
        crumbs={[]}
        actions={
          <Link className="button-link ghost-link" to="/handwriting">
            Handwriting
          </Link>
        }
      />
      <main className="page">
        <p className="lead">Turn a lecture slide into handwritten study notes, placed where they belong.</p>
        <p className="sub">
          Start with a class. Then add a lecture and a screenshot. Snapt suggests the notes, and you decide what stays.
        </p>
        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}
        {classes.length > 0 && (
          <ul className="card-list">
            {classes.map((course) => (
              <li key={course.id}>
                <Link className="card" to={`/classes/${course.id}`}>
                  <span className="card-title">{course.name}</span>
                  <span className="card-meta">{formatWhen(course.createdAt)}</span>
                </Link>
                <button type="button" className="text-button" onClick={() => void onDelete(course)}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
        <form className="create-form" onSubmit={(event) => void onCreate(event)}>
          <label htmlFor="class-name">Class name</label>
          <div className="create-row">
            <input
              id="class-name"
              value={name}
              maxLength={80}
              placeholder="Biology 101"
              onChange={(event) => {
                setName(event.target.value);
                setError(null);
              }}
            />
            <button type="submit">Create class</button>
          </div>
        </form>
      </main>
    </div>
  );
}
