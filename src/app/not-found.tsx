import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen grid place-items-center p-6 bg-diesel">
      <div className="text-center">
        <div className="text-safety text-8xl font-black mb-4">404</div>
        <h1 className="text-white text-2xl font-bold mb-2">Page not found</h1>
        <p className="text-steel-400 mb-6">The page you're looking for doesn't exist or has been moved.</p>
        <Link href="/dashboard" className="btn-accent">Go to Dashboard</Link>
      </div>
    </main>
  );
}
