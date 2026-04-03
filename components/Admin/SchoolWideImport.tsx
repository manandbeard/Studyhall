'use client';

import { useState } from 'react';
import { collection, addDoc, getDocs, query, where, setDoc, doc } from 'firebase/firestore';
import { db } from '@/firebase';
import { Upload, AlertCircle, CheckCircle2, FileText } from 'lucide-react';

export default function SchoolWideImport() {
  const [csvText, setCsvText] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'error' | 'success' | 'info' } | null>(null);

  const handleImport = async () => {
    if (!csvText.trim()) {
      setMessage({ text: 'Please paste CSV data.', type: 'error' });
      return;
    }
    setLoading(true);
    setMessage({ text: 'Parsing and importing...', type: 'info' });

    try {
      const lines = csvText.split('\n').map(l => l.trim()).filter(l => l);
      let currentTeacherName = '';
      let currentTeacherId = '';
      let importedStudents = 0;
      let importedTeachers = 0;
      let isParsingStudents = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // If we see the header row, the following lines are students
        if (line.startsWith('Student Name,Last name')) {
          isParsingStudents = true;
          continue;
        }

        // If we hit an empty line or a line that looks like a teacher and we aren't parsing students
        // Actually, a better heuristic: if the NEXT line is the header, this MUST be a teacher.
        if (i + 1 < lines.length && lines[i + 1].startsWith('Student Name,Last name')) {
          isParsingStudents = false;
          const teacherMatch = line.match(/^"([^,]+),\s*([^"]+)"/);
          if (teacherMatch) {
            currentTeacherName = teacherMatch[1].trim(); // e.g., "Helland"
            
            // Find or create teacher
            const q = query(collection(db, 'users'), where('name', '==', currentTeacherName));
            const snapshot = await getDocs(q);
            
            if (snapshot.empty) {
              // Create placeholder teacher
              const newTeacherRef = doc(collection(db, 'users'));
              await setDoc(newTeacherRef, {
                uid: newTeacherRef.id,
                name: currentTeacherName,
                role: 'teacher',
                roomNumber: 'TBD',
                isPlaceholder: true,
                email: `${currentTeacherName.toLowerCase().replace(/\s+/g, '')}@placeholder.com`
              });
              currentTeacherId = newTeacherRef.id;
              importedTeachers++;
            } else {
              currentTeacherId = snapshot.docs[0].id;
            }
          }
          continue;
        }

        // Parse student row
        if (isParsingStudents) {
          // Stop parsing students if we hit a blank line (optional, depends on CSV format)
          if (!line.trim()) {
            isParsingStudents = false;
            continue;
          }

          // Regex to handle quotes around the name: "Last, First M.",Destination,Attendance
          const studentMatch = line.match(/^"([^"]+)",([^,]*),(.*)$/);
          if (studentMatch && currentTeacherId) {
            const studentName = studentMatch[1].trim();
            const destination = studentMatch[2].trim();
            const attendance = studentMatch[3].trim();

            // Check if student exists for this teacher
            const sq = query(
              collection(db, 'students'), 
              where('name', '==', studentName), 
              where('thirdPeriodTeacherId', '==', currentTeacherId)
            );
            const sSnapshot = await getDocs(sq);

            if (sSnapshot.empty) {
              await addDoc(collection(db, 'students'), {
                name: studentName,
                thirdPeriodTeacherId: currentTeacherId,
                notes: destination ? `Destination: ${destination}` : '',
                isAbsent: attendance !== ''
              });
              importedStudents++;
            }
          }
        }
      }

      setMessage({ text: `Successfully imported ${importedStudents} students and created ${importedTeachers} placeholder teachers.`, type: 'success' });
      setCsvText('');
    } catch (error: any) {
      console.error(error);
      setMessage({ text: error.message, type: 'error' });
    }
    setLoading(false);
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
              className="neo-button bg-neo-blue text-white px-6 py-3 w-full font-black uppercase disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Import Data'}
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
