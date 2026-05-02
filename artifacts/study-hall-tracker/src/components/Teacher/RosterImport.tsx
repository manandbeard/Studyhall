import { useState } from 'react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth, db } from '@/firebase';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { useAuth } from '@/components/AuthProvider';
import { handleFirestoreError, OperationType } from '@/lib/firestore-utils';
import { BookOpen, Download, AlertCircle, CheckCircle2, Upload, FileText } from 'lucide-react';

export default function RosterImport() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<any[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'error' | 'success' | 'info' } | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [importMode, setImportMode] = useState<'google' | 'manual'>('google');

  const handleConnect = async () => {
    setLoading(true);
    setMessage(null);
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/classroom.courses.readonly');
    provider.addScope('https://www.googleapis.com/auth/classroom.rosters.readonly');

    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setToken(credential.accessToken);
        await fetchCourses(credential.accessToken);
      } else {
        setMessage({ text: 'Failed to retrieve access token.', type: 'error' });
      }
    } catch (error: any) {
      console.error(error);
      setMessage({ text: error.message || 'Failed to connect to Google Classroom.', type: 'error' });
    }
    setLoading(false);
  };

  const fetchCourses = async (accessToken: string) => {
    try {
      const res = await fetch('https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to fetch courses. Ensure Google Classroom API is enabled in Google Cloud Console.');
      }

      if (data.courses && data.courses.length > 0) {
        setCourses(data.courses);
        setMessage({ text: 'Select a course to import its roster.', type: 'info' });
      } else {
        setMessage({ text: 'No active courses found in Google Classroom.', type: 'info' });
      }
    } catch (error: any) {
      console.error(error);
      setMessage({ text: error.message, type: 'error' });
    }
  };

  const importStudents = async (studentNames: string[], sourceName: string) => {
    if (!user) return;
    setLoading(true);
    setMessage({ text: `Importing students from ${sourceName}...`, type: 'info' });

    try {
      let importedCount = 0;

      for (const name of studentNames) {
        const trimmedName = name.trim();
        if (trimmedName) {
          const q = query(
            collection(db, 'students'),
            where('name', '==', trimmedName),
            where('thirdPeriodTeacherId', '==', user.uid)
          );
          const existing = await getDocs(q);

          if (existing.empty) {
            await addDoc(collection(db, 'students'), {
              name: trimmedName,
              thirdPeriodTeacherId: user.uid
            });
            importedCount++;
          }
        }
      }

      setMessage({ text: `Successfully imported ${importedCount} new students from ${sourceName}.`, type: 'success' });
      if (sourceName !== 'Manual Input') setCourses([]);
      setManualInput('');
    } catch (error: any) {
      console.error(error);
      setMessage({ text: error.message, type: 'error' });
    }
    setLoading(false);
  };

  const importRoster = async (courseId: string, courseName: string) => {
    if (!token || !user) return;
    setLoading(true);
    setMessage({ text: `Fetching students from ${courseName}...`, type: 'info' });

    try {
      const res = await fetch(`https://classroom.googleapis.com/v1/courses/${courseId}/students`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to fetch students.');
      }

      const students = data.students || [];
      const studentNames = students.map((s: any) => s.profile?.name?.fullName).filter(Boolean);

      await importStudents(studentNames, courseName);
    } catch (error: any) {
      console.error(error);
      setMessage({ text: error.message, type: 'error' });
      setLoading(false);
    }
  };

  const handleManualImport = () => {
    const names = manualInput.split('\n').filter((n: string) => n.trim() !== '');
    if (names.length === 0) {
      setMessage({ text: 'Please enter at least one student name.', type: 'error' });
      return;
    }
    importStudents(names, 'Manual Input');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const names = content.split(/[\n,]+/).filter((n: string) => n.trim() !== '');
      if (names.length > 0) {
        importStudents(names, file.name);
      } else {
        setMessage({ text: 'No valid names found in file.', type: 'error' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="neo-box p-6 mt-4 bg-white">
      <div className="flex items-center justify-between mb-6 border-b-4 border-neo-border pb-4">
        <div className="flex items-center gap-3">
          <BookOpen className="w-8 h-8 text-neo-blue" />
          <h2 className="text-2xl font-black uppercase">Class Roster Import</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setImportMode('google')}
            className={`neo-button px-4 py-2 text-sm font-black uppercase ${importMode === 'google' ? 'bg-neo-blue text-white' : 'bg-gray-100 text-gray-500'}`}
          >
            Google Classroom
          </button>
          <button
            onClick={() => setImportMode('manual')}
            className={`neo-button px-4 py-2 text-sm font-black uppercase ${importMode === 'manual' ? 'bg-neo-yellow text-neo-border' : 'bg-gray-100 text-gray-500'}`}
          >
            Manual / Bulk
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-4 mb-6 border-4 border-neo-border font-bold flex items-center gap-3 ${
          message.type === 'error' ? 'bg-neo-red text-white' :
          message.type === 'success' ? 'bg-neo-green text-neo-border' :
          'bg-neo-yellow text-neo-border'
        }`}>
          {message.type === 'error' && <AlertCircle className="w-6 h-6" />}
          {message.type === 'success' && <CheckCircle2 className="w-6 h-6" />}
          {message.type === 'info' && <AlertCircle className="w-6 h-6" />}
          <p>{message.text}</p>
        </div>
      )}

      {importMode === 'google' && (
        <div>
          <p className="font-medium mb-6">
            Connect your Google Classroom account to automatically import your 3rd-period students into the tracking system.
          </p>

          {!token && (
            <button
              onClick={handleConnect}
              disabled={loading}
              className="neo-button bg-neo-blue text-white px-6 py-3 flex items-center gap-2"
            >
              <Download className="w-5 h-5" />
              {loading ? 'Connecting...' : 'Connect Google Classroom'}
            </button>
          )}

          {courses.length > 0 && (
            <div className="space-y-3 mt-6">
              <h3 className="font-black text-lg uppercase border-b-4 border-neo-border pb-2 mb-4">Your Active Courses</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {courses.map(course => (
                  <div key={course.id} className="border-4 border-neo-border p-4 flex justify-between items-center bg-gray-50">
                    <div>
                      <p className="font-black text-lg">{course.name}</p>
                      <p className="font-bold text-sm text-gray-600">{course.section || 'No Section'}</p>
                    </div>
                    <button
                      onClick={() => importRoster(course.id, course.name)}
                      disabled={loading}
                      className="neo-button bg-neo-yellow px-4 py-2 text-sm"
                    >
                      Import
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {importMode === 'manual' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="font-black uppercase flex items-center gap-2">
                <FileText className="w-5 h-5" /> Paste Student Names
              </h3>
              <p className="text-sm font-bold text-gray-500">Enter one student name per line.</p>
              <textarea
                className="neo-input w-full h-48 resize-none"
                placeholder={"John Doe\nJane Smith\nAlex Johnson"}
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
              />
              <button
                onClick={handleManualImport}
                disabled={loading || !manualInput.trim()}
                className="neo-button bg-neo-yellow px-6 py-3 w-full font-black uppercase disabled:opacity-50"
              >
                {loading ? 'Importing...' : 'Import Pasted Names'}
              </button>
            </div>

            <div className="space-y-4">
              <h3 className="font-black uppercase flex items-center gap-2">
                <Upload className="w-5 h-5" /> Upload File
              </h3>
              <p className="text-sm font-bold text-gray-500">Upload a .txt or .csv file with student names separated by newlines or commas.</p>

              <div className="border-4 border-dashed border-neo-border p-8 text-center bg-gray-50 relative hover:bg-gray-100 transition-colors cursor-pointer">
                <input
                  type="file"
                  accept=".txt,.csv"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={loading}
                />
                <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="font-black uppercase text-gray-600">Click or drag file here</p>
                <p className="font-bold text-sm text-gray-500 mt-2">Supports .txt and .csv</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
