import React, { useState, useEffect } from 'react';
import { 
  Home, Users, Calendar, BookOpen, AlertTriangle, FileText, 
  Bot, Settings, CheckCircle, Clock, Plus, BarChart2, ChevronRight, 
  Sparkles, Wifi, ShieldAlert, LogOut, Download, Search, Edit3, Trash2, 
  UserPlus, Filter, Upload, Layers, Key, User, Camera, Lock, Eye, EyeOff, 
  Printer, FileSpreadsheet, Database, RefreshCw, Menu, X, Save, Check,
  Activity, Award, BookMarked, TrendingUp, HelpCircle, Layers3
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isServerOnline, setIsServerOnline] = useState(false);

  // Authentication State
  const [currentUser, setCurrentUser] = useState(null);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);

  // Core Data Collections
  const [users, setUsers] = useState([]);
  const [classesList, setClassesList] = useState([]);
  const [students, setStudents] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState({});
  const [journals, setJournals] = useState([]);
  const [systemSettings, setSystemSettings] = useState({ geminiApiKey: '', schoolName: 'SMP NEGERI 2 BAJUIN', academicYear: '2026/2027' });

  // Teacher Feature States
  const [selectedClass, setSelectedClass] = useState('VII A');
  const [attendanceDate, setAttendanceDate] = useState('2026-10-11');
  const [currentAttendance, setCurrentAttendance] = useState({});
  const [journalTopic, setJournalTopic] = useState('');
  const [journalMethod, setJournalMethod] = useState('');
  const [journalNote, setJournalNote] = useState('');
  const [smartDraft, setSmartDraft] = useState('');
  const [journalFilterMonth, setJournalFilterMonth] = useState('ALL');
  const [mapClassFilter, setMapClassFilter] = useState('ALL');
  const [studentSearchTerm, setStudentSearchTerm] = useState('');

  // Admin Feature States
  const [newTeacher, setNewTeacher] = useState({ name: '', nip: '', subject: 'Bahasa Inggris', username: '', password: '', assignedClasses: ['VII A'] });
  const [newClass, setNewClass] = useState({ name: '', grade: 'VII', homeroomTeacher: '' });
  const [newStudent, setNewStudent] = useState({ name: '', nisn: '', class: 'VII A', gender: 'L' });

  // AI Assistant States
  const [aiSubject, setAiSubject] = useState('Bahasa Inggris');
  const [aiTopic, setAiTopic] = useState('Sapaan & Perkenalan Diri (Greeting & Introduction)');
  const [aiCondition, setAiCondition] = useState('Siswa Pasif & Malu Berbicara');
  const [aiRecommendations, setAiRecommendations] = useState(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  const [profileForm, setProfileForm] = useState({ name: '', phone: '', currentPassword: '', newPassword: '', avatar: '' });

  // Load school data only after a valid server session exists.
  const fetchBootstrapData = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/bootstrap`, { credentials: 'include' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Gagal memuat data aplikasi.');
      setUsers(data.users || []);
      setClassesList(data.classes || []);
      setStudents(data.students || []);
      setJournals(data.journals || []);
      if (data.settings) setSystemSettings(prev => ({ ...prev, ...data.settings, geminiApiKey: '' }));
      const attendanceMap = {};
      (data.attendanceRecords || []).forEach(r => {
        const key = `${r.class}_${r.date}`;
        if (!attendanceMap[key]) attendanceMap[key] = {};
        attendanceMap[key][r.student_id] = r.status;
      });
      setAttendanceRecords(attendanceMap);
      setIsServerOnline(true);
    } catch (err) {
      setIsServerOnline(false);
      setLoginError(err.message || 'Server tidak dapat dihubungi.');
    }
  };

  useEffect(() => {
    if (currentUser) fetchBootstrapData();
  }, [currentUser]);
  
  // Update attendance view for selected class/date
  useEffect(() => {
    const key = `${selectedClass}_${attendanceDate}`;
    if (attendanceRecords[key]) {
      setCurrentAttendance(attendanceRecords[key]);
    } else {
      const initial = {};
      students.filter(s => s.class === selectedClass).forEach(s => { initial[s.id] = 'PRESENT'; });
      setCurrentAttendance(initial);
    }
  }, [selectedClass, attendanceDate, students, attendanceRecords]);

  // Sync state after login
  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === 'TEACHER') {
        const assigned = currentUser.assignedClasses || [];
        if (assigned.length > 0 && assigned[0] !== 'ALL') {
          setSelectedClass(assigned[0]);
        }
        setAiSubject(currentUser.subject || 'Bahasa Inggris');
      }
      setProfileForm({
        name: currentUser.name,
        phone: '081234567890',
        currentPassword: '',
        newPassword: '',
        avatar: currentUser.avatar || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150'
      });
    }
  }, [currentUser]);

  // Login is server-authoritative; no client-side/demo credential fallback.
  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoadingAuth(true);
    setLoginError('');
    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Login gagal.');
      setCurrentUser(data.user);
      setActiveTab(data.user.role === 'ADMIN' ? 'admin_overview' : 'dashboard');
    } catch (err) {
      setLoginError(err.message || 'Server tidak dapat dihubungi. Pastikan backend berjalan.');
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch (err) {
      console.warn('Logout request failed:', err);
    } finally {
      setCurrentUser(null);
      setUsers([]);
      setClassesList([]);
      setStudents([]);
      setAttendanceRecords({});
      setJournals([]);
      setLoginUsername('');
      setLoginPassword('');
      setLoginError('');
      setActiveTab('dashboard');
    }
  };

  // Persist attendance first; update the UI only after server confirmation.
  const handleStatusChange = async (studentId, status) => {
    const updatedRecord = { ...currentAttendance, [studentId]: status };
    try {
      const response = await fetch(API_BASE_URL + '/attendance', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ className: selectedClass, date: attendanceDate, records: updatedRecord }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Presensi gagal disimpan.');
      setCurrentAttendance(updatedRecord);
      setAttendanceRecords(prev => ({ ...prev, [selectedClass + '_' + attendanceDate]: updatedRecord }));
    } catch (err) { alert(err.message || 'Presensi gagal disimpan.'); }
  };

  const handleMarkAllPresent = async () => {
    const updatedRecord = {};
    students.filter(s => s.class === selectedClass).forEach(s => { updatedRecord[s.id] = 'PRESENT'; });
    try {
      const response = await fetch(API_BASE_URL + '/attendance', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ className: selectedClass, date: attendanceDate, records: updatedRecord }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Presensi gagal disimpan.');
      setCurrentAttendance(updatedRecord);
      setAttendanceRecords(prev => ({ ...prev, [selectedClass + '_' + attendanceDate]: updatedRecord }));
    } catch (err) { alert(err.message || 'Presensi gagal disimpan.'); }
  };
  // Journal Handlers
  const handleAutoGenerateJournal = () => {
    if (!journalTopic) {
      alert("Silakan isi topik/materi pembelajaran terlebih dahulu!");
      return;
    }
    const draft = `Pembelajaran ${currentUser.subject} kelas ${selectedClass} pada ${attendanceDate} dengan materi "${journalTopic}" berlangsung interaktif menggunakan metode ${journalMethod || 'Diskusi & Praktik'}. Refleksi: ${journalNote || 'Siswa dapat mengikuti alur materi dengan pemahaman baik.'}`;
    setSmartDraft(draft);
  };

  const handleSaveJournal = async () => {
    if (!journalTopic.trim()) { alert('Harap masukkan topik pembelajaran!'); return; }
    try {
      const payload = { class: selectedClass, date: attendanceDate, topic: journalTopic.trim(), method: journalMethod || 'Tatap Muka Interaktif', pulse: 'VERY_ACTIVE', text: smartDraft || ('Materi: ' + journalTopic + '. ' + journalNote) };
      const response = await fetch(API_BASE_URL + '/journals', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Jurnal gagal disimpan.');
      await fetchBootstrapData();
      alert('Jurnal mengajar berhasil disimpan.');
      setJournalTopic(''); setJournalMethod(''); setJournalNote(''); setSmartDraft('');
    } catch (err) { alert(err.message || 'Jurnal gagal disimpan.'); }
  };
  // AI requests go through the backend so the API key never reaches the browser.
  const handleGenerateAiActivities = async () => {
    setIsGeneratingAi(true); setAiRecommendations(null);
    try {
      const response = await fetch(API_BASE_URL + '/ai/teaching-recommendations', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subject: aiSubject, topic: aiTopic, condition: aiCondition }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Rekomendasi AI gagal dibuat.');
      setAiRecommendations(data.recommendations);
    } catch (err) { alert(err.message || 'Layanan AI tidak tersedia.'); }
    finally { setIsGeneratingAi(false); }
  };
  // Admin Operations
  const handleSaveGeminiApiKey = async (e) => {
    e.preventDefault();
    alert('Demi keamanan, kunci Gemini harus dikonfigurasi pada environment backend oleh pengelola aplikasi.');
  };
  const handleAddTeacher = async (e) => {
    e.preventDefault();
    if (!newTeacher.name.trim() || !newTeacher.username.trim() || newTeacher.password.length < 12) { alert('Nama, username, dan password minimal 12 karakter wajib diisi.'); return; }
    try {
      const response = await fetch(API_BASE_URL + '/teachers', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newTeacher) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Akun guru gagal dibuat.');
      setUsers(prev => [...prev, data.user]);
      alert('Akun guru berhasil dibuat.');
      setNewTeacher({ name: '', nip: '', subject: 'Bahasa Inggris', username: '', password: '', assignedClasses: ['VII A'] });
    } catch (err) { alert(err.message || 'Akun guru gagal dibuat.'); }
  };
  const handleAddClass = async (e) => {
    e.preventDefault();
    if (!newClass.name.trim()) return;
    try {
      const response = await fetch(API_BASE_URL + '/classes', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newClass) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Kelas gagal ditambahkan.');
      setClassesList(prev => [...prev, { ...data.class, totalStudents: 0 }]);
      alert('Rombel kelas berhasil ditambahkan.');
      setNewClass({ name: '', grade: 'VII', homeroomTeacher: '' });
    } catch (err) { alert(err.message || 'Kelas gagal ditambahkan.'); }
  };
  const handleAddStudent = async (e) => {
    e.preventDefault();
    if (!newStudent.name.trim() || !newStudent.nisn.trim()) return;
    try {
      const response = await fetch(API_BASE_URL + '/students', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newStudent) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Siswa gagal ditambahkan.');
      setStudents(prev => [...prev, { ...data.student, attendanceRate: null, assignmentScore: null, statusFlag: 'GOOD' }]);
      alert('Data siswa berhasil disimpan.');
      setNewStudent({ name: '', nisn: '', class: 'VII A', gender: 'L' });
    } catch (err) { alert(err.message || 'Data siswa gagal disimpan.'); }
  };
  // Helper Lists
  const teacherAssignedClasses = currentUser?.role === 'TEACHER' ? (currentUser.assignedClasses || []) : classesList.map(c => c.name);
  const filteredStudents = students.filter(s => {
    if (currentUser?.role === 'TEACHER') {
      if (!teacherAssignedClasses.includes(s.class) && !teacherAssignedClasses.includes('ALL')) return false;
      if (mapClassFilter !== 'ALL' && s.class !== mapClassFilter) return false;
    } else {
      if (mapClassFilter !== 'ALL' && s.class !== mapClassFilter) return false;
    }
    return s.name.toLowerCase().includes(studentSearchTerm.toLowerCase()) || s.nisn.includes(studentSearchTerm);
  });

  // UNAUTHENTICATED - LOGIN PAGE
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
          <div className="bg-gradient-to-r from-blue-900 to-blue-800 p-8 text-white text-center relative">
            <h1 className="text-3xl font-black tracking-wider text-white">KELAS<span className="text-amber-400">+</span></h1>
            <p className="text-xs text-blue-200 mt-1 font-semibold">{systemSettings.schoolName}</p>
            <p className="text-[11px] text-blue-100 italic mt-3 bg-blue-950/40 py-1.5 px-3 rounded-full inline-block border border-blue-700/50">
              Sistem Informasi & Asisten Pengajaran Digital
            </p>
          </div>

          <form onSubmit={handleLogin} className="p-6 space-y-4">
            <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider text-center">Masuk ke Akun Anda</h2>

            {loginError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {loginError}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Username</label>
              <input
                type="text"
                placeholder="Masukkan Username..."
                value={loginUsername}
                onChange={e => setLoginUsername(e.target.value)}
                required
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-600 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Masukkan Password..."
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  required
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-600 font-medium pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoadingAuth}
              className="w-full py-3 bg-blue-800 hover:bg-blue-900 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2"
            >
              {isLoadingAuth ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Masuk Sekarang'}
            </button>

            <p className="pt-3 border-t border-slate-100 text-center text-[10px] text-slate-500">
              Gunakan akun yang dibuat oleh administrator sekolah.
            </p>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row font-sans text-slate-800">
      
      {/* Mobile Top Navigation */}
      <div className="lg:hidden bg-slate-900 text-white p-4 flex justify-between items-center border-b border-slate-800 sticky top-0 z-50">
        <div>
          <h1 className="text-xl font-black text-white">KELAS<span className="text-amber-400">+</span></h1>
          <p className="text-[9px] text-slate-400 tracking-wider">{systemSettings.schoolName}</p>
        </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-slate-300 hover:text-white">
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Main Sidebar */}
      <aside className={`w-full lg:w-64 bg-slate-900 text-white flex-shrink-0 flex flex-col justify-between ${mobileMenuOpen ? 'block' : 'hidden lg:flex'}`}>
        <div>
          <div className="hidden lg:flex p-5 border-b border-slate-800 items-center justify-between">
            <div>
              <h1 className="text-2xl font-black text-white">KELAS<span className="text-amber-400">+</span></h1>
              <p className="text-[10px] text-slate-400 tracking-wider uppercase">{systemSettings.schoolName}</p>
            </div>
            <span className={`w-2.5 h-2.5 rounded-full ${isServerOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} title={isServerOnline ? 'Server Live' : 'Local Mode'}></span>
          </div>

          <nav className="p-3 space-y-1 text-sm font-medium">
            {currentUser.role === 'TEACHER' && (
              <>
                <button onClick={() => { setActiveTab('dashboard'); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition ${activeTab === 'dashboard' ? 'bg-blue-800 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'}`}>
                  <Home className="w-4 h-4 text-amber-400" /> Dashboard Guru
                </button>
                <button onClick={() => { setActiveTab('classes'); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition ${activeTab === 'classes' ? 'bg-blue-800 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'}`}>
                  <BookOpen className="w-4 h-4 text-blue-400" /> Kelas Saya
                </button>
                <button onClick={() => { setActiveTab('attendance'); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition ${activeTab === 'attendance' ? 'bg-blue-800 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'}`}>
                  <CheckCircle className="w-4 h-4 text-emerald-400" /> Absensi Cepat
                </button>
                <button onClick={() => { setActiveTab('journal'); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition ${activeTab === 'journal' ? 'bg-blue-800 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'}`}>
                  <FileText className="w-4 h-4 text-purple-400" /> Smart Journal
                </button>
                <button onClick={() => { setActiveTab('students'); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition ${activeTab === 'students' ? 'bg-blue-800 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'}`}>
                  <Users className="w-4 h-4 text-amber-400" /> Learning Map
                </button>
                <button onClick={() => { setActiveTab('ai'); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition ${activeTab === 'ai' ? 'bg-blue-800 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'}`}>
                  <Bot className="w-4 h-4 text-cyan-400" /> AI Assistant
                </button>
                <button onClick={() => { setActiveTab('settings'); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition ${activeTab === 'settings' ? 'bg-blue-800 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'}`}>
                  <Settings className="w-4 h-4 text-slate-400" /> Pengaturan Profil
                </button>
              </>
            )}

            {currentUser.role === 'ADMIN' && (
              <>
                <button onClick={() => { setActiveTab('admin_overview'); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition ${activeTab === 'admin_overview' ? 'bg-blue-800 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'}`}>
                  <BarChart2 className="w-4 h-4 text-emerald-400" /> Dashboard Performa
                </button>
                <button onClick={() => { setActiveTab('admin_teachers'); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition ${activeTab === 'admin_teachers' ? 'bg-blue-800 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'}`}>
                  <Users className="w-4 h-4 text-amber-400" /> Manajemen Guru
                </button>
                <button onClick={() => { setActiveTab('admin_classes'); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition ${activeTab === 'admin_classes' ? 'bg-blue-800 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'}`}>
                  <Layers className="w-4 h-4 text-purple-400" /> Tambah Rombel Kelas
                </button>
                <button onClick={() => { setActiveTab('admin_students'); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition ${activeTab === 'admin_students' ? 'bg-blue-800 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'}`}>
                  <UserPlus className="w-4 h-4 text-cyan-400" /> Data Siswa & Import
                </button>
                <button onClick={() => { setActiveTab('admin_api'); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition ${activeTab === 'admin_api' ? 'bg-blue-800 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'}`}>
                  <Key className="w-4 h-4 text-amber-400" /> Google API Key
                </button>
                <button onClick={() => { setActiveTab('settings'); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition ${activeTab === 'settings' ? 'bg-blue-800 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'}`}>
                  <Settings className="w-4 h-4 text-slate-400" /> Pengaturan Admin
                </button>
              </>
            )}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={currentUser.avatar} alt="Profile" className="w-8 h-8 rounded-full object-cover border border-slate-700" />
            <div>
              <p className="text-xs font-bold text-white leading-tight">{currentUser.name}</p>
              <p className="text-[10px] text-slate-400">{currentUser.subject}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition" title="Keluar">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Dynamic Content Views */}
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
        
        {/* TEACHER - DASHBOARD */}
        {currentUser.role === 'TEACHER' && activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-black text-slate-900">Selamat datang, {currentUser.name}! 👋</h1>
                <p className="text-xs text-slate-500 mt-1">Sistem Informasi Pengajaran SMPN 2 Bajuin | Tahun 2026/2027</p>
              </div>
              <button onClick={() => setActiveTab('attendance')} className="px-4 py-2 bg-blue-800 text-white text-xs font-bold rounded-xl shadow-sm hover:bg-blue-900 transition flex items-center gap-2">
                <CheckCircle className="w-4 h-4" /> Input Presensi Hari Ini
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs text-slate-500 font-medium">Kelas Pengampuan</span>
                <p className="text-2xl font-black text-blue-800 mt-1">{teacherAssignedClasses.length} Kelas</p>
                <p className="text-[10px] text-emerald-600 font-bold mt-1">✓ {teacherAssignedClasses.join(', ')}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs text-slate-500 font-medium">Rata-rata Kehadiran</span>
                <p className="text-2xl font-black text-emerald-600 mt-1">96.5%</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs text-slate-500 font-medium">Jurnal Terisi</span>
                <p className="text-2xl font-black text-purple-600 mt-1">{journals.length} Jurnal</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs text-slate-500 font-medium">Status API Gemini</span>
                <p className="text-2xl font-black text-amber-500 mt-1">{systemSettings.geminiApiKey ? 'Aktif' : 'Standar'}</p>
              </div>
            </div>
          </div>
        )}

        {/* TEACHER - KELAS SAYA */}
        {currentUser.role === 'TEACHER' && activeTab === 'classes' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-black text-slate-900">Kelas Saya</h1>
              <p className="text-xs text-slate-500 mt-1">Daftar kelas yang ditugaskan untuk diajar</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {classesList.filter(c => teacherAssignedClasses.includes(c.name) || teacherAssignedClasses.includes('ALL')).map(cls => (
                <div key={cls.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="px-2.5 py-1 bg-blue-50 text-blue-800 text-[10px] font-bold rounded-lg border border-blue-200">Tingkat {cls.grade}</span>
                      <h2 className="text-xl font-bold text-slate-800 mt-2">Kelas {cls.name}</h2>
                      <p className="text-xs text-slate-500">Wali Kelas: {cls.homeroomTeacher}</p>
                    </div>
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md">{cls.totalStudents} Siswa</span>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex gap-2">
                    <button onClick={() => { setSelectedClass(cls.name); setActiveTab('attendance'); }} className="flex-1 py-2 bg-blue-800 text-white text-xs font-bold rounded-xl hover:bg-blue-900 transition">
                      Absensi
                    </button>
                    <button onClick={() => { setSelectedClass(cls.name); setActiveTab('journal'); }} className="flex-1 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 transition">
                      Jurnal
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TEACHER - ABSENSI CEPT */}
        {currentUser.role === 'TEACHER' && activeTab === 'attendance' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-black text-slate-900">Absensi Cepat & Rekap Presensi</h1>
                <p className="text-xs text-slate-500 mt-1">Pilih tanggal dan kelola kehadiran siswa</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold shadow-sm">
                  {teacherAssignedClasses.map(c => <option key={c} value={c}>Kelas {c}</option>)}
                </select>
                <input
                  type="date"
                  value={attendanceDate}
                  onChange={e => setAttendanceDate(e.target.value)}
                  className="p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold shadow-sm"
                />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
              <div className="p-4 bg-slate-50 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-700">Presensi Kelas {selectedClass} — Tanggal: {attendanceDate}</span>
                <button onClick={handleMarkAllPresent} className="px-3.5 py-1.5 bg-blue-50 text-blue-800 text-xs font-bold rounded-xl border border-blue-200 hover:bg-blue-100 transition">
                  ✓ Tandai Semua Hadir
                </button>
              </div>

              {students.filter(s => s.class === selectedClass).map((std, idx) => (
                <div key={std.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-slate-400 w-6">{idx + 1}.</span>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{std.name}</p>
                      <p className="text-xs text-slate-400">NISN: {std.nisn} | Gender: {std.gender}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                    {['PRESENT', 'SICK', 'EXCUSED', 'ABSENT'].map(st => {
                      const isActive = currentAttendance[std.id] === st;
                      const label = { PRESENT: 'Hadir', SICK: 'Sakit', EXCUSED: 'Izin', ABSENT: 'Alpa' }[st];
                      let activeStyle = '';
                      if (st === 'PRESENT') activeStyle = 'bg-emerald-600 text-white font-bold shadow-sm';
                      if (st === 'SICK') activeStyle = 'bg-amber-500 text-white font-bold shadow-sm';
                      if (st === 'EXCUSED') activeStyle = 'bg-blue-600 text-white font-bold shadow-sm';
                      if (st === 'ABSENT') activeStyle = 'bg-rose-600 text-white font-bold shadow-sm';

                      return (
                        <button
                          key={st}
                          onClick={() => handleStatusChange(std.id, st)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${isActive ? activeStyle : 'text-slate-600 hover:bg-slate-200'}`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TEACHER - SMART JOURNAL */}
        {currentUser.role === 'TEACHER' && activeTab === 'journal' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-black text-slate-900">Smart Journal & Library</h1>
              <p className="text-xs text-slate-500 mt-1">Isi jurnal mengajar harian dan telusuri arsip jurnal</p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Form Jurnal Mengajar Baru</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold">
                  {teacherAssignedClasses.map(c => <option key={c} value={c}>Kelas {c}</option>)}
                </select>
                <input type="text" value={journalTopic} onChange={e => setJournalTopic(e.target.value)} placeholder="Topik / Materi Pembelajaran..." className="p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs" />
                <input type="text" value={journalMethod} onChange={e => setJournalMethod(e.target.value)} placeholder="Metode (Diskusi/Role-play)..." className="p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs" />
              </div>

              <textarea rows={2} value={journalNote} onChange={e => setJournalNote(e.target.value)} placeholder="Catatan khusus respon siswa..." className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-600" />

              <div className="flex flex-col sm:flex-row gap-2 justify-between">
                <button onClick={handleAutoGenerateJournal} className="px-4 py-2 bg-blue-50 text-blue-800 text-xs font-bold rounded-xl border border-blue-200 hover:bg-blue-100 flex items-center justify-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600" /> Auto-Generate Draf
                </button>
                <button onClick={handleSaveJournal} className="px-5 py-2 bg-blue-800 text-white text-xs font-bold rounded-xl shadow-sm hover:bg-blue-900 flex items-center justify-center gap-2">
                  <Save className="w-4 h-4" /> Simpan Jurnal
                </button>
              </div>

              {smartDraft && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                  <p className="font-bold text-blue-800">Draf Rangkuman:</p>
                  <p className="text-slate-700">{smartDraft}</p>
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Arsip Jurnal Mengajar</h2>
              <div className="space-y-3">
                {journals.map(j => (
                  <div key={j.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-blue-800">Kelas {j.class} — {j.date}</span>
                      <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">{j.method}</span>
                    </div>
                    <p className="text-sm font-bold text-slate-800">{j.topic}</p>
                    <p className="text-xs text-slate-600">{j.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TEACHER - LEARNING MAP */}
        {currentUser.role === 'TEACHER' && activeTab === 'students' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-black text-slate-900">Student Learning Map</h1>
                <p className="text-xs text-slate-500 mt-1">Pemantauan pencapaian akademik dan karakter siswa</p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Cari nama siswa..."
                  value={studentSearchTerm}
                  onChange={e => setStudentSearchTerm(e.target.value)}
                  className="p-2 bg-white border border-slate-300 rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[500px]">
                <thead className="bg-slate-100 text-slate-600 font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th className="p-3">Nama Siswa</th>
                    <th className="p-3">Kelas</th>
                    <th className="p-3 text-center">Tingkat Kehadiran</th>
                    <th className="p-3 text-center">Nilai Tugas</th>
                    <th className="p-3 text-center">Status Pemantauan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.map(std => (
                    <tr key={std.id} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-800">{std.name}</td>
                      <td className="p-3 font-bold text-blue-800">{std.class}</td>
                      <td className="p-3 text-center font-mono">{std.attendanceRate}%</td>
                      <td className="p-3 text-center font-mono">{std.assignmentScore}</td>
                      <td className="p-3 text-center">
                        {std.statusFlag === 'GOOD' && <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">🟢 Sangat Baik</span>}
                        {std.statusFlag === 'NEEDS_FOLLOW_UP' && <span className="px-2.5 py-1 bg-rose-100 text-rose-800 text-[10px] font-bold rounded-full">⚠️ Pendampingan</span>}
                        {std.statusFlag === 'MONITOR' && <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full">🟡 Pemantauan</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TEACHER - AI TEACHING ASSISTANT */}
        {currentUser.role === 'TEACHER' && activeTab === 'ai' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                <Bot className="w-6 h-6 text-cyan-600" /> AI Teaching Assistant Real-Time
              </h1>
              <p className="text-xs text-slate-500 mt-1">Rekomendasi skenario mengajar interaktif berbasis Google Gemini AI</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h2 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Parameter Kelas</h2>
                
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Mata Pelajaran</label>
                  <input type="text" value={aiSubject} onChange={e => setAiSubject(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Materi / Topik</label>
                  <input type="text" value={aiTopic} onChange={e => setAiTopic(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Kondisi Kelas</label>
                  <select value={aiCondition} onChange={e => setAiCondition(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs">
                    <option value="Siswa Pasif & Malu Berbicara">Siswa Pasif & Malu Berbicara</option>
                    <option value="Siswa Sangat Aktif & Gaduh">Siswa Sangat Aktif & Gaduh</option>
                    <option value="Pemahaman Konsep Masih Rendah">Pemahaman Konsep Masih Rendah</option>
                  </select>
                </div>

                <button
                  onClick={handleGenerateAiActivities}
                  disabled={isGeneratingAi}
                  className="w-full py-3 bg-blue-800 hover:bg-blue-900 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4 text-amber-400" /> {isGeneratingAi ? 'Gemini AI Menyusun Skenario...' : 'Eksekusi Gemini AI'}
                </button>
              </div>

              <div className="md:col-span-2 space-y-4">
                {aiRecommendations ? (
                  aiRecommendations.map((item) => (
                    <div key={item.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-1 bg-blue-50 text-blue-800 font-bold text-[10px] rounded-lg border border-blue-200">{item.type}</span>
                        <span className="text-xs font-bold text-slate-400 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {item.duration}</span>
                      </div>
                      <h3 className="text-base font-bold text-slate-800">{item.title}</h3>
                      <p className="text-xs text-slate-600">{item.objective}</p>
                      {item.steps && (
                        <div className="pt-2 border-t border-slate-100">
                          <p className="text-[11px] font-bold text-slate-700 mb-1">Langkah Pelaksanaan:</p>
                          <ol className="list-decimal list-inside text-xs text-slate-600 space-y-1">
                            {item.steps.map((st, i) => <li key={i}>{st}</li>)}
                          </ol>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400 space-y-2">
                    <Bot className="w-12 h-12 mx-auto text-slate-300" />
                    <p className="text-sm font-medium">Klik "Eksekusi Gemini AI" untuk mendapatkan skenario mengajar.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ADMIN - OVERVIEW */}
        {currentUser.role === 'ADMIN' && activeTab === 'admin_overview' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-black text-slate-900">Dashboard Performa Sekolah</h1>
              <p className="text-xs text-slate-500 mt-1">Ringkasan status akademik dan penggunaan sistem</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs text-slate-500 font-medium">Total Guru</span>
                <p className="text-2xl font-black text-blue-800 mt-1">{users.filter(u => u.role === 'TEACHER').length} Guru</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs text-slate-500 font-medium">Total Rombel</span>
                <p className="text-2xl font-black text-purple-600 mt-1">{classesList.length} Kelas</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs text-slate-500 font-medium">Total Siswa</span>
                <p className="text-2xl font-black text-emerald-600 mt-1">{students.length} Siswa</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs text-slate-500 font-medium">Kehadiran Rata-rata</span>
                <p className="text-2xl font-black text-amber-500 mt-1">96.8%</p>
              </div>
            </div>
          </div>
        )}

        {/* ADMIN - MANAJEMEN GURU */}
        {currentUser.role === 'ADMIN' && activeTab === 'admin_teachers' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-blue-800" /> Tambah Akun Guru Baru
              </h2>
              <form onSubmit={handleAddTeacher} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input type="text" placeholder="Nama Guru & Gelar" value={newTeacher.name} onChange={e => setNewTeacher({...newTeacher, name: e.target.value})} className="p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs" required />
                <input type="text" placeholder="NIP" value={newTeacher.nip} onChange={e => setNewTeacher({...newTeacher, nip: e.target.value})} className="p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs" />
                <input type="text" placeholder="Mata Pelajaran" value={newTeacher.subject} onChange={e => setNewTeacher({...newTeacher, subject: e.target.value})} className="p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs" required />
                <input type="text" placeholder="Username Login" value={newTeacher.username} onChange={e => setNewTeacher({...newTeacher, username: e.target.value})} className="p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs" required />
                <input type="password" placeholder="Password Login" value={newTeacher.password} onChange={e => setNewTeacher({...newTeacher, password: e.target.value})} className="p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs" required />
                
                <button type="submit" className="py-2.5 bg-blue-800 text-white font-bold text-xs rounded-xl shadow-sm hover:bg-blue-900 transition">
                  + Simpan Guru
                </button>
              </form>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[500px]">
                <thead className="bg-slate-100 text-slate-600 font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th className="p-3">Nama Guru</th>
                    <th className="p-3">Mata Pelajaran</th>
                    <th className="p-3">Username</th>
                    <th className="p-3">Kelas Pengampuan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.filter(u => u.role === 'TEACHER').map(t => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-800">{t.name}</td>
                      <td className="p-3 font-bold text-blue-800">{t.subject}</td>
                      <td className="p-3 font-mono text-purple-700">{t.username}</td>
                      <td className="p-3 font-bold text-emerald-600">{(t.assignedClasses || []).join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ADMIN - ROMBEL KELAS */}
        {currentUser.role === 'ADMIN' && activeTab === 'admin_classes' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Tambah Rombel Kelas Baru</h2>
              <form onSubmit={handleAddClass} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <input type="text" placeholder="Nama Kelas (VII C)" value={newClass.name} onChange={e => setNewClass({...newClass, name: e.target.value})} className="p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs" required />
                <select value={newClass.grade} onChange={e => setNewClass({...newClass, grade: e.target.value})} className="p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold">
                  <option value="VII">Tingkat VII</option>
                  <option value="VIII">Tingkat VIII</option>
                  <option value="IX">Tingkat IX</option>
                </select>
                <input type="text" placeholder="Nama Wali Kelas" value={newClass.homeroomTeacher} onChange={e => setNewClass({...newClass, homeroomTeacher: e.target.value})} className="p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs" />
                <button type="submit" className="py-2.5 bg-blue-800 text-white font-bold text-xs rounded-xl shadow-sm hover:bg-blue-900 transition">
                  + Simpan Rombel
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ADMIN - DATA SISWA */}
        {currentUser.role === 'ADMIN' && activeTab === 'admin_students' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Tambah Data Siswa Baru</h2>
              <form onSubmit={handleAddStudent} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <input type="text" placeholder="Nama Siswa" value={newStudent.name} onChange={e => setNewStudent({...newStudent, name: e.target.value})} className="p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs" required />
                <input type="text" placeholder="NISN" value={newStudent.nisn} onChange={e => setNewStudent({...newStudent, nisn: e.target.value})} className="p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs" required />
                <select value={newStudent.class} onChange={e => setNewStudent({...newStudent, class: e.target.value})} className="p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold">
                  <option value="VII A">Kelas VII A</option>
                  <option value="VII B">Kelas VII B</option>
                  <option value="VIII A">Kelas VIII A</option>
                </select>
                <button type="submit" className="py-2.5 bg-blue-800 text-white font-bold text-xs rounded-xl shadow-sm hover:bg-blue-900 transition">
                  + Simpan Siswa
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ADMIN - GEMINI API KEY */}
        {currentUser.role === 'ADMIN' && activeTab === 'admin_api' && (
          <div className="space-y-6 max-w-2xl">
            <div>
              <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                <Key className="w-6 h-6 text-amber-500" /> Central Google Gemini API Key
              </h1>
              <p className="text-xs text-slate-500 mt-1">Pengaturan API Key Gemini terpusat untuk seluruh Guru</p>
            </div>

            <form onSubmit={handleSaveGeminiApiKey} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Google Gemini API Key</label>
                <input
                  type="password"
                  placeholder="AIzaSy..."
                  value={systemSettings.geminiApiKey || ''}
                  onChange={e => setSystemSettings({ ...systemSettings, geminiApiKey: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <button type="submit" className="py-2.5 px-6 bg-blue-800 text-white font-bold text-xs rounded-xl hover:bg-blue-900 transition">
                Simpan API Key Terpusat
              </button>
            </form>
          </div>
        )}

        {/* PROFILE SETTINGS */}
        {activeTab === 'settings' && (
          <div className="space-y-6 max-w-2xl">
            <div>
              <h1 className="text-2xl font-black text-slate-900">Pengaturan Akun & Profil</h1>
              <p className="text-xs text-slate-500 mt-1">Kelola data informasi akun Anda</p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  value={profileForm.name}
                  disabled
                  className="w-full p-2.5 bg-slate-100 text-slate-600 border border-slate-300 rounded-xl text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Status Peran</label>
                <input
                  type="text"
                  value={currentUser.role}
                  disabled
                  className="w-full p-2.5 bg-slate-100 text-slate-600 border border-slate-300 rounded-xl text-xs font-bold"
                />
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
