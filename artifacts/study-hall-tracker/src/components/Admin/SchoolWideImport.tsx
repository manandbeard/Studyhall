import { useState } from 'react';
import {
  collection,
  getDocs,
  query,
  where,
  setDoc,
  doc,
  writeBatch,
} from 'firebase/firestore';
import { db, auth } from '@/firebase';
import { Upload, AlertCircle, CheckCircle2, FileText, Sparkles } from 'lucide-react';
import { FIRESTORE_BATCH_LIMIT } from '@/lib/constants';

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

async function parseRosterChunk(csvChunk: string, lastTeacher: string): Promise<any[]> {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error('Not authenticated. Please sign in again.');

  const res = await fetch(`${API_BASE}/api/gemini/parse-roster`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
    body: JSON.stringify({ csvChunk, lastTeacher }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? `Server error: ${res.status}`);
  }
  const json = await res.json();
  return json.data ?? [];
}

export default function SchoolWideImport() {
  const [csvText, setCsvText] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'error' | 'success' | 'info' } | null>(null);
  const [progress, setProgress] = useState('');

  const handleImport = async () => {
    if (!csvText.trim()) {
      setMessage({ text: 'Please paste CSV data.', type: 'error' });
      return;
    }
    setLoading(true);
    setMessage(null);
    setProgress('Initializing AI...');

    try {
      const lines = csvText.split('\n').map((l: string) => l.trim()).filter((l: string) => l);
      const chunkSize = 100;
      let allParsedData: any[] = [];
      let lastTeacher = '';

      for (let i = 0; i < lines.length; i += chunkSize) {
        setProgress(`AI Parsing chunk ${Math.floor(i / chunkSize) + 1} of ${Math.ceil(lines.length / chunkSize)}...`);
        const chunkText = lines.slice(i, i + chunkSize).join('\n');
        const parsedChunk = await parseRosterChunk(chunkText, lastTeacher);
        allParsedData = [...allParsedData, ...parsedChunk];
        if (parsedChunk.length > 0) {
          lastTeacher = parsedChunk[parsedChunk.length - 1].teacherName;
        }
      }

      setProgress('Consolidating data...');
      const teacherMap = new Map<string, any[]>();
      for (const group of allParsedData) {
        const tName = group.teacherName.trim();
        if (!tName) continue;
        const existing = teacherMap.get(tName) || [];
        teacherMap.set(tName, [...existing, ...group.students]);
      }

      setProgress('Importing to database...');
      let importedStudents = 0;
      let importedTeachers = 0;
      const teacherIdCache = new Map<string, string>();

      for (const [teacherName, students] of Array.from(teacherMap.entries())) {
        let currentTeacherId = teacherIdCache.get(teacherName);

        if (!currentTeacherId) {
          const q = query(collection(db, 'users'), where('name', '==', teacherName));
          const snapshot = await getDocs(q);

          if (snapshot.empty) {
            const newTeacherRef = doc(collection(db, 'users'));
            await setDoc(newTeacherRef, {
              uid: newTeacherRef.id,
              name: teacherName,
              role: 'teacher',
              roomNumber: 'TBD',
              isPlaceholder: true,
              email: `${teacherName.toLowerCase().replace(/[^a-z0-9]/g, '')}@placeholder.com`
            });
            currentTeacherId = newTeacherRef.id;
            importedTeachers++;
          } else {
            currentTeacherId = snapshot.docs[0].id;
          }
          teacherIdCache.set(teacherName, currentTeacherId);
        }

        // Fetch all existing students for this teacher in one query to avoid N+1
        // round-trips when checking for duplicates.
        const existingSnap = await getDocs(
          query(
            collection(db, 'students'),
            where('thirdPeriodTeacherId', '==', currentTeacherId),
          ),
        );
        const existingNames = new Set(
          existingSnap.docs.map((d) => (d.data().name as string ?? '').trim().toLowerCase()),
        );

        let batch = writeBatch(db);
        let opCount = 0;

        for (const student of students) {
          const studentName = student.name.trim();
          if (!studentName) continue;

          if (!existingNames.has(studentName.toLowerCase())) {
            const newStudentRef = doc(collection(db, 'students'));
            batch.set(newStudentRef, {
              name: studentName,
              thirdPeriodTeacherId: currentTeacherId,
              notes: student.destination ? `Destination: ${student.destination}` : '',
              isAbsent: student.isAbsent
            });
            importedStudents++;
            opCount++;

            if (opCount >= FIRESTORE_BATCH_LIMIT) {
              await batch.commit();
              batch = writeBatch(db);
              opCount = 0;
            }
          }
        }

        if (opCount > 0) await batch.commit();
      }

      setMessage({ text: `Successfully imported ${importedStudents} students and created ${importedTeachers} placeholder teachers.`, type: 'success' });
      setCsvText('');
    } catch (error: any) {
      console.error(error);
      setMessage({ text: error.message || 'An error occurred during import.', type: 'error' });
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => setCsvText(event.target?.result as string);
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="neo-box flex flex-col bg-white">
      <div className="p-4 border-b-4 border-neo-border bg-neo-yellow">
        <h2 className="text-xl font-black uppercase">School-Wide Roster Import</h2>
        <p className="font-bold text-sm mt-1">Import the entire school's 3rd period CSV.</p>
      </div>

      <div className="p-6 space-y-6">
        {message && (
          <div className={`p-4 border-4 border-neo-border font-bold flex items-center gap-3 ${
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="font-black uppercase flex items-center gap-2">
              <FileText className="w-5 h-5" /> Paste CSV Data
            </h3>
            <p className="text-sm font-bold text-gray-500">
              Format: <br/>
              "TeacherName, CourseName",,<br/>
              Student Name,Destination,Attendance<br/>
              "Student Name",Destination,
            </p>
            <textarea
              className="neo-input w-full h-64 resize-none text-xs font-mono"
              placeholder={'"Helland, English 11",,\nStudent Name,Last name of Teacher or Location if student has Golden Ticket?,ATTENDANCE (Blank for present)\n"Allen, Luke E.",,\n"Boersma, Tyler C.",Ali Lancaster,'}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
            />
            <button
              onClick={handleImport}
              disabled={loading || !csvText.trim()}
              className="neo-button bg-neo-blue text-white px-6 py-3 w-full font-black uppercase disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <><Sparkles className="w-5 h-5 animate-pulse" />{progress || 'Processing...'}</>
              ) : (
                <><Sparkles className="w-5 h-5" />AI Import Data</>
              )}
            </button>
          </div>

          <div className="space-y-4">
            <h3 className="font-black uppercase flex items-center gap-2">
              <Upload className="w-5 h-5" /> Upload CSV File
            </h3>
            <p className="text-sm font-bold text-gray-500">Upload the master CSV file containing all 3rd period rosters.</p>

            <div className="border-4 border-dashed border-neo-border p-8 text-center bg-gray-50 relative hover:bg-gray-100 transition-colors cursor-pointer h-64 flex flex-col items-center justify-center">
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={loading}
              />
              <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="font-black uppercase text-gray-600">Click or drag CSV here</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
