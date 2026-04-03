import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white">
      <h2 className="text-4xl font-bold mb-4">404 - Page Not Found</h2>
      <p className="mb-6">Could not find requested resource</p>
      <Link href="/" className="bg-neo-blue text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-600 transition-colors">
        Return Home
      </Link>
    </div>
  );
}
