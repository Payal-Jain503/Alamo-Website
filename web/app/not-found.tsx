import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="page-head">
      <div className="wrap">
        <p className="eyebrow">Page not found</p>
        <h1>This page has checked out</h1>
        <p className="lede">The page you’re looking for doesn’t exist or has moved.</p>
        <p>
          <Link href="/homes/" className="btn btn-solid">
            See our homes
          </Link>
        </p>
      </div>
    </section>
  );
}
