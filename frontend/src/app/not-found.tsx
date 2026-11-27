import Link from "next/link";

export default function NotFound() {
  return (
    <div className="narrow hero">
      <h1>Page not found</h1>
      <p className="muted">The post or page you&apos;re looking for doesn&apos;t exist.</p>
      <Link href="/" className="button">
        ← Back to Home
      </Link>
    </div>
  );
}
