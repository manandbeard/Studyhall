import { useAuth } from '@/components/AuthProvider';
import { useLocation } from 'wouter';
import { useEffect, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';

function formatAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code;
  switch (code) {
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized for sign-in. An admin needs to add this URL to Firebase Console → Authentication → Settings → Authorized domains.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in popup. Please allow popups for this site, or open the app in a new tab.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Sign-in was cancelled. Please try again.';
    case 'auth/operation-not-allowed':
      return 'Google sign-in is not enabled for this Firebase project.';
    case 'auth/operation-not-supported-in-this-environment':
      return 'Sign-in is not supported in this browser context. Try opening the app in a new tab.';
    case 'auth/network-request-failed':
      return 'Network error. If you are viewing this in a preview iframe, your browser may be blocking third-party cookies. Click "Open in New Tab" at the top right of the preview window.';
    default:
      return (err as { message?: string })?.message || 'Failed to sign in.';
  }
}

export default function LoginPage() {
  const { user, loading, signingIn, signIn } = useAuth();
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
    } catch (err) {
      setError(formatAuthError(err));
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
          disabled={signingIn}
          className="neo-button bg-neo-blue text-white py-4 px-8 w-full text-lg flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {signingIn ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Signing in...
            </>
          ) : (
            'Sign in with Google'
          )}
        </button>
      </div>
    </div>
  );
}
