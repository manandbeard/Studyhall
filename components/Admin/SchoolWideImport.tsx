'use client';

import { useState } from 'react';
import { collection, addDoc, getDocs, query, where, setDoc, doc, writeBatch } from 'firebase/firestore';
import { db } from '@/firebase';
import { Upload, AlertCircle, CheckCircle2, FileText, Sparkles } from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';

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
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('NEXT_PUBLIC_GEMINI_API_KEY is not set in the environment.');
      }
      const ai = new GoogleGenAI({ apiKey });
      
      const lines = csvText.split('\n').map(l => l.trim()).filter(l => l);
      const chunkSize = 100;
      let allParsedData: any[] = [];
      let lastTeacher = "";

      for (let i = 0; i < lines.length; i += chunkSize) {
        setProgress(`AI Parsing chunk ${Math.floor(i / chunkSize) + 1} of ${Math.ceil(lines.length / chunkSize)}...`);
        const chunkLines = lines.slice(i, i + chunkSize);
        const chunkText = chunkLines.join('\n');

        const prompt = `
        Parse the following CSV chunk of a school roster.
        The previous chunk's last active teacher was: "${lastTeacher}". Use this teacher name for students at the beginning of this chunk if no new teacher name is specified before them.
        Extract the teachers and their students. For the teacher name, extract just the name (e.g., "Helland" or "Smith, John"), ignoring course names.
        CSV Chunk:
        ${chunkText}
        `;

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  teacherName: { type: Type.STRING },
                  students: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING },
                        destination: { type: Type.STRING },
                        isAbsent: { type: Type.BOOLEAN }
                      },
                      required: ["name", "destination", "isAbsent"]
                    }
                  }
                },
                required: ["teacherName", "students"]
              }
            }
          }
        });

        const responseText = response.text;
        if (responseText) {
          const parsedChunk = JSON.parse(responseText);
          allParsedData = [...allParsedData, ...parsedChunk];
          if (parsedChunk.length > 0) {
            lastTeacher = parsedChunk[parsedChunk.length - 1].teacherName;
          }
        }
      }

      setProgress('Consolidating data...');
      // Group by teacher
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

      // Process teachers sequentially to avoid race conditions on creation
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

        // Batch write students for this teacher
        let batch = writeBatch(db);
        let opCount = 0;

        for (const student of students) {
          const studentName = student.name.trim();
          if (!studentName) continue;

          // Check if student exists
          const sq = query(
            collection(db, 'students'),
            where('name', '==', studentName),
            where('thirdPeriodTeacherId', '==', currentTeacherId)
          );
          const sSnapshot = await getDocs(sq);

          if (sSnapshot.empty) {
            const newStudentRef = doc(collection(db, 'students'));
            batch.set(newStudentRef, {
              name: studentName,
              thirdPeriodTeacherId: currentTeacherId,
              notes: student.destination ? `Destination: ${student.destination}` : '',
              isAbsent: student.isAbsent
            });
            importedStudents++;
            opCount++;

            if (opCount >= 450) {
              await batch.commit();
              batch = writeBatch(db);
              opCount = 0;
            }
          }
        }

        if (opCount > 0) {
          await batch.commit();
        }
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
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvText(content);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="neo-box flex flex-col bg-white">
      <div className="p-4 border-b-4 border-neo-border bg-neo-yellow">
        <h2 className="text-xl font-black uppercase">School-Wide Roster Import</h2>
        <p className="font-bold text-sm mt-1">Import the entire school&apos;s 3rd period CSV.</p>
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
              &quot;TeacherName, CourseName&quot;,,<br/>
              Student Name,Destination,Attendance<br/>
              &quot;Student Name&quot;,Destination,
            </p>
            <textarea 
              className="neo-input w-full h-64 resize-none text-xs font-mono"
              placeholder='"Helland, English 11",,&#10;Student Name,Last name of Teacher or Location if student has Golden Ticket?,ATTENDANCE (Blank for present)&#10;"Allen, Luke E.",,&#10;"Boersma, Tyler C.",Ali Lancaster,'
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
            />
            <button 
              onClick={handleImport}
              disabled={loading || !csvText.trim()}
              className="neo-button bg-neo-blue text-white px-6 py-3 w-full font-black uppercase disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Sparkles className="w-5 h-5 animate-pulse" />
                  {progress || 'Processing...'}
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  AI Import Data
                </>
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
