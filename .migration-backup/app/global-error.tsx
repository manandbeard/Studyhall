'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white">
          <h2 className="text-4xl font-bold mb-4">Something went wrong!</h2>
          <p className="mb-6 text-red-400">{error.message}</p>
          <button
            onClick={() => reset()}
            className="bg-neo-yellow text-slate-900 px-6 py-3 rounded-lg font-bold hover:bg-yellow-500 transition-colors"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
