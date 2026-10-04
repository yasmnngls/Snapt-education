import { Link } from 'react-router-dom';

export default function Wordmark() {
  return (
    <Link to="/" className="wordmark" aria-label="Snapt home">
      Snapt
      <svg className="wordmark-spark" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M6 9 3.5 6.5M10 6.5V3M14 9l2.5-2.5" />
      </svg>
    </Link>
  );
}
