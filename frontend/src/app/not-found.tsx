import Link from "next/link";

export default function NotFound() {
  return (
    <div className="text-center py-5">
      <h1 className="h3">Page not found</h1>
      <p className="text-muted">The page you are looking for doesn&apos;t exist or was moved.</p>
      <Link href="/" className="btn btn-primary">Back to home</Link>
    </div>
  );
}
