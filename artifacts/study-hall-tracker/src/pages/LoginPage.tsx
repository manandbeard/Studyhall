import { useAuth } from '@/components/AuthProvider';
import { useLocation } from 'wouter';
import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const { user, loading, signIn } = useAuth();
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) {
      if (user.role === 'admin') {
        setLocation('/admin');
      } else {
        setLocation('/teacher');
      }
    }
  }, [user, loading, setLocation]);

  const handleSignIn = async () => {
    setError(null);
    try {
      await signIn();
    } catch (err: any) {
      if (err.message?.includes('network-request-failed')) {
        setError('Network error: If you are viewing this in a preview iframe, your browser might be blocking third-party cookies. Please click the "Open in New Tab" button at the top right of the preview window to sign in.');
      } else {
        setError(err.message || 'Failed to sign in.');
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neo-bg">
        <div className="text-2xl font-bold animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-neo-bg">
      <div className="neo-box max-w-md w-full p-8 flex flex-col items-center space-y-8 bg-white">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-black uppercase tracking-tighter">Study Hall</h1>
          <p className="text-xl font-bold bg-neo-yellow inline-block px-2">Tracker</p>
        </div>

        <p className="text-center font-medium">
          Real-time verification for student transit.
        </p>

        {error && (
          <div className="w-full bg-neo-red text-white p-4 border-4 border-neo-border font-bold flex items-start gap-3 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        <button
          onClick={handleSignIn}
          className="neo-button bg-neo-blue text-white py-4 px-8 w-full text-lg"
        >
          Sign in with Google
        </button>
      </div>
    </div>
  );
}
