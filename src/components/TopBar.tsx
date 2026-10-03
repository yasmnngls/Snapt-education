import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import Wordmark from './Wordmark';

export type Crumb = { label: string; to?: string };

export default function TopBar({
  crumbs,
  actions,
  dark = false,
}: {
  crumbs: Crumb[];
  actions?: ReactNode;
  dark?: boolean;
}) {
  return (
    <header className={dark ? 'topbar topbar-dark' : 'topbar'}>
      <Wordmark />
      {crumbs.length > 0 && (
        <nav className="crumbs" aria-label="Location">
          {crumbs.map((crumb, index) =>
            crumb.to ? (
              <Link key={`${crumb.label}-${index}`} to={crumb.to}>
                {crumb.label}
              </Link>
            ) : (
              <span key={`${crumb.label}-${index}`}>{crumb.label}</span>
            ),
          )}
        </nav>
      )}
      <div className="topbar-actions">{actions}</div>
    </header>
  );
}
