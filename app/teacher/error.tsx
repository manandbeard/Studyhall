'use client';

import { AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function TeacherError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neo-bg p-4">
      <div className="neo-box max-w-lg w-full p-8 bg-white space-y-6">
        <div className="flex items-center gap-3 text-neo-red">
          <AlertCircle className="w-8 h-8" />
          <h2 className="text-2xl font-black uppercase">Dashboard Error</h2>
        </div>
        <p className="font-bold text-gray-700">{error.message}</p>
        <div className="flex gap-3">
          <button
            onClick={reset}
            className="neo-button bg-neo-yellow px-6 py-3 font-black uppercase"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="neo-button bg-gray-100 px-6 py-3 font-black uppercase"
          >
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}
