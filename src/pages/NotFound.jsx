import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="page">
      <div className="container narrow center">
        <p className="eyebrow">404</p>
        <h1>Ez az oldal nem található</h1>
        <p className="lead muted">Lehet, hogy elírás történt, vagy az oldal megszűnt.</p>
        <div className="row-actions center">
          <Link to="/" className="btn btn-primary">Főoldal</Link>
          <Link to="/termeink" className="btn btn-outline">Termeink</Link>
        </div>
      </div>
    </div>
  );
}
