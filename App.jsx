import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { auth, firebaseConfigured } from './firebase.js';
import { signInWithCustomToken, signOut } from 'firebase/auth';
import { 
  Home, Users, Calendar, BookOpen, AlertTriangle, FileText, ClipboardCheck, 
  Bot, Settings, CheckCircle, Clock, Plus, BarChart2, ChevronRight, 
  Sparkles, Wifi, ShieldAlert, LogOut, Download, Search, Edit3, Trash2, 
  UserPlus, Filter, Upload, Layers, Key, User, Camera, Lock, Eye, EyeOff, 
  Printer, FileSpreadsheet, Database, RefreshCw, Menu, X, Save, Check,
  Activity, Award, BookMarked, TrendingUp, HelpCircle, Layers3, Bell, BellRing, MessageCircle, Mail, Send
} from 'lucide-react';
import firebaseApp from './firebase.js';
import { getMessaging, getToken } from 'firebase/messaging';


const APP_VERSION = '2.4.0';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
const localDateString = (date = new Date()) => date.getFullYear() + '-' + String(date.getMonth()+1).padStart(2,'0') + '-' + String(date.getDate()).padStart(2,'0');
const SUBJECT_OPTIONS = ['Pendidikan Agama dan Budi Pekerti','Pendidikan Pancasila','Bahasa Indonesia','Matematika','Ilmu Pengetahuan Alam','Ilmu Pengetahuan Sosial','Bahasa Inggris','Pendidikan Jasmani, Olahraga, dan Kesehatan','Informatika','Seni Budaya','Prakarya','Muatan Lokal','Bimbingan dan Konseling','Bahasa Arab','Bahasa Daerah'];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [toastNotice, setToastNotice] = useState(null);
  const [toastFading, setToastFading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isServerOnline, setIsServerOnline] = useState(false);

  // Authentication State
  const [currentUser, setCurrentUser] = useState(null);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Core Data Collections
  const [users, setUsers] = useState([]);
  const [classesList, setClassesList] = useState([]);
  const [students, setStudents] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState({});
  const [journals, setJournals] = useState([]);
  const [assignmentScores, setAssignmentScores] = useState([]);
  const [assignmentTasks, setAssignmentTasks] = useState([]);
  const [reportClass, setReportClass] = useState('');
  const [reportFromDate, setReportFromDate] = useState('2026-10-01');
  const [reportToDate, setReportToDate] = useState('2026-10-11');
  const [attendanceSaveStatus, setAttendanceSaveStatus] = useState('saved');
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [savingGradesFor, setSavingGradesFor] = useState('');
  const [gradeDrafts, setGradeDrafts] = useState({});
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [chatMessages, setChatMessages] = useState([{ role: 'assistant', text: 'Halo! Saya robot bantuan KELAS+. Saya bisa membantu menjelaskan cara memakai fitur aplikasi. Silakan tanyakan tentang absensi, jurnal, Learning Map, nilai, atau laporan.' }]);
  const [savingAllGrades, setSavingAllGrades] = useState(false);
  const [systemSettings, setSystemSettings] = useState({ geminiApiKey: '', schoolName: 'UPTD SMPN 2 BAJUIN', academicYear: '2026/2027', schoolAddress: '', schoolPhone: '', schoolEmail: '', principalName: '', principalNip: '', letterheadSubtitle: 'Sistem Informasi Manajemen Pembelajaran dan Rekapitulasi Kelas' });
  const [letterheadForm, setLetterheadForm] = useState({ schoolName: 'UPTD SMPN 2 BAJUIN', schoolAddress: '', schoolPhone: '', schoolEmail: '', academicYear: '2026/2027', principalName: '', principalNip: '', letterheadSubtitle: 'Sistem Informasi Manajemen Pembelajaran dan Rekapitulasi Kelas' });
  const [letterheadSaving, setLetterheadSaving] = useState(false);
  const [letterheadNotice, setLetterheadNotice] = useState('');
  const [adminStudentClassFilter, setAdminStudentClassFilter] = useState('ALL');
  const [adminStudentSearch, setAdminStudentSearch] = useState('');
  const [scheduleFilterClass, setScheduleFilterClass] = useState('ALL');
  const [scheduleFilterTeacher, setScheduleFilterTeacher] = useState('ALL');
  const [followUps, setFollowUps] = useState([]);
  const [followUpSaving, setFollowUpSaving] = useState(false);
  const [followUpNotice, setFollowUpNotice] = useState('');
  const [followUpSearch, setFollowUpSearch] = useState('');
  const [followUpForm, setFollowUpForm] = useState({ studentId: '', date: localDateString(), category: 'Kehadiran rendah', action: '', result: '', nextStep: '', notes: '', status: 'MONITORING' });

  // Teacher Feature States
  const [selectedClass, setSelectedClass] = useState('VII A');
  const [attendanceDate, setAttendanceDate] = useState(() => localDateString());
  const [currentAttendance, setCurrentAttendance] = useState({});
  const [journalTopic, setJournalTopic] = useState('');
  const [journalMethod, setJournalMethod] = useState('');
  const [journalNote, setJournalNote] = useState('');
  const [smartDraft, setSmartDraft] = useState('');
  const [journalFilterMonth, setJournalFilterMonth] = useState('ALL');
  const [mapClassFilter, setMapClassFilter] = useState('ALL');
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [learningTaskCount, setLearningTaskCount] = useState(4);
  const [adminStudentPageSize, setAdminStudentPageSize] = useState(10);
  const [adminStudentPage, setAdminStudentPage] = useState(1);

  // Teaching schedule and browser push notification state
  const [schedules, setSchedules] = useState([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [selectedScheduleDay, setSelectedScheduleDay] = useState(() => String((new Date().getDay() + 6) % 7 + 1));
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ teacherId: '', classId: '', subject: 'Bahasa Inggris', dayOfWeek: '1', startTime: '07:30', endTime: '08:10', room: '' });
  const [notificationStatus, setNotificationStatus] = useState('idle');
  const [notificationMessage, setNotificationMessage] = useState('');
  const [announcements, setAnnouncements] = useState([]);
  const [announcementForm, setAnnouncementForm] = useState({ title: '', message: '', type: 'info', pinned: true, expiresAt: '' });
  const [announcementSaving, setAnnouncementSaving] = useState(false);
  const [announcementNotice, setAnnouncementNotice] = useState('');

  // Admin Feature States
  const [newTeacher, setNewTeacher] = useState({ name: '', nip: '', subject: 'Bahasa Inggris', username: '', password: '', assignedClasses: [] });
  const [newClass, setNewClass] = useState({ name: '', grade: 'VII', homeroomTeacher: '' });
  const [newStudent, setNewStudent] = useState({ name: '', nisn: '', class: 'VII A', gender: 'L' });
  const [studentImportRows, setStudentImportRows] = useState([]);
  const [studentImportFileName, setStudentImportFileName] = useState('');
  const [studentImportBusy, setStudentImportBusy] = useState(false);

  // AI Assistant States
  const [aiSubject, setAiSubject] = useState('Bahasa Inggris');
  const [aiTopic, setAiTopic] = useState('Sapaan & Perkenalan Diri (Greeting & Introduction)');
  const [aiCondition, setAiCondition] = useState('Siswa Pasif & Malu Berbicara');
  const [aiRecommendations, setAiRecommendations] = useState(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  const [profileForm, setProfileForm] = useState({ name: '', phone: '', currentPassword: '', newPassword: '', avatar: '' });
  const [deviceNow, setDeviceNow] = useState(() => new Date());

  const fetchStudentFollowUps = async () => {
    try { const response = await fetch(API_BASE_URL + '/student-follow-ups', { credentials: 'include' }); const data = await response.json(); if (!response.ok || !data.success) throw new Error(data.message || 'Riwayat tindak lanjut gagal dimuat.'); setFollowUps(data.followUps || []); }
    catch (error) { console.warn('Gagal memuat tindak lanjut siswa:', error); }
  };

  const handleSaveLetterhead = async (event) => {
    event.preventDefault(); setLetterheadSaving(true); setLetterheadNotice('');
    try { const response = await fetch(API_BASE_URL + '/settings/letterhead', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(letterheadForm) }); const data = await response.json(); if (!response.ok || !data.success) throw new Error(data.message || 'Pengaturan kop surat gagal disimpan.'); setSystemSettings(prev => ({ ...prev, ...data.settings })); setLetterheadForm(prev => ({ ...prev, ...data.settings })); setLetterheadNotice('Pengaturan kop surat berhasil disimpan dan akan digunakan pada laporan berikutnya.'); }
    catch (error) { setLetterheadNotice(error.message || 'Pengaturan gagal disimpan.'); } finally { setLetterheadSaving(false); }
  };

  const handleSaveFollowUp = async (event) => {
    event.preventDefault(); setFollowUpSaving(true); setFollowUpNotice('');
    try { const response = await fetch(API_BASE_URL + '/student-follow-ups', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(followUpForm) }); const data = await response.json(); if (!response.ok || !data.success) throw new Error(data.message || 'Tindak lanjut gagal disimpan.'); setFollowUps(prev => [data.followUp, ...prev]); setFollowUpForm({ studentId: '', date: localDateString(), category: 'Kehadiran rendah', action: '', result: '', nextStep: '', notes: '', status: 'MONITORING' }); setFollowUpNotice('Catatan tindak lanjut berhasil disimpan.'); }
    catch (error) { setFollowUpNotice(error.message || 'Tindak lanjut gagal disimpan.'); } finally { setFollowUpSaving(false); }
  };

  const fetchAnnouncements = async () => {
    try {
      const response = await fetch(API_BASE_URL + '/announcements', { credentials: 'include' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Pengumuman tidak dapat dimuat.');
      setAnnouncements(data.announcements || []);
    } catch (error) { console.warn('Gagal memuat pengumuman:', error); }
  };
  const handleSaveAnnouncement = async (event) => {
    event.preventDefault(); setAnnouncementSaving(true); setAnnouncementNotice('');
    try {
      const response = await fetch(API_BASE_URL + '/announcements', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...announcementForm, expiresAt: announcementForm.expiresAt ? new Date(announcementForm.expiresAt + 'T23:59:59').toISOString() : '' }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Pengumuman gagal disimpan.');
      setAnnouncements(items => [data.announcement, ...items]); setAnnouncementForm({ title: '', message: '', type: 'info', pinned: true, expiresAt: '' }); setAnnouncementNotice('Pengumuman berhasil diterbitkan.');
    } catch (error) { setAnnouncementNotice(error.message || 'Pengumuman gagal disimpan.'); } finally { setAnnouncementSaving(false); }
  };
  const handleDeleteAnnouncement = async (announcement) => {
    if (!window.confirm('Nonaktifkan pengumuman ini?')) return;
    try { const response = await fetch(API_BASE_URL + '/announcements/' + encodeURIComponent(announcement.id), { method: 'DELETE', credentials: 'include' }); const data = await response.json(); if (!response.ok || !data.success) throw new Error(data.message || 'Pengumuman gagal dinonaktifkan.'); setAnnouncements(items => items.filter(item => item.id !== announcement.id)); }
    catch (error) { setAnnouncementNotice(error.message || 'Pengumuman gagal dinonaktifkan.'); }
  };

  // Load school data only after a valid server session exists.
  // Session-scoped cache gives an instant first paint without persisting student data after the tab closes.
  const fetchBootstrapData = async () => {
    const cacheKey = currentUser?.id ? `kelasplus.bootstrap.v1.${currentUser.id}` : '';
    const applyBootstrap = data => {
      setUsers(data.users || []);
      setClassesList(data.classes || []);
      setStudents(data.students || []);
      setJournals(data.journals || []);
      setAssignmentScores(data.assignmentScores || []);
      setAssignmentTasks(data.assignmentTasks || []);
      setLearningTaskCount(Math.max(0, ...(data.assignmentTasks || []).filter(t => t.teacherId === currentUser?.id).map(t => Number(t.assignmentNo) || 0)));
      const drafts = {};
      (data.assignmentScores || []).forEach(g => { drafts[g.studentId] = { ...(drafts[g.studentId] || {}), [g.assignmentNo]: g.score == null ? '' : String(g.score) }; });
      setGradeDrafts(drafts);
      if (data.settings) { setSystemSettings(prev => ({ ...prev, ...data.settings, geminiApiKey: '' })); setLetterheadForm(prev => ({ ...prev, ...data.settings })); }
      const attendanceMap = {};
      (data.attendanceRecords || []).forEach(r => {
        const key = `${r.class}_${r.date}`;
        if (!attendanceMap[key]) attendanceMap[key] = {};
        attendanceMap[key][r.student_id] = r.status;
      });
      setAttendanceRecords(attendanceMap);
    };
    let cachedData = null;
    if (cacheKey) {
      try {
        const raw = window.sessionStorage.getItem(cacheKey);
        const entry = raw ? JSON.parse(raw) : null;
        if (entry?.savedAt && Date.now() - entry.savedAt < 2 * 60 * 1000 && entry.data?.success) {
          cachedData = entry.data;
          applyBootstrap(cachedData);
        } else if (raw) window.sessionStorage.removeItem(cacheKey);
      } catch (error) { console.warn('Cache data lokal tidak dapat dibaca:', error); }
    }
    try {
      const response = await fetch(`${API_BASE_URL}/bootstrap`, { credentials: 'include', cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Gagal memuat data aplikasi.');
      applyBootstrap(data);
      if (cacheKey) {
        try { window.sessionStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), data })); }
        catch (error) { console.warn('Cache lokal penuh atau tidak tersedia:', error); }
      }
      setIsServerOnline(true);
    } catch (err) {
      setIsServerOnline(false);
      if (!cachedData) setLoginError(err.message || 'Server tidak dapat dihubungi.');
      else setToastNotice({ type: 'warning', message: 'Menampilkan data tersimpan sementara. Periksa koneksi untuk memperbarui data.' });
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetch(API_BASE_URL + '/auth/me', { credentials: 'include' })
      .then(response => response.ok ? response.json() : null)
      .then(data => { if (!cancelled && data && data.success) { const user = data.user; setCurrentUser(user); const savedTab = window.sessionStorage.getItem('kelasplus.activeTab'); const roleTabs = user.role === 'ADMIN' ? ['admin_overview','admin_users','admin_teachers','admin_classes','admin_students','announcements','admin_api','schedule','settings'] : user.role === 'LEADER' ? ['leader_overview','schedule','students','admin_teachers','admin_classes','admin_students','leader_followups','reports','settings'] : ['dashboard','classes','attendance','journal','students','reports','ai','schedule','settings']; setActiveTab(roleTabs.includes(savedTab) ? savedTab : user.role === 'ADMIN' ? 'admin_overview' : user.role === 'LEADER' ? 'leader_overview' : 'dashboard'); } })
      .catch(() => { if (!cancelled) setIsServerOnline(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (currentUser) { fetchBootstrapData(); fetchAnnouncements(); if (currentUser.role === 'LEADER' || currentUser.role === 'ADMIN') fetchStudentFollowUps(); }
  }, [currentUser]);

  useEffect(() => { if (currentUser?.role === 'LEADER' && activeTab === 'leader_followups') fetchStudentFollowUps(); }, [activeTab, currentUser]);

  // Preserve the current page when the user refreshes the browser.
  useEffect(() => {
    if (currentUser) window.sessionStorage.setItem('kelasplus.activeTab', activeTab);
  }, [activeTab, currentUser]);

  useEffect(() => {
    if (!toastNotice) { setToastFading(false); return undefined; }
    setToastFading(false);
    const fadeTimer = window.setTimeout(() => setToastFading(true), 6000);
    const removeTimer = window.setTimeout(() => setToastNotice(null), 6500);
    const dismissOnPageAction = () => setToastNotice(null);
    document.addEventListener('pointerdown', dismissOnPageAction, true);
    document.addEventListener('keydown', dismissOnPageAction, true);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(removeTimer);
      document.removeEventListener('pointerdown', dismissOnPageAction, true);
      document.removeEventListener('keydown', dismissOnPageAction, true);
    };
  }, [toastNotice]);
  
  // End sessions after 30 minutes of inactivity and refresh active server sessions.
  useEffect(() => {
    if (!currentUser) return;
    let idleTimer;
    const resetIdleTimer = () => { window.clearTimeout(idleTimer); idleTimer = window.setTimeout(() => { handleLogout(true); }, 30 * 60 * 1000); };
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(name => window.addEventListener(name, resetIdleTimer, { passive: true }));
    resetIdleTimer();
    const heartbeat = window.setInterval(() => { fetch(API_BASE_URL + '/auth/activity', { method: 'POST', credentials: 'include' }).catch(() => {}); }, 2 * 60 * 1000);
    return () => { window.clearTimeout(idleTimer); window.clearInterval(heartbeat); events.forEach(name => window.removeEventListener(name, resetIdleTimer)); };
  }, [currentUser]);

  // Update attendance view for selected class/date
  useEffect(() => {
    const key = `${selectedClass}_${attendanceDate}`;
    if (attendanceRecords[key]) {
      setCurrentAttendance(attendanceRecords[key]);
      setAttendanceSaveStatus('saved');
    } else {
      const initial = {};
      students.filter(s => s.class === selectedClass).forEach(s => { initial[s.id] = 'PRESENT'; });
      setCurrentAttendance(initial);
      setAttendanceSaveStatus('unsaved');
    }
  }, [selectedClass, attendanceDate, students, attendanceRecords]);

  useEffect(() => {
    if (!currentUser || !['schedule', 'dashboard'].includes(activeTab)) return;
    let cancelled = false;
    setScheduleLoading(true);
    fetch(`${API_BASE_URL}/schedules`, { credentials: 'include' })
      .then(async response => {
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || 'Jadwal gagal dimuat.');
        if (!cancelled) setSchedules(data.schedules || []);
      })
      .catch(error => { if (!cancelled) alert(error.message || 'Jadwal gagal dimuat.'); })
      .finally(() => { if (!cancelled) setScheduleLoading(false); });
    return () => { cancelled = true; };
  }, [activeTab, currentUser]);

  useEffect(() => { const timer = window.setInterval(() => setDeviceNow(new Date()), 60000); return () => window.clearInterval(timer); }, []);

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
        avatar: currentUser.avatar || ''
      });
    }
  }, [currentUser]);

  // Login is server-authoritative; no client-side/demo credential fallback.
  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoadingAuth(true);
    const loginStartedAt = Date.now();
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
      if (firebaseConfigured) {
        if (!auth) throw new Error('Firebase Authentication belum siap. Periksa konfigurasi aplikasi.');
        if (!data.firebaseCustomToken) throw new Error('Firebase belum terhubung ke backend. Pengelola aplikasi perlu mengatur FIREBASE_SERVICE_ACCOUNT_JSON pada server.');
        await signInWithCustomToken(auth, data.firebaseCustomToken);
      }
      setCurrentUser(data.user);
      const landingTab = data.user.role === 'ADMIN' ? 'admin_overview' : data.user.role === 'LEADER' ? 'leader_overview' : 'dashboard';
      setActiveTab(landingTab);
      window.sessionStorage.setItem('kelasplus.activeTab', landingTab);
    } catch (err) {
      setLoginError(err.message || 'Server tidak dapat dihubungi. Pastikan backend berjalan.');
    } finally {
      await new Promise(resolve => window.setTimeout(resolve, Math.max(0, 2500 - (Date.now() - loginStartedAt))));
      setIsLoadingAuth(false);
    }
  };

  const handleLogout = async (idleTimeout = false) => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    const logoutStartedAt = Date.now();
    try { if (auth) await signOut(auth); } catch (err) { console.warn('Firebase logout failed:', err); }
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch (err) {
      console.warn('Backend logout request failed:', err);
    } finally {
      await new Promise(resolve => window.setTimeout(resolve, Math.max(0, 2500 - (Date.now() - logoutStartedAt))));
      try {
        for (let i = window.sessionStorage.length - 1; i >= 0; i--) {
          const key = window.sessionStorage.key(i);
          if (key && key.startsWith('kelasplus.bootstrap.v1.')) window.sessionStorage.removeItem(key);
        }
      } catch (error) { console.warn('Cache lokal gagal dibersihkan:', error); }
      setCurrentUser(null);
      setIsLoggingOut(false);
      setUsers([]);
      setClassesList([]);
      setStudents([]);
      setAttendanceRecords({});
      setJournals([]);
      setAssignmentScores([]);
      setAssignmentTasks([]);
      setLoginUsername('');
      setLoginPassword('');
      // Do not show the inactivity timeout message on the login screen.
      setLoginError('');
      setActiveTab('dashboard');
    }
  };

  // Persist attendance first; update the UI only after server confirmation.
  const handleStatusChange = (studentId, status) => {
    setCurrentAttendance(prev => ({ ...prev, [studentId]: status }));
    setAttendanceSaveStatus('unsaved');
  };

  const handleSaveAttendance = async () => {
    setSavingAttendance(true); setAttendanceSaveStatus('saving');
    try {
      const response = await fetch(API_BASE_URL + '/attendance', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ className: selectedClass, date: attendanceDate, records: currentAttendance }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Presensi gagal disimpan.');
      setAttendanceRecords(prev => ({ ...prev, [selectedClass + '_' + attendanceDate]: { ...currentAttendance } }));
      setAttendanceSaveStatus('saved');
      alert('Presensi kelas ' + selectedClass + ' tanggal ' + attendanceDate + ' berhasil disimpan (' + Object.keys(currentAttendance).length + ' siswa).');
    } catch (err) { setAttendanceSaveStatus('error'); setToastNotice({ title: err.message?.includes('jam mengajar') || err.message?.includes('jadwal mengajar') ? '⏰ Di luar jam mengajar' : '⚠️ Presensi belum tersimpan', message: err.message || 'Presensi gagal disimpan.', type: 'warning' }); }
    finally { setSavingAttendance(false); }
  };

  const handleMarkAllPresent = () => {
    const updatedRecord = {};
    students.filter(s => s.class === selectedClass).forEach(s => { updatedRecord[s.id] = 'PRESENT'; });
    setCurrentAttendance(updatedRecord); setAttendanceSaveStatus('unsaved');
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
  const handleCreateSchedule = async (e) => {
    e.preventDefault();
    if (!scheduleForm.teacherId || !scheduleForm.classId || !scheduleForm.subject.trim()) {
      alert('Pilih guru, kelas, dan mata pelajaran terlebih dahulu.'); return;
    }
    setScheduleSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/schedules`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...scheduleForm, dayOfWeek: Number(scheduleForm.dayOfWeek) }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Jadwal gagal disimpan.');
      setSchedules(prev => [...prev, data.schedule].sort((a,b) => a.dayOfWeek-b.dayOfWeek || a.startTime.localeCompare(b.startTime)));
      setScheduleForm(prev => ({ ...prev, room: '' }));
      alert('Jadwal mengajar berhasil ditambahkan.');
    } catch (error) { alert(error.message || 'Jadwal gagal disimpan.'); }
    finally { setScheduleSaving(false); }
  };

  const handleDeactivateSchedule = async (schedule) => {
    if (!window.confirm(`Nonaktifkan jadwal ${schedule.subject} kelas ${schedule.className}?`)) return;
    try {
      const response = await fetch(`${API_BASE_URL}/schedules/${encodeURIComponent(schedule.id)}`, { method: 'DELETE', credentials: 'include' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Jadwal gagal dinonaktifkan.');
      setSchedules(prev => prev.filter(item => item.id !== schedule.id));
    } catch (error) { alert(error.message || 'Jadwal gagal dinonaktifkan.'); }
  };

  const handleEnableNotifications = async () => {
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!firebaseApp || !firebaseConfigured) { setNotificationStatus('error'); setNotificationMessage('Konfigurasi Firebase web belum lengkap.'); return; }
    if (!vapidKey) { setNotificationStatus('error'); setNotificationMessage('VITE_FIREBASE_VAPID_KEY belum diatur pada environment build.'); return; }
    if (!('Notification' in window) || !('serviceWorker' in navigator)) { setNotificationStatus('error'); setNotificationMessage('Browser ini belum mendukung notifikasi web. Coba Chrome terbaru melalui HTTPS.'); return; }
    setNotificationStatus('working'); setNotificationMessage('Meminta izin notifikasi…');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Izin notifikasi belum diberikan pada browser.');
      const cfg = {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID
      };
      const encodedConfig = btoa(unescape(encodeURIComponent(JSON.stringify(cfg))));
      const registration = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?config=${encodeURIComponent(encodedConfig)}`, { scope: '/' });
      await navigator.serviceWorker.ready;
      const messaging = getMessaging(firebaseApp);
      const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
      if (!token) throw new Error('Token not berhasil dibuat. Periksa Firebase Cloud Messaging dan VAPID key.');
      const response = await fetch(`${API_BASE_URL}/notifications/register`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, platform: 'web' }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Pendaftaran perangkat gagal.');
      setNotificationStatus('enabled');
      setNotificationMessage('Notifikasi aktif di browser ini. Izinkan notifikasi untuk situs KELAS+ pada pengaturan perangkat.');
    } catch (error) {
      setNotificationStatus('error');
      setNotificationMessage(error.message || 'Notifikasi gagal diaktifkan.');
    }
  };

  // Admin Operations
  const handleSaveGeminiApiKey = async (e) => {
    e.preventDefault();
    alert('Demi keamanan, kunci Gemini harus dikonfigurasi pada environment backend oleh pengelola aplikasi.');
  };
  const handleAddTeacher = async (e) => {
    e.preventDefault();
    if (!newTeacher.name.trim() || !newTeacher.username.trim() || newTeacher.password.length < 12 || !newTeacher.assignedClasses.length) { alert('Nama, username, password minimal 12 karakter, dan minimal satu kelas pengampuan wajib diisi.'); return; }
    try {
      const response = await fetch(API_BASE_URL + '/teachers', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newTeacher) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Akun guru gagal dibuat.');
      setUsers(prev => [...prev, data.user]);
      alert('Akun guru berhasil dibuat.');
      await fetchBootstrapData();
      setNewTeacher({ name: '', nip: '', subject: 'Bahasa Inggris', username: '', password: '', assignedClasses: [] });
    } catch (err) { alert(err.message || 'Akun guru gagal dibuat.'); }
  };
  const handleAddClass = async (e) => {
    e.preventDefault();
    if (!newClass.name.trim()) return;
    try {
      const response = await fetch(API_BASE_URL + '/classes', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newClass) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Kelas gagal ditambahkan.');
      await fetchBootstrapData();
      alert(data.restored ? 'Kelas lama berhasil diaktifkan kembali.' : 'Rombel kelas berhasil ditambahkan.');
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
      await fetchBootstrapData();
      alert(data.restored ? 'Data siswa lama berhasil diaktifkan kembali.' : 'Data siswa berhasil disimpan.');
      setNewStudent({ name: '', nisn: '', class: 'VII A', gender: 'L' });
    } catch (err) { alert(err.message || 'Data siswa gagal disimpan.'); }
  };
  const downloadStudentTemplate = () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Nama Siswa', 'NISN', 'Kelas', 'Jenis Kelamin']
    ]);
    sheet['!cols'] = [{ wch: 28 }, { wch: 18 }, { wch: 14 }, { wch: 18 }];
    sheet['!autofilter'] = { ref: 'A1:D1' };
    XLSX.utils.book_append_sheet(workbook, sheet, 'Data Siswa');
    const guide = XLSX.utils.aoa_to_sheet([
      ['PETUNJUK TEMPLATE IMPOR SISWA'],
      ['1. Tambahkan data siswa mulai baris kedua; jangan mengubah judul kolom.'],
      ['2. Kolom wajib: Nama Siswa, NISN, Kelas, Jenis Kelamin.'],
      ['3. Format Jenis Kelamin: L untuk Laki-laki, P untuk Perempuan.'],
      ['4. Kelas harus sama persis dengan nama kelas yang sudah dibuat di KELAS+, contoh VII A.'],
      ['5. Isi NISN sebagai TEKS agar angka nol di depan tidak hilang.'],
      ['6. Jangan mengubah nama kolom pada baris pertama.'],
      ['7. NISN yang sudah terdaftar tidak akan diimpor ulang.']
    ]);
    guide['!cols'] = [{ wch: 100 }];
    XLSX.utils.book_append_sheet(workbook, guide, 'Petunjuk');
    XLSX.writeFile(workbook, 'Template_Impor_Siswa_KELAS_Plus.xlsx');
  };
  const handleStudentExcelSelected = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setStudentImportRows([]);
    setStudentImportFileName(file.name);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) throw new Error('File Excel tidak memiliki lembar data.');
      const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
      if (!rawRows.length) throw new Error('Belum ada baris data. Isi template lalu unggah kembali.');
      const normalize = value => String(value || '').trim().toLowerCase().replace(/[ _-]+/g, '');
      const existingNisn = new Set(students.map(s => String(s.nisn || '').trim()));
      const seenNisn = new Set();
      const parsed = rawRows.map((row, index) => {
        const columns = {};
        Object.entries(row).forEach(([key, value]) => { columns[normalize(key)] = value; });
        const name = String(columns.namasiswa || columns.nama || '').trim();
        const nisn = String(columns.nisn || '').trim().replace(/\.0$/, '');
        const className = String(columns.kelas || '').trim();
        const genderRaw = String(columns.jenisKelamin || columns.jeniskelamin || columns.gender || columns.l || '').trim().toUpperCase();
        const gender = ['P', 'PEREMPUAN'].includes(genderRaw) ? 'P' : ['L', 'LAKI-LAKI', 'LAKILAKI'].includes(genderRaw) ? 'L' : '';
        let error = '';
        if (!name || !nisn || !className) error = 'Nama, NISN, dan kelas wajib diisi.';
        else if (!/^\d{5,20}$/.test(nisn)) error = 'NISN harus berupa 5–20 digit angka; format kolom NISN sebagai teks.';
        else if (!classesList.some(c => c.name.toLowerCase() === className.toLowerCase())) error = 'Kelas "' + className + '" belum dibuat di KELAS+.';
        else if (!gender) error = 'Jenis kelamin harus L atau P.';
        else if (existingNisn.has(nisn)) error = 'NISN sudah ada di data KELAS+.';
        else if (seenNisn.has(nisn)) error = 'NISN duplikat di dalam file.';
        if (nisn) seenNisn.add(nisn);
        return { rowNumber: index + 2, name, nisn, class: classesList.find(c => c.name.toLowerCase() === className.toLowerCase())?.name || className, gender, error };
      }).filter(row => row.name || row.nisn || row.class);
      if (!parsed.length) throw new Error('Tidak ditemukan baris data siswa yang dapat dibaca.');
      setStudentImportRows(parsed);
    } catch (error) {
      setStudentImportRows([]);
      alert(error.message || 'File Excel gagal dibaca. Gunakan format .xlsx atau .xls.');
    } finally {
      event.target.value = '';
    }
  };
  const handleImportStudents = async () => {
    const validRows = studentImportRows.filter(row => !row.error);
    if (!validRows.length) { alert('Tidak ada baris valid untuk diimpor. Perbaiki data Excel lalu unggah kembali.'); return; }
    if (!window.confirm('Impor ' + validRows.length + ' siswa ke KELAS+? Baris yang tidak valid akan dilewati.')) return;
    setStudentImportBusy(true);
    let success = 0;
    const failures = [];
    try {
      for (const row of validRows) {
        try {
          const response = await fetch(API_BASE_URL + '/students', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: row.name, nisn: row.nisn, class: row.class, gender: row.gender }) });
          const data = await response.json();
          if (!response.ok || !data.success) throw new Error(data.message || 'Gagal menyimpan');
          success += 1;
        } catch (error) { failures.push(row.name + ' (' + row.nisn + '): ' + error.message); }
      }
      await fetchBootstrapData();
      setStudentImportRows([]);
      setStudentImportFileName('');
      const skipped = studentImportRows.filter(row => row.error).length;
      alert('Impor selesai. Berhasil: ' + success + '. Gagal disimpan: ' + failures.length + '. Baris dilewati karena validasi: ' + skipped + (failures.length ? '\n\nRincian gagal:\n' + failures.slice(0, 10).join('\n') : ''));
    } finally { setStudentImportBusy(false); }
  };

  const handleUserRoleChange = async (userId, role) => {
    try {
      const response = await fetch(API_BASE_URL + '/users/' + userId, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Peran akun gagal diperbarui.');
      await fetchBootstrapData();
    } catch (err) { alert(err.message || 'Peran akun gagal diperbarui.'); }
  };

  const handleResetUserPassword = async (userId) => {
    const password = window.prompt('Masukkan password baru minimal 12 karakter:');
    if (!password) return;
    if (password.length < 12) { alert('Password minimal 12 karakter.'); return; }
    try {
      const response = await fetch(API_BASE_URL + '/users/' + userId + '/reset-password', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Reset password gagal.');
      alert('Password berhasil direset. Sesi akun tersebut akan berakhir.');
    } catch (err) { alert(err.message || 'Reset password gagal.'); }
  };

  const handleDeactivateStudent = async (student) => {
    if (!window.confirm('Nonaktifkan data siswa ' + student.name + '?')) return;
    try {
      const response = await fetch(API_BASE_URL + '/students/' + student.id, { method: 'DELETE', credentials: 'include' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Data siswa gagal dinonaktifkan.');
      await fetchBootstrapData();
    } catch (err) { alert(err.message || 'Data siswa gagal dinonaktifkan.'); }
  };

  const handleDeactivateClass = async (klass) => {
    if (!window.confirm('Nonaktifkan kelas ' + klass.name + '? Kelas harus kosong terlebih dahulu.')) return;
    try {
      const response = await fetch(API_BASE_URL + '/classes/' + klass.id, { method: 'DELETE', credentials: 'include' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Kelas gagal dinonaktifkan.');
      await fetchBootstrapData();
    } catch (err) { alert(err.message || 'Kelas gagal dinonaktifkan.'); }
  };

  const handleToggleUserActive = async (user) => {
    if (user.id === currentUser.id && user.active) { alert('Akun yang sedang digunakan tidak dapat dinonaktifkan.'); return; }
    const action = user.active ? 'menonaktifkan' : 'mengaktifkan kembali';
    if (!window.confirm('Yakin ingin ' + action + ' akun ' + user.username + '?')) return;
    try {
      const response = user.active
        ? await fetch(API_BASE_URL + '/users/' + user.id, { method: 'DELETE', credentials: 'include' })
        : await fetch(API_BASE_URL + '/users/' + user.id, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: true }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Status akun gagal diperbarui.');
      await fetchBootstrapData();
    } catch (err) { alert(err.message || 'Status akun gagal diperbarui.'); }
  };

  const handleEditTeacher = async (teacher) => {
    const name=window.prompt('Nama guru:',teacher.name); if(name===null)return;
    const nip=window.prompt('NIP:',teacher.nip||''); if(nip===null)return;
    const subject=window.prompt('Mata pelajaran (salin salah satu):\\n'+SUBJECT_OPTIONS.join('\\n'),teacher.subject||SUBJECT_OPTIONS[0]); if(subject===null)return;
    const classesText=window.prompt('Kelas yang diampu, pisahkan dengan koma:\\n'+classesList.map(x=>x.name).join(', '),(teacher.assignedClasses||[]).join(', ')); if(classesText===null)return;
    const assignedClasses=classesText.split(',').map(x=>x.trim()).filter(x=>classesList.some(k=>k.name===x));
    if(!SUBJECT_OPTIONS.includes(subject)){alert('Mata pelajaran harus dipilih dari daftar yang tersedia.');return;}
    try{const response=await fetch(API_BASE_URL+'/users/'+teacher.id,{method:'PATCH',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name.trim(),nip:nip.trim(),subject,assignedClasses})});const data=await response.json();if(!response.ok||!data.success)throw new Error(data.message||'Data guru gagal diperbarui.');await fetchBootstrapData();alert('Data guru berhasil diperbarui.');}catch(err){alert(err.message||'Data guru gagal diperbarui.');}
  };
  const handleEditClass = async (klass) => {
    const name=window.prompt('Nama kelas:',klass.name);if(name===null)return;
    const grade=window.prompt('Tingkat kelas (VII, VIII, atau IX):',klass.grade);if(grade===null)return;
    const homeroomTeacher=window.prompt('Nama wali kelas:',klass.homeroomTeacher||'');if(homeroomTeacher===null)return;
    if(!['VII','VIII','IX'].includes(grade.trim().toUpperCase())){alert('Tingkat kelas harus VII, VIII, atau IX.');return;}
    try{const response=await fetch(API_BASE_URL+'/classes/'+klass.id,{method:'PATCH',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name.trim(),grade:grade.trim().toUpperCase(),homeroomTeacher:homeroomTeacher.trim()})});const data=await response.json();if(!response.ok||!data.success)throw new Error(data.message||'Data kelas gagal diperbarui.');await fetchBootstrapData();alert('Data kelas berhasil diperbarui.');}catch(err){alert(err.message||'Data kelas gagal diperbarui.');}
  };
  const handleEditStudent = async (student) => {
    const name=window.prompt('Nama siswa:',student.name);if(name===null)return;
    const nisn=window.prompt('NISN:',student.nisn);if(nisn===null)return;
    const className=window.prompt('Nama kelas tepat seperti daftar:\\n'+classesList.map(x=>x.name).join(', '),student.class);if(className===null)return;
    const gender=window.prompt('Jenis kelamin (L/P):',student.gender||'L');if(gender===null)return;
    if(!classesList.some(x=>x.name===className.trim())||!['L','P'].includes(gender.trim().toUpperCase())){alert('Kelas atau jenis kelamin tidak valid.');return;}
    try{const response=await fetch(API_BASE_URL+'/students/'+student.id,{method:'PATCH',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name.trim(),nisn:nisn.trim(),class:className.trim(),gender:gender.trim().toUpperCase()})});const data=await response.json();if(!response.ok||!data.success)throw new Error(data.message||'Data siswa gagal diperbarui.');await fetchBootstrapData();alert('Data siswa berhasil diperbarui.');}catch(err){alert(err.message||'Data siswa gagal diperbarui.');}
  };
  const teacherLearningTasks = assignmentTasks.filter(t => t.teacherId === currentUser?.id && t.subject === (currentUser?.subject || 'Umum')).sort((a,b) => a.assignmentNo-b.assignmentNo);
  const escapeReportHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const generateFollowUpPdf = (record) => {
    const e = escapeReportHtml;
    const win = window.open('', '_blank');
    if (!win) { alert('Popup diblokir browser. Izinkan popup untuk KELAS+, lalu coba lagi.'); return; }
    const school = e(systemSettings.schoolName || 'UPTD SMPN 2 BAJUIN');
    const address = e(systemSettings.schoolAddress || '');
    const contact = e([systemSettings.schoolPhone, systemSettings.schoolEmail].filter(Boolean).join(' · '));
    const html = '<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Laporan Tindak Lanjut - '+e(record.studentName)+'</title><style>@page{size:A4 portrait;margin:18mm}body{font-family:Arial,sans-serif;color:#172033;font-size:11pt;line-height:1.55}.header{text-align:center;border-bottom:3px double #1e3a8a;padding-bottom:12px;margin-bottom:22px}.school{font-size:15pt;font-weight:bold}.sub{font-size:9pt;color:#475569}.title{text-align:center;font-weight:bold;font-size:14pt;margin:22px 0}.meta{width:100%;border-collapse:collapse;margin:16px 0}.meta td{padding:5px 8px;vertical-align:top}.label{width:150px;font-weight:bold}.section{margin:16px 0}.section h3{font-size:10pt;text-transform:uppercase;color:#1e3a8a;border-bottom:1px solid #cbd5e1;padding-bottom:5px}.body{white-space:pre-wrap;min-height:35px}.sign{display:flex;justify-content:space-between;margin-top:48px;text-align:center}.sign>div{width:45%}.space{height:65px}.print{text-align:center;margin-top:28px}@media print{.print{display:none}}</style></head><body><header class="header"><div class="school">'+school+'</div><div>'+address+'</div><div>'+contact+'</div><div class="sub">'+e(systemSettings.letterheadSubtitle||'Laporan Tindak Lanjut Siswa')+'</div></header><div class="title">LAPORAN TINDAK LANJUT SISWA</div><table class="meta"><tr><td class="label">Nama Siswa</td><td>: '+e(record.studentName)+'</td></tr><tr><td class="label">Kelas</td><td>: '+e(record.studentClass)+'</td></tr><tr><td class="label">Tanggal</td><td>: '+e(record.date)+'</td></tr><tr><td class="label">Kategori</td><td>: '+e(record.category)+'</td></tr><tr><td class="label">Status</td><td>: '+e(record.status==='SELESAI'?'Selesai':'Monitoring lanjutan')+'</td></tr><tr><td class="label">Petugas</td><td>: '+e(record.createdByName||currentUser.name)+'</td></tr></table><section class="section"><h3>Tindakan yang Dilakukan</h3><div class="body">'+e(record.action)+'</div></section><section class="section"><h3>Hasil Tindak Lanjut</h3><div class="body">'+e(record.result)+'</div></section><section class="section"><h3>Rencana Berikutnya</h3><div class="body">'+e(record.nextStep||'-')+'</div></section><section class="section"><h3>Catatan Tambahan</h3><div class="body">'+e(record.notes||'-')+'</div></section><div class="sign"><div>Mengetahui,<br>Kepala Sekolah<div class="space"></div><b>'+e(systemSettings.principalName||'........................................')+'</b><br>NIP. '+e(systemSettings.principalNip||'....................................')+'</div><div>Bajuin, '+e(new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'}))+'<br>Leader / Petugas<div class="space"></div><b>'+e(currentUser.name||'')+'</b></div></div><div class="print"><button onclick="window.print()">Cetak / Simpan PDF</button></div></body></html>';
    win.document.write(html); win.document.close(); setTimeout(() => { win.focus(); win.print(); }, 350);
  };

  const generatePdfReport = kind => {
    const className = reportClass || selectedClass || teacherAssignedClasses[0] || '';
    const from = reportFromDate || reportToDate, to = reportToDate || reportFromDate;
    if (!className || className === 'ALL') { alert('Pilih satu kelas untuk laporan PDF.'); return; }
    if (!from || !to || from > to) { alert('Rentang tanggal laporan tidak valid.'); return; }
    const e = escapeReportHtml, inPeriod = date => date >= from && date <= to;
    const printedAt = new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' });
    const classStudents = students.filter(s => s.class === className).sort((a,b)=>a.name.localeCompare(b.name,'id'));
    let title = '', headers = '', rows = '', summary = '';
    if (kind === 'journal') {
      title = 'LAPORAN JURNAL MENGAJAR';
      const data = journals.filter(j => j.class === className && inPeriod(j.date)).sort((a,b)=>a.date.localeCompare(b.date));
      headers = '<th>No.</th><th>Tanggal</th><th>Materi / Topik</th><th>Metode</th><th>Catatan / Refleksi</th>';
      rows = data.map((j,i)=>'<tr><td>'+(i+1)+'</td><td>'+e(j.date)+'</td><td>'+e(j.topic)+'</td><td>'+e(j.method||'-')+'</td><td>'+e(j.text||'-')+'</td></tr>').join('');
      summary = 'Jumlah entri jurnal: '+data.length;
    } else if (kind === 'attendance') {
      title = 'REKAPITULASI ABSENSI SISWA';
      const perStudent = new Map(classStudents.map(student => [student.id, { student, PRESENT: 0, LATE: 0, SICK: 0, PERMISSION: 0, ABSENT: 0 }]));
      Object.entries(attendanceRecords).forEach(([key, record]) => {
        const prefix = className + '_';
        if (!key.startsWith(prefix)) return;
        const date = key.slice(prefix.length);
        if (!inPeriod(date)) return;
        classStudents.forEach(student => {
          const status = record[student.id], row = perStudent.get(student.id);
          if (status && row && Object.prototype.hasOwnProperty.call(row, status)) { row[status] += 1; if (status === 'LATE') row.PRESENT += 1; }
        });
      });
      const data = [...perStudent.values()].sort((a,b)=>a.student.name.localeCompare(b.student.name,'id'));
      const counts = {PRESENT:0,LATE:0,SICK:0,PERMISSION:0,ABSENT:0};
      data.forEach(row => Object.keys(counts).forEach(status => { counts[status] += row[status]; }));
      headers = '<th>No.</th><th>Nama Siswa</th><th>NISN</th><th>Hadir</th><th>Izin</th><th>Sakit</th><th>Alpa</th>';
      rows = data.map((row,i)=>'<tr><td>'+(i+1)+'</td><td>'+e(row.student.name)+'</td><td>'+e(row.student.nisn||'-')+'</td><td>'+row.PRESENT+'</td><td>'+row.PERMISSION+'</td><td>'+row.SICK+'</td><td>'+row.ABSENT+'</td></tr>').join('');
      summary = 'Periode: '+e(from)+' s.d. '+e(to)+' · Kelas: '+e(className)+' · Hadir: '+counts.PRESENT+' · Izin: '+counts.PERMISSION+' · Sakit: '+counts.SICK+' · Alpa: '+counts.ABSENT;
    } else {
      title = 'REKAPITULASI NILAI TUGAS';
      const tasks = teacherLearningTasks.slice().sort((a,b)=>a.assignmentNo-b.assignmentNo);
      headers = '<th>No.</th><th>Nama Siswa</th><th>NISN</th>'+tasks.map(t=>'<th>'+e(t.title)+'</th>').join('')+'<th>Rata-rata</th>';
      rows = classStudents.map((student,i)=>{
        const values = tasks.map(task=>{
          const found = assignmentScores.find(g=>g.studentId===student.id&&g.teacherId===currentUser.id&&g.subject===(currentUser.subject||'Umum')&&g.assignmentNo===task.assignmentNo);
          return found&&found.score!==null&&found.score!==undefined?Number(found.score):null;
        });
        const valid=values.filter(v=>v!==null), average=valid.length?valid.reduce((sum,v)=>sum+v,0)/valid.length:null;
        return '<tr><td>'+(i+1)+'</td><td>'+e(student.name)+'</td><td>'+e(student.nisn||'-')+'</td>'+values.map(v=>'<td>'+(v===null?'-':e(v.toLocaleString('id-ID',{maximumFractionDigits:2})))+'</td>').join('')+'<td><b>'+(average===null?'-':e(average.toLocaleString('id-ID',{maximumFractionDigits:2})))+'</b></td></tr>';
      }).join('');
      summary = 'Jumlah siswa: '+classStudents.length+' · Jumlah tugas aktif: '+tasks.length;
    }
    if (!rows) rows = '<tr><td colspan="12" style="text-align:center;padding:18px;color:#64748b">Tidak ada data pada periode ini.</td></tr>';
    const win = window.open('', '_blank');
    if (!win) { alert('Popup diblokir browser. Izinkan popup untuk KELAS+, lalu coba lagi.'); return; }
    const orientation = kind === 'grades' ? 'landscape' : 'portrait';
    const documentHtml = '<!doctype html><html lang="id"><head><meta charset="utf-8"><title>'+e(title)+' - '+e(className)+'</title><style>@page{size:A4 '+orientation+';margin:14mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#172033;font-size:10pt;line-height:1.45;margin:0}.header{text-align:center;border-bottom:3px double #1e3a8a;padding-bottom:12px;margin-bottom:16px}.brand{font-size:17pt;font-weight:800;color:#1e3a8a}.school{font-size:12pt;font-weight:700;margin-top:3px}.sub{font-size:8.5pt;color:#475569;margin-top:3px}.title{text-align:center;font-size:13pt;font-weight:800;margin:18px 0 12px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:5px 20px;margin-bottom:12px;font-size:9pt}.meta strong{display:inline-block;min-width:110px}.summary{padding:8px 10px;background:#eff6ff;border:1px solid #bfdbfe;margin:12px 0;font-size:9pt}table{width:100%;border-collapse:collapse;margin-top:10px;font-size:8.5pt}thead{display:table-header-group}tr{break-inside:avoid}th{background:#1e3a8a;color:white;font-weight:700;text-align:center}th,td{border:1px solid #cbd5e1;padding:6px 7px;vertical-align:top}tbody tr:nth-child(even){background:#f8fafc}td:first-child{text-align:center}.sign{display:flex;justify-content:space-between;gap:30px;margin-top:34px;page-break-inside:avoid}.sign div{text-align:center;width:45%;font-size:9pt}.space{height:55px}.foot{margin-top:16px;border-top:1px solid #cbd5e1;padding-top:6px;font-size:8pt;color:#64748b;display:flex;justify-content:space-between}@media screen{body{padding:16px}.paper{max-width:1100px;margin:auto}}@media print{.no-print{display:none}}</style></head><body><main class="paper"><header class="header"><div class="brand">'+e(systemSettings.schoolName||'UPTD SMPN 2 BAJUIN')+'</div><div class="school">'+e(systemSettings.schoolAddress||'')+'</div><div class="sub">'+e([systemSettings.schoolPhone,systemSettings.schoolEmail].filter(Boolean).join(' · '))+'</div><div class="sub">'+e(systemSettings.letterheadSubtitle||'Sistem Informasi Manajemen Pembelajaran dan Rekapitulasi Kelas')+'</div></header><div class="title">'+e(title)+'</div><section class="meta"><div><strong>Kelas</strong>: '+e(className)+'</div><div><strong>Mata Pelajaran</strong>: '+e(currentUser.subject||'-')+'</div><div><strong>Periode</strong>: '+e(kind === 'grades' ? 'Tugas aktif per tanggal cetak' : from + ' s.d. ' + to)+'</div><div><strong>Tanggal Cetak</strong>: '+e(printedAt)+'</div><div><strong>Guru</strong>: '+e(currentUser.name||'-')+'</div><div><strong>Tahun Pelajaran</strong>: '+e(systemSettings.academicYear||'2026/2027')+'</div></section><div class="summary">'+e(summary)+'</div><table><thead><tr>'+headers+'</tr></thead><tbody>'+rows+'</tbody></table><section class="sign"><div>Mengetahui,<br>Kepala Sekolah<div class="space"></div><b>'+e(systemSettings.principalName||'........................................')+'</b><br>NIP. '+e(systemSettings.principalNip||'....................................')+'</div><div>Bajuin, '+e(new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'}))+'<br>Guru Mata Pelajaran<div class="space"></div><b>'+e(currentUser.name||'........................................')+'</b><br>NIP. '+e(currentUser.nip||'....................................')+'</div></section><footer class="foot"><span>KELAS+ · '+e(title)+'</span><span>Dicetak: '+e(printedAt)+'</span></footer><div class="no-print" style="text-align:center;margin:24px"><button onclick="window.print()" style="background:#1e3a8a;color:white;border:0;padding:10px 18px;border-radius:6px;font-weight:bold;cursor:pointer">Cetak / Simpan sebagai PDF</button></div></main></body></html>';
    win.document.write(documentHtml);
    win.document.close();
    setTimeout(()=>{win.focus();win.print();},400);
  };

  const handleAddLearningTask = async () => {
    const title = window.prompt('Nama tugas baru:', 'Tugas ' + (teacherLearningTasks.length + 1));
    if (title === null) return;
    if (!title.trim()) { alert('Nama tugas tidak boleh kosong.'); return; }
    try {
      const response = await fetch(API_BASE_URL + '/tasks', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: title.trim() }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Tugas gagal ditambahkan.');
      await fetchBootstrapData();
      alert('Tugas berhasil ditambahkan khusus untuk akun Anda.');
    } catch (err) { alert(err.message || 'Tugas gagal ditambahkan.'); }
  };
  const handleDeleteLearningTask = async (task) => {
    if (teacherLearningTasks.length <= 1) { alert('Minimal harus ada satu tugas aktif.'); return; }
    if (!window.confirm('Hapus "' + task.title + '"? Nilai siswa pada tugas ini juga akan dihapus. Tindakan ini tidak dapat dibatalkan.')) return;
    try {
      const response = await fetch(API_BASE_URL + '/tasks/' + encodeURIComponent(task.id), { method: 'DELETE', credentials: 'include' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Tugas gagal dihapus.');
      await fetchBootstrapData();
      alert('Tugas dan nilai terkait berhasil dihapus.');
    } catch (err) { alert(err.message || 'Tugas gagal dihapus.'); }
  };
  const handleSaveStudentGrades = async (student) => {
    setSavingGradesFor(student.id);
    try {
      for (const task of teacherLearningTasks) {
        const raw = gradeDrafts[student.id]?.[task.assignmentNo] ?? '';
        const score = raw === '' ? null : Number(raw);
        if (score !== null && (!Number.isFinite(score) || score < 0 || score > 100)) throw new Error('Nilai tugas harus antara 0 sampai 100.');
        const response = await fetch(API_BASE_URL + '/grades', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studentId: student.id, subject: currentUser.subject || 'Umum', assignmentNo: task.assignmentNo, score }) });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || 'Nilai tugas gagal disimpan.');
      }
      await fetchBootstrapData();
      alert('Nilai ' + teacherLearningTasks.length + ' tugas untuk ' + student.name + ' berhasil disimpan.');
    } catch (err) { alert(err.message || 'Nilai tugas gagal disimpan.'); }
    finally { setSavingGradesFor(''); }
  };

  const handleSaveAllGrades = async () => {
    if (savingAllGrades) return;
    const entries = [];
    for (const [studentId, drafts] of Object.entries(gradeDrafts)) {
      const student = students.find(item => item.id === studentId);
      if (!student || student.active === false) continue;
      const cls = classesList.find(item => item.id === student.classId);
      if (!cls || (currentUser?.role === 'TEACHER' && !(currentUser.assignedClasses || []).includes('ALL') && !(currentUser.assignedClasses || []).includes(cls.name))) continue;
      for (const task of teacherLearningTasks) {
        const raw = drafts?.[task.assignmentNo];
        if (raw === undefined || raw === '') continue;
        const score = Number(raw);
        if (!Number.isFinite(score) || score < 0 || score > 100) {
          alert('Nilai untuk ' + student.name + ' pada ' + task.title + ' harus antara 0 sampai 100.');
          return;
        }
        entries.push({ studentId, subject: currentUser.subject || 'Umum', assignmentNo: task.assignmentNo, score, studentName: student.name, taskTitle: task.title });
      }
    }
    if (!entries.length) { alert('Belum ada perubahan nilai yang diisi. Isi nilai terlebih dahulu, lalu klik Simpan Semua Nilai.'); return; }
    if (!window.confirm('Simpan ' + entries.length + ' nilai untuk siswa yang memiliki perubahan?')) return;
    setSavingAllGrades(true);
    let saved = 0;
    try {
      // Reuse the validated grade endpoint for every value; this avoids bypassing role and class checks.
      for (const entry of entries) {
        const response = await fetch(API_BASE_URL + '/grades', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId: entry.studentId, subject: entry.subject, assignmentNo: entry.assignmentNo, score: entry.score })
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || ('Gagal menyimpan nilai ' + entry.studentName + ' — ' + entry.taskTitle));
        saved++;
      }
      await fetchBootstrapData();
      setGradeDrafts({});
      alert('Berhasil menyimpan ' + saved + ' nilai.');
    } catch (error) {
      alert('Sebanyak ' + saved + ' dari ' + entries.length + ' nilai berhasil disimpan. ' + (error.message || 'Silakan coba lagi untuk nilai yang belum tersimpan.'));
    } finally { setSavingAllGrades(false); }
  };

  const sendLocalAssistantMessage = async () => {
    const question = chatInput.trim();
    if (!question || chatSending) return;
    const q = question.toLowerCase();
    let fallback = 'Saya bisa membantu tentang login, absensi, jurnal, Learning Map, nilai, jadwal, laporan, notifikasi, dan pengaturan akun. Pilih salah satu pertanyaan contoh di bawah atau tulis pertanyaan dengan kata yang lebih spesifik.';
    if (/hai|halo|assalamu|selamat pagi|selamat siang|selamat sore/.test(q)) fallback = 'Halo! Saya Asisten KELAS+. Saya siap membantu penggunaan aplikasi. Kamu bisa bertanya tentang absensi, jurnal, nilai, jadwal, laporan PDF, akun, notifikasi, atau fitur administrator.';
    else if (/absen|absensi|kehadiran|hadir|sakit|izin|alpa/.test(q)) fallback = 'Absensi: buka menu Absensi Cepat, pilih kelas dan tanggal sesuai pertemuan, pilih status Hadir/Sakit/Izin/Alpa untuk setiap siswa, lalu tekan Simpan/Kumpulkan Absen. Periksa pesan perubahan yang belum disimpan sebelum berpindah halaman.';
    else if (/learning map|peta belajar|nilai|tugas|simpan semua/.test(q)) fallback = 'Learning Map: buka menu Learning Map, pilih kelas yang diampu, lalu isi nilai pada kolom tugas yang tersedia. Gunakan Simpan Semua Nilai untuk mengirim nilai yang sudah diisi; kolom kosong tidak dikirim. Periksa kembali kelas dan siswa sebelum menyimpan.';
    else if (/jurnal|materi mengajar|kegiatan pembelajaran/.test(q)) fallback = 'Jurnal mengajar: buka menu Jurnal Mengajar, isi tanggal, kelas, materi/topik, metode dan catatan pembelajaran sesuai kolom yang tersedia, lalu simpan. Isi jurnal setelah kegiatan pembelajaran agar catatan akurat.';
    else if (/laporan|pdf|cetak|rekap/.test(q)) fallback = 'Laporan: buka menu Laporan, pilih jenis laporan, kelas dan rentang tanggal yang dibutuhkan, kemudian gunakan tombol cetak atau simpan sebagai PDF. Periksa pratinjau sebelum mencetak.';
    else if (/jadwal|jam pelajaran|mengajar kapan/.test(q)) fallback = 'Jadwal: buka menu Jadwal Mengajar untuk melihat hari, jam, kelas dan mata pelajaran. Jika jadwal tidak sesuai, sampaikan kepada administrator sekolah agar data jadwal diperiksa.';
    else if (/login|masuk|password|kata sandi|lupa akun|akun terkunci/.test(q)) fallback = 'Login: gunakan username dan password yang diberikan administrator sekolah. Periksa huruf besar/kecil dan koneksi internet. Jangan mengirim password ke chatbot. Jika akun belum aktif atau lupa password, hubungi administrator.';
    else if (/siswa|data siswa|nisn|tambah siswa|impor siswa/.test(q)) fallback = 'Data siswa: menu pengelolaan siswa digunakan oleh petugas berwenang untuk menambah, mengubah, atau mengimpor data sesuai akses. Pastikan kelas dan identitas benar. Demi privasi, chatbot tidak menampilkan NISN atau data pribadi siswa satu per satu.';
    else if (/kelas|rombel|wali kelas|tambah kelas/.test(q)) fallback = 'Manajemen kelas: buka menu Manajemen Kelas sesuai hak akses. Administrator dapat mengelola data kelas; guru hanya menggunakan kelas yang ditugaskan. Periksa keterkaitan kelas dengan siswa, guru, jadwal dan riwayat sebelum mengubah data.';
    else if (/guru|akun guru|tambah pengguna|user|pengguna/.test(q)) fallback = 'Manajemen guru dan akun: administrator dapat mengelola akun, peran, mata pelajaran dan kelas yang ditugaskan. Berikan akses sesuai tugas. Jangan membagikan akun bersama atau menyimpan password dalam catatan terbuka.';
    else if (/notifikasi|notif|push/.test(q)) fallback = 'Notifikasi: gunakan menu pengaturan notifikasi di aplikasi, izinkan notifikasi untuk situs KELAS+ pada browser, dan pastikan situs dibuka melalui HTTPS. Jika masih gagal, periksa izin notifikasi browser dan konfigurasi Firebase pada server.';
    else if (/chatbot|asisten|ai|gemini/.test(q)) fallback = 'Asisten KELAS+ menjawab panduan penggunaan aplikasi. Jika AI server aktif, pertanyaan diteruskan ke layanan AI; jika tidak, panduan lokal tetap tersedia. Integrasi data hanya menggunakan konteks terbatas sesuai izin pengguna dan tidak seharusnya mengirim password atau data pribadi sensitif.';
    else if (/hapus|hapus permanen|delete|nonaktif/.test(q)) fallback = 'Sebelum menonaktifkan data, pastikan tidak ada kaitan dengan riwayat absensi, nilai atau laporan. Data terkait dapat dipertahankan untuk menjaga riwayat sekolah. Penghapusan permanen harus mengikuti kebijakan retensi dan kewenangan administrator.';
    else if (/call center|kontak|email|whatsapp|wa/.test(q)) fallback = 'Kontak bantuan tersedia di dalam jendela Asisten KELAS+: gunakan tombol email atau WhatsApp di bagian kontak untuk menghubungi pengelola KELAS+.';
    setChatMessages(prev => [...prev, { role: 'user', text: question }]);
    setChatInput('');
    setChatSending(true);
    try {
      const response = await fetch(API_BASE_URL + '/ai/chat', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: question,
          context: {
            role: currentUser?.role || 'unknown',
            assignedClasses: (currentUser?.assignedClasses || []).slice(0, 20),
            summary: {
              activeStudents: students.filter(student => student.active !== false).length,
              activeClasses: classesList.filter(cls => cls.active !== false).length,
              visibleJournals: journals.length,
              visibleSchedules: schedules.length,
              recordedGradeEntries: assignmentScores.length,
              attendanceDatesAvailable: Object.keys(attendanceRecords || {}).length
            }
          }
        })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Asisten AI belum tersedia.');
      setChatMessages(prev => [...prev, { role: 'assistant', text: data.answer }]);
    } catch (error) {
      setChatMessages(prev => [...prev, { role: 'assistant', text: fallback + (error?.message?.includes('belum dikonfigurasi') ? '\n\nCatatan: asisten AI belum diaktifkan pada server. Panduan lokal tetap tersedia.' : '') }]);
    } finally { setChatSending(false); }
  };

  // Student monitoring indicators are calculated from saved attendance and grade records.
  const teacherAssignedClasses = currentUser?.role === 'TEACHER' ? (currentUser.assignedClasses || []) : classesList.map(c => c.name);
  const getStudentMetrics = (student) => {
    const records = Object.entries(attendanceRecords).filter(([key, row]) => key.startsWith(student.class + '_') && Object.prototype.hasOwnProperty.call(row, student.id)).map(([, row]) => row[student.id]);
    const attendanceRate = records.length ? Math.round(records.filter(status => status === 'PRESENT').length / records.length * 100) : null;
    const subjectGrades = assignmentScores.filter(g => g.studentId === student.id && g.score !== null && g.score !== undefined && (currentUser?.role !== 'TEACHER' || (g.teacherId === currentUser.id && g.subject === (currentUser.subject || 'Umum'))));
    const averageScore = subjectGrades.length ? Math.round(subjectGrades.reduce((sum, g) => sum + Number(g.score), 0) / subjectGrades.length) : null;
    let statusFlag = 'NO_DATA';
    if (attendanceRate !== null || averageScore !== null) {
      const attendance = attendanceRate === null ? 100 : attendanceRate;
      const score = averageScore === null ? 100 : averageScore;
      if (attendance < 60 || score < 50) statusFlag = 'WATCH';
      else if (attendance < 75 || score < 65) statusFlag = 'NEEDS_SUPPORT';
      else if (attendance < 90 || score < 75) statusFlag = 'GOOD';
      else statusFlag = 'VERY_GOOD';
    }
    return { ...student, attendanceRate, averageScore, statusFlag };
  };
  const studentsWithMetrics = students.map(getStudentMetrics);
  const filteredStudents = studentsWithMetrics.filter(s => {
    if (currentUser?.role === 'TEACHER') {
      if (!teacherAssignedClasses.includes(s.class) && !teacherAssignedClasses.includes('ALL')) return false;
    }
    if (mapClassFilter !== 'ALL' && s.class !== mapClassFilter) return false;
    return s.name.toLowerCase().includes(studentSearchTerm.toLowerCase()) || String(s.nisn || '').includes(studentSearchTerm);
  });
  const leaderLearningStudents = [...studentsWithMetrics].sort((a, b) => {
    const priority = { WATCH: 0, NEEDS_SUPPORT: 1, GOOD: 2, VERY_GOOD: 3, NO_DATA: 4 };
    return priority[a.statusFlag] - priority[b.statusFlag] || (a.class || '').localeCompare(b.class || '') || a.name.localeCompare(b.name);
  });
  const filteredAdminStudents = students.filter(student => (adminStudentClassFilter === 'ALL' || student.class === adminStudentClassFilter) && (student.name.toLowerCase().includes(adminStudentSearch.toLowerCase()) || String(student.nisn || '').includes(adminStudentSearch)));
  const adminStudentPageCount = Math.max(1, Math.ceil(filteredAdminStudents.length / adminStudentPageSize));
  const paginatedAdminStudents = filteredAdminStudents.slice((adminStudentPage - 1) * adminStudentPageSize, adminStudentPage * adminStudentPageSize);
  const filteredLeaderStudents = leaderLearningStudents.filter(student => (mapClassFilter === 'ALL' || student.class === mapClassFilter) && (student.name.toLowerCase().includes(studentSearchTerm.toLowerCase()) || String(student.nisn || '').includes(studentSearchTerm)));
  const visibleSchedules = schedules.filter(item => Number(item.dayOfWeek) === Number(selectedScheduleDay) && (currentUser?.role !== 'LEADER' || scheduleFilterClass === 'ALL' || item.className === scheduleFilterClass) && (currentUser?.role !== 'LEADER' || scheduleFilterTeacher === 'ALL' || item.teacherId === scheduleFilterTeacher));

  // UNAUTHENTICATED - PREMIUM LOGIN PAGE
  if (!currentUser) {
    return (
      <main className="min-h-screen bg-slate-950 px-3 py-4 sm:px-6 sm:py-8 lg:flex lg:items-center lg:justify-center font-sans">
        <div className="mx-auto grid w-full max-w-7xl overflow-hidden rounded-[28px] border border-white/15 bg-white shadow-[0_32px_100px_rgba(0,0,0,0.42)] lg:min-h-[720px] lg:grid-cols-[1.08fr_0.92fr]">
          <section className="relative isolate flex min-h-[520px] flex-col justify-between overflow-hidden bg-gradient-to-br from-[#061b4a] via-[#073b8d] to-[#1268cf] p-7 text-white sm:p-10 lg:min-h-[720px] lg:p-12">
            <div className="absolute inset-0 -z-20 bg-[radial-gradient(ellipse_at_80%_15%,rgba(56,189,248,0.38),transparent_38%),radial-gradient(ellipse_at_5%_85%,rgba(37,99,235,0.65),transparent_40%)]" />
            <div className="absolute inset-0 -z-10 opacity-20" style={{backgroundImage:'linear-gradient(135deg,transparent 0%,rgba(255,255,255,.12) 48%,transparent 49%,transparent 100%)',backgroundSize:'44px 44px'}} />
            <div className="relative">
              <div className="inline-flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 shadow-lg backdrop-blur-md">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-lg font-black tracking-tight">K<span className="text-amber-300">+</span></div>
                <div><p className="text-xl font-black tracking-wide">KELAS<span className="text-amber-300">+</span></p><p className="text-xs text-blue-100">Sistem Informasi Pembelajaran</p></div>
              </div>
              <p className="mt-10 text-xs font-extrabold uppercase tracking-[0.28em] text-amber-300 sm:mt-14">Selamat datang di KELAS+</p>
              <h1 className="mt-4 max-w-xl text-4xl font-black leading-[1.08] tracking-tight sm:text-5xl">Dari data menjadi <span className="text-amber-300">aksi.</span></h1>
              <p className="mt-5 max-w-lg text-sm leading-7 text-blue-100 sm:text-base">Satu platform untuk membantu guru dan pimpinan sekolah mengelola pembelajaran, memantau perkembangan siswa, dan mengambil keputusan yang lebih tepat.</p>
              <div className="mt-8 grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
                {[['01','Absensi & Jurnal','Pencatatan kegiatan belajar yang tertata'],['02','Learning Map','Pemantauan tugas dan perkembangan nilai'],['03','Laporan Siswa','Informasi untuk pendampingan yang tepat'],['04','Asisten Digital','Bantuan penggunaan aplikasi terintegrasi']].map(([n,title,desc])=>(
                  <div key={n} className="flex gap-3 rounded-2xl border border-white/15 bg-white/[0.08] p-4 backdrop-blur-sm transition hover:bg-white/[0.13]">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-400/20 text-xs font-black text-sky-200">{n}</span>
                    <div><p className="text-sm font-bold text-white">{title}</p><p className="mt-1 text-xs leading-5 text-blue-100/85">{desc}</p></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-8 border-t border-white/20 pt-5">
              <p className="text-sm font-extrabold tracking-wide">UPTD SMPN 2 BAJUIN</p>
              <p className="mt-1 text-xs leading-5 text-blue-100">Platform pendamping administrasi dan pembelajaran sekolah.</p>
            </div>
          </section>

          <section className="flex flex-col justify-center bg-white px-6 py-8 sm:px-10 sm:py-12 lg:px-14">
            <div className="mx-auto w-full max-w-md">
              <div className="text-center">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-800 ring-1 ring-blue-100">
                  <BookOpen className="h-7 w-7" />
                </div>
                <p className="text-3xl font-black tracking-tight text-slate-950">KELAS<span className="text-blue-700">+</span></p>
                <p className="mt-2 text-sm font-bold tracking-wide text-slate-700">UPTD SMPN 2 BAJUIN</p>
                <p className="mt-3 inline-flex rounded-full bg-blue-50 px-4 py-2 text-[11px] font-medium text-blue-800 ring-1 ring-blue-100">Sistem Informasi & Asisten Pengajaran Digital</p>
              </div>

              <form onSubmit={handleLogin} className="mt-9 space-y-5">
                <div><h2 className="text-xl font-extrabold tracking-tight text-slate-900">Masuk ke akun Anda</h2><p className="mt-1.5 text-sm leading-6 text-slate-500">Gunakan akun yang telah diberikan oleh administrator sekolah.</p></div>
                {loginError && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{loginError}</span></div>}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Username</label>
                  <div className="relative"><User className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" /><input type="text" autoComplete="username" placeholder="Masukkan username" value={loginUsername} onChange={e => setLoginUsername(e.target.value)} required className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-12 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10" /></div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Password</label>
                  <div className="relative"><Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" /><input type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Masukkan password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-12 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10" /><button type="button" aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"} onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button></div>
                </div>
                <button type="submit" disabled={isLoadingAuth} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-700 to-blue-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-700/20 transition hover:-translate-y-0.5 hover:from-blue-800 hover:to-blue-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60">
                  {isLoadingAuth ? <><RefreshCw className="h-4 w-4 animate-spin" /> Memverifikasi akun…</> : <>Masuk Sekarang <ChevronRight className="h-4 w-4" /></>}
                </button>
                <p className="border-t border-slate-100 pt-5 text-center text-xs leading-5 text-slate-500">Akun akses dikelola oleh administrator sekolah. Jangan bagikan kata sandi Anda kepada siapa pun.</p>
                <p className="text-center text-[11px] font-medium tracking-wide text-slate-400">KELAS+ · versi {APP_VERSION}</p>
              </form>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row font-sans text-slate-800">
      <div className="fixed bottom-5 right-5 z-[95]">
        {chatOpen && <section className="mb-2 flex h-[min(76dvh,600px)] w-[min(94vw,410px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:mb-3">
          <header className="flex items-center gap-3 bg-gradient-to-r from-blue-950 to-blue-800 p-3 sm:p-4 text-white"><div className="relative flex h-9 w-9 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/40 bg-gradient-to-br from-cyan-300 via-blue-500 to-indigo-700 shadow-[inset_0_2px_3px_rgba(255,255,255,.65),0_6px_18px_rgba(2,132,199,.35)]"><span className="absolute inset-[3px] rounded-[11px] border border-white/25"></span><Bot className="relative h-5 w-5 sm:h-6 sm:w-6 text-white drop-shadow-[0_2px_2px_rgba(0,0,0,.45)]" strokeWidth={2.4} /></div><div className="min-w-0 flex-1"><p className="text-sm font-black">Asisten KELAS+</p><p className="text-[10px] text-blue-100">Panduan aplikasi & bantuan</p></div><button type="button" onClick={() => setChatOpen(false)} aria-label="Tutup chatbot" className="rounded-lg p-2 hover:bg-white/15"><X className="h-4 w-4" /></button></header>
          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-3 sm:p-4">{chatMessages.map((message,index)=><div key={index} className={message.role==='user'?'flex justify-end':'flex justify-start'}><p className={'max-w-[90%] whitespace-pre-wrap rounded-2xl px-3 py-2.5 text-sm leading-6 '+(message.role==='user'?'bg-blue-800 text-white':'border border-slate-200 bg-white text-slate-700')}>{message.text}</p></div>)}{chatMessages.length < 3 && <div className="rounded-xl border border-blue-100 bg-white p-3"><p className="mb-2 text-xs font-bold text-slate-600">Pertanyaan yang sering ditanyakan</p><div className="flex flex-wrap gap-2">{['Cara mengisi absensi','Cara mengisi jurnal','Cara menyimpan nilai','Cara cetak laporan PDF','Jadwal mengajar','Notifikasi tidak muncul'].map(question=><button key={question} type="button" onClick={()=>{setChatInput(question);}} className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-800 transition hover:bg-blue-100">{question}</button>)}</div></div>}</div>
          <div className="border-t border-slate-200 bg-white p-3"><div className="mb-2 flex items-center gap-2"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Hubungi call center</span><a href="mailto:guntursaputra.22.gs@gmail.com" title="Kirim email ke KELAS+" aria-label="Kirim email ke KELAS+" className="ml-auto flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700 transition hover:bg-blue-100"><Mail className="h-4 w-4" /></a><a href="https://wa.me/6285230607122" target="_blank" rel="noreferrer" title="Hubungi melalui WhatsApp" aria-label="Hubungi melalui WhatsApp" className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100"><MessageCircle className="h-5 w-5" /></a></div><form onSubmit={event => { event.preventDefault(); sendLocalAssistantMessage(); }} className="flex gap-2"><input value={chatInput} onChange={event=>setChatInput(event.target.value)} placeholder={chatSending ? "Asisten sedang menjawab…" : "Tanya cara menggunakan KELAS+..."} disabled={chatSending} className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 disabled:bg-slate-100" /><button type="submit" disabled={chatSending} aria-label="Kirim pertanyaan" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-800 text-white disabled:opacity-50"><Send className="h-4 w-4" /></button></form></div>
        </section>}
        <button type="button" onClick={() => setChatOpen(value => !value)} aria-label="Buka robot bantuan KELAS+" className="group relative ml-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-100/70 bg-gradient-to-br from-cyan-300 via-blue-600 to-indigo-900 shadow-[inset_0_2px_3px_rgba(255,255,255,.65),0_8px_22px_rgba(37,99,235,.4)] ring-1 ring-blue-300/50 transition duration-300 hover:-translate-y-1 hover:scale-105 sm:h-[60px] sm:w-[60px] sm:rounded-[21px] border border-cyan-100/70 bg-gradient-to-br from-cyan-300 via-blue-600 to-indigo-900 shadow-[inset_0_3px_4px_rgba(255,255,255,.65),inset_0_-5px_8px_rgba(3,7,18,.28),0_12px_30px_rgba(37,99,235,.42)] ring-1 ring-blue-300/50 transition duration-300 hover:-translate-y-1 hover:scale-105"><span className="absolute inset-[4px] rounded-[19px] border border-white/25"></span><span className="absolute left-3 top-2 h-3 w-7 rotate-[-25deg] rounded-full bg-white/35 blur-[1px]"></span><Bot className="relative h-6 w-6 text-white drop-shadow-[0_3px_3px_rgba(0,0,0,.5)] sm:h-8 sm:w-8" strokeWidth={2.2} /><span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-[3px] border-white bg-emerald-400 shadow-md sm:-right-1 sm:-top-1 sm:h-4 sm:w-4"></span></button>
      </div>
      {isLoggingOut && <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center text-white"><div className="w-16 h-16 rounded-full border-4 border-blue-300/30 border-t-amber-400 animate-spin" /><p className="mt-5 text-lg font-black">KELAS+</p><p className="mt-2 text-sm text-slate-200">Mengakhiri sesi…</p></div>}
      {toastNotice && <div data-toast-notice className={"fixed top-3 left-1/2 z-[120] w-[calc(100%-1.5rem)] max-w-lg -translate-x-1/2 rounded-2xl border border-blue-200 bg-white/95 p-4 shadow-xl backdrop-blur transition-all duration-500 " + (toastFading ? "translate-y-[-8px] opacity-0" : "translate-y-0 opacity-100")}><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><BellRing className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-extrabold text-slate-900">{toastNotice.title}</span><span className="mt-1 block text-xs text-slate-600">{toastNotice.message}</span><span className="mt-2 block text-[10px] font-bold text-blue-700">Notifikasi akan tertutup otomatis</span></span><button type="button" onClick={() => setToastNotice(null)} className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Tutup notifikasi"><X className="h-4 w-4" /></button></div></div>}
      
      {/* Mobile Top Navigation */}
      <div className="lg:hidden bg-slate-900 text-white p-4 flex justify-between items-center border-b border-slate-800 sticky top-0 z-50 shadow-md">
        <div>
          <h1 className="text-xl font-black text-white">KELAS<span className="text-amber-400">+</span></h1>
          <p className="text-[9px] text-slate-400 tracking-wider">{systemSettings.schoolName}</p>
        </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-slate-300 hover:text-white">
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Main Sidebar */}
      <aside className={`w-full lg:w-64 bg-slate-900 text-white flex-shrink-0 flex flex-col justify-between ${mobileMenuOpen ? 'block' : 'hidden lg:flex'} lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto`}>
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
                <button onClick={() => { setActiveTab('reports'); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition ${activeTab === 'reports' ? 'bg-blue-800 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'}`}>
                  <Printer className="w-4 h-4 text-purple-400" /> Laporan & PDF
                </button>
                <button onClick={() => { setActiveTab('ai'); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition ${activeTab === 'ai' ? 'bg-blue-800 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'}`}>
                  <Bot className="w-4 h-4 text-cyan-400" /> AI Assistant
                </button>
                <button onClick={() => { setActiveTab('schedule'); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition ${activeTab === 'schedule' ? 'bg-blue-800 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'}`}><Calendar className="w-4 h-4 text-cyan-300" /> Jadwal Mengajar</button>
                <button onClick={() => { setActiveTab('settings'); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition ${activeTab === 'settings' ? 'bg-blue-800 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'}`}>
                  <Settings className="w-4 h-4 text-slate-400" /> Pengaturan Profil
                </button>
              </>
            )}


            {currentUser.role === 'LEADER' && (
              <>
                <button onClick={() => { setActiveTab('leader_overview'); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition ${activeTab === 'leader_overview' ? 'bg-blue-800 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'}`}>
                  <BarChart2 className="w-4 h-4 text-amber-400" /> Dashboard Leader
                </button>
                <button onClick={() => { setActiveTab('schedule'); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition ${activeTab === 'schedule' ? 'bg-blue-800 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'}`}>
                  <Calendar className="w-4 h-4 text-cyan-300" /> Jadwal Mengajar
                </button>
                <button onClick={() => { setActiveTab('leader_followups'); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition ${activeTab === 'leader_followups' ? 'bg-blue-800 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'}`}><ClipboardCheck className="w-4 h-4 text-emerald-400" /> Tindak Lanjut Siswa</button>
                <button onClick={() => { setActiveTab('admin_teachers'); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition ${activeTab === 'admin_teachers' ? 'bg-blue-800 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'}`}><UserPlus className="w-4 h-4 text-amber-400" /> Daftar Guru</button>
                <button onClick={() => { setActiveTab('admin_classes'); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition ${activeTab === 'admin_classes' ? 'bg-blue-800 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'}`}><Layers className="w-4 h-4 text-purple-400" /> Daftar Kelas</button>
                <button onClick={() => { setActiveTab('admin_students'); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition ${activeTab === 'admin_students' ? 'bg-blue-800 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'}`}><Users className="w-4 h-4 text-emerald-400" /> Daftar Siswa</button>
                <button onClick={() => { setActiveTab('students'); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition ${activeTab === 'students' ? 'bg-blue-800 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'}`}><BookOpen className="w-4 h-4 text-cyan-400" /> Learning Map Sekolah</button>
                <button onClick={() => { setActiveTab('settings'); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition ${activeTab === 'settings' ? 'bg-blue-800 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'}`}>
                  <Settings className="w-4 h-4 text-slate-400" /> Pengaturan Profil
                </button>
              </>
            )}

            {currentUser.role === 'ADMIN' && (
              <>
                <button onClick={() => { setActiveTab('admin_overview'); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition ${activeTab === 'admin_overview' ? 'bg-blue-800 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'}`}><BarChart2 className="w-4 h-4 text-emerald-400" /> Dashboard Performa</button>
                <button onClick={() => { setActiveTab('admin_users'); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition ${activeTab === 'admin_users' ? 'bg-blue-800 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'}`}><Users className="w-4 h-4 text-cyan-400" /> Manajemen Akun</button>
                <button onClick={() => { setActiveTab('admin_teachers'); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition ${activeTab === 'admin_teachers' ? 'bg-blue-800 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'}`}><UserPlus className="w-4 h-4 text-amber-400" /> Manajemen Guru</button>
                <button onClick={() => { setActiveTab('admin_classes'); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition ${activeTab === 'admin_classes' ? 'bg-blue-800 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'}`}><Layers className="w-4 h-4 text-purple-400" /> Manajemen Kelas</button>
                <button onClick={() => { setActiveTab('admin_students'); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition ${activeTab === 'admin_students' ? 'bg-blue-800 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'}`}><UserPlus className="w-4 h-4 text-cyan-400" /> Manajemen Siswa</button>
                <button onClick={() => { setActiveTab('announcements'); setMobileMenuOpen(false); }} className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition text-slate-300 hover:bg-slate-800"><BellRing className="w-4 h-4 text-amber-400" /> Pengumuman Sekolah</button>
                <button onClick={() => { setActiveTab('admin_api'); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition ${activeTab === 'admin_api' ? 'bg-blue-800 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'}`}><Key className="w-4 h-4 text-amber-400" /> Konfigurasi AI</button>
                <button onClick={() => { setActiveTab('schedule'); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition ${activeTab === 'schedule' ? 'bg-blue-800 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'}`}><Calendar className="w-4 h-4 text-cyan-300" /> Jadwal Mengajar</button>
                <button onClick={() => { setActiveTab('settings'); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition ${activeTab === 'settings' ? 'bg-blue-800 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'}`}><Settings className="w-4 h-4 text-slate-400" /> Pengaturan Kop Surat & Admin</button>
              </>
            )}

          </nav>
        </div>

        <div className="p-4 border-t border-slate-800 flex items-center justify-between sticky bottom-0 bg-slate-900 z-10 lg:mt-auto">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full border border-slate-700 bg-slate-100 flex items-center justify-center text-slate-500" aria-label="Avatar pengguna"><svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true"><path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2c-4.1 0-7.5 2.2-7.5 5v2h15v-2c0-2.8-3.4-5-7.5-5Z"/></svg></div>
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
      <main className="relative flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full min-w-0">
        
        {/* TEACHER - DASHBOARD */}
        {currentUser.role === 'TEACHER' && activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div><h1 className="text-2xl font-black text-slate-900">Selamat datang, {currentUser.name}! 👋</h1><p className="text-xs text-slate-500 mt-1">Sistem Informasi Pengajaran UPTD SMPN 2 Bajuin · Tahun {systemSettings.academicYear}</p></div>
              <button onClick={() => { setAttendanceDate(localDateString()); setActiveTab('attendance'); }} className="px-4 py-2 bg-blue-800 text-white text-xs font-bold rounded-xl shadow-sm hover:bg-blue-900 transition flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Input Presensi</button>
            </div>
            <section className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3"><div className="flex items-center justify-between"><div><h2 className="font-bold text-slate-900">Jadwal Mengajar Hari Ini</h2><p className="text-xs text-slate-500 mt-1">{deviceNow.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p></div><button onClick={() => setActiveTab("schedule")} className="text-xs font-bold text-blue-800">Lihat semua</button></div>{scheduleLoading && schedules.length === 0 ? <p className="text-xs text-slate-500">Memuat jadwal…</p> : schedules.filter(item => Number(item.dayOfWeek) === ((deviceNow.getDay() + 6) % 7 + 1)).sort((a,b) => a.startTime.localeCompare(b.startTime)).length === 0 ? <p className="text-xs text-slate-500">Tidak ada jadwal mengajar hari ini.</p> : <div className="space-y-2">{schedules.filter(item => Number(item.dayOfWeek) === ((deviceNow.getDay() + 6) % 7 + 1)).sort((a,b) => a.startTime.localeCompare(b.startTime)).map(item => { const now = String(deviceNow.getHours()).padStart(2,"0") + ":" + String(deviceNow.getMinutes()).padStart(2,"0"); const active = now >= item.startTime && now < item.endTime; const next = now < item.startTime; return <button type="button" key={item.id} onClick={() => { setSelectedClass(item.className); setAttendanceDate(localDateString(deviceNow)); setActiveTab('attendance'); setMobileMenuOpen(false); setToastNotice({ title: 'Menu absensi dibuka', message: `Kelas ${item.className} · ${item.subject}`, type: 'info' }); }} className="w-full text-left flex items-center justify-between gap-3 p-3 rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 hover:-translate-y-0.5 active:translate-y-0 active:shadow-inner transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"><div><p className="text-sm font-bold text-slate-800">{item.subject} · {item.className}</p><p className="text-xs text-slate-500">{item.startTime}–{item.endTime}{item.room ? " · " + item.room : ""}</p><p className="text-[10px] text-blue-700 font-semibold mt-1">Klik untuk membuka absensi kelas <span aria-hidden="true">→</span></p></div><span className={"shrink-0 text-[10px] font-bold px-2 py-1 rounded-full " + (active ? "bg-emerald-100 text-emerald-700" : next ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-600")}>{active ? "Sedang berlangsung" : next ? "Berikutnya" : "Selesai"}</span></button>; })}</div>}</section>
             <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
               <div className="p-5 flex items-center justify-between gap-3 border-b border-slate-100"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center"><BellRing className="w-5 h-5" /></div><div><h2 className="font-bold text-slate-900">Pengumuman Sekolah</h2><p className="text-xs text-slate-500 mt-1">Informasi resmi dari administrator</p></div></div><span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{announcements.length} aktif</span></div>
               {announcements.length === 0 ? <div className="px-5 py-6 flex items-start gap-3"><Bell className="w-5 h-5 text-slate-400 mt-0.5" /><div><p className="text-sm font-semibold text-slate-700">Belum ada pengumuman</p><p className="text-xs text-slate-500 mt-1">Pengumuman dari administrator akan muncul di sini.</p></div></div> : <div className="divide-y divide-slate-100">{announcements.slice(0, 3).map(item => <article key={item.id} className="p-5 flex items-start gap-3"><div className={"mt-0.5 rounded-lg p-2 " + (item.type === 'important' ? 'bg-amber-50 text-amber-700' : item.type === 'event' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700')}>{item.type === 'important' ? <AlertTriangle className="w-4 h-4" /> : item.type === 'event' ? <Calendar className="w-4 h-4" /> : <Bell className="w-4 h-4" />}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-bold text-slate-900">{item.title}</h3>{item.pinned && <span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold">PENTING</span>}</div><p className="text-xs text-slate-600 leading-relaxed mt-1.5 whitespace-pre-wrap">{item.message}</p><p className="text-[10px] text-slate-400 mt-2">{item.createdByName ? 'Oleh ' + item.createdByName + ' · ' : ''}{item.createdAt ? new Date(item.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}</p></div></article>)}</div>}
             </section>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm"><span className="text-xs text-slate-500">Kelas Pengampuan</span><p className="text-2xl font-black text-blue-800 mt-1">{teacherAssignedClasses.length}</p><p className="text-[10px] text-slate-500 mt-1">{teacherAssignedClasses.join(', ') || 'Belum ditentukan'}</p></div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm"><span className="text-xs text-slate-500">Jumlah Siswa Diampu</span><p className="text-2xl font-black text-emerald-600 mt-1">{students.filter(s => teacherAssignedClasses.includes('ALL') || teacherAssignedClasses.includes(s.class)).length}</p></div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm"><span className="text-xs text-slate-500">Jurnal Tersimpan</span><p className="text-2xl font-black text-purple-600 mt-1">{journals.length}</p><button onClick={() => setActiveTab('journal')} className="text-[10px] text-blue-800 font-bold mt-2">Buka Smart Journal →</button></div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm"><span className="text-xs text-slate-500">Status Asisten AI</span><p className="text-sm font-black text-cyan-700 mt-2">{isServerOnline ? 'Backend terhubung' : 'Backend belum terhubung'}</p><button onClick={() => setActiveTab('ai')} className="text-[10px] text-blue-800 font-bold mt-2">Buka AI Assistant →</button></div>
            </div>
            <section className="bg-gradient-to-br from-slate-900 via-blue-950 to-blue-900 p-5 md:p-6 rounded-2xl shadow-lg text-white"><div className="flex items-center justify-between gap-3"><div><h2 className="font-extrabold text-lg">Langkah cepat</h2><p className="text-xs text-blue-100 mt-1">Pilih tindakan untuk melanjutkan kegiatan mengajar.</p></div><Sparkles className="w-6 h-6 text-amber-300" /></div><div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5"><button onClick={() => { setAttendanceDate(localDateString()); setActiveTab('attendance'); }} className="group min-h-20 px-4 py-4 rounded-xl bg-white text-blue-900 text-left font-bold shadow-md hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all focus:outline-none focus:ring-2 focus:ring-amber-300"><span className="flex items-center gap-2 text-sm"><CheckCircle className="w-5 h-5 text-emerald-600" /> Absensi Cepat</span><span className="block text-[11px] text-slate-500 font-medium mt-2">Catat kehadiran siswa →</span></button><button onClick={() => setActiveTab('journal')} className="group min-h-20 px-4 py-4 rounded-xl bg-white text-blue-900 text-left font-bold shadow-md hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all focus:outline-none focus:ring-2 focus:ring-amber-300"><span className="flex items-center gap-2 text-sm"><BookOpen className="w-5 h-5 text-purple-600" /> Isi Smart Jurnal</span><span className="block text-[11px] text-slate-500 font-medium mt-2">Catat kegiatan pembelajaran →</span></button><button onClick={() => setActiveTab('students')} className="group min-h-20 px-4 py-4 rounded-xl bg-white text-blue-900 text-left font-bold shadow-md hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all focus:outline-none focus:ring-2 focus:ring-amber-300"><span className="flex items-center gap-2 text-sm"><Award className="w-5 h-5 text-amber-600" /> Nilai Tugas</span><span className="block text-[11px] text-slate-500 font-medium mt-2">Pantau capaian siswa →</span></button></div></section>
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
                    <button onClick={() => { setSelectedClass(cls.name); setActiveTab('attendance'); }} className="flex-1 py-2.5 bg-gradient-to-b from-blue-700 to-blue-900 text-white text-xs font-extrabold rounded-xl shadow-md shadow-blue-900/20 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:shadow-inner transition-all ring-1 ring-blue-600/30">
                      Absensi
                    </button>
                    <button onClick={() => { setSelectedClass(cls.name); setActiveTab('journal'); }} className="flex-1 py-2.5 bg-gradient-to-b from-white to-slate-100 text-slate-800 text-xs font-extrabold rounded-xl border border-slate-200 shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:shadow-inner transition-all">
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
                  max={localDateString()}
                  onChange={e => setAttendanceDate(e.target.value)}
                  className="p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold shadow-sm"
                />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
              <div className="p-4 bg-slate-50 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                <div><p className="text-xs font-bold text-slate-700">Presensi Kelas {selectedClass} — Tanggal: {attendanceDate}</p><p className={`text-[11px] font-bold mt-1 ${attendanceSaveStatus === 'saved' ? 'text-emerald-700' : attendanceSaveStatus === 'error' ? 'text-rose-700' : 'text-amber-700'}`}>{attendanceSaveStatus === 'saved' ? '✓ Presensi tersimpan di database' : attendanceSaveStatus === 'saving' ? 'Menyimpan presensi…' : attendanceSaveStatus === 'error' ? 'Gagal menyimpan — silakan coba lagi' : '● Ada perubahan yang belum disimpan'}</p></div>
                <div className="flex flex-wrap gap-2"><button onClick={handleMarkAllPresent} className="px-3.5 py-2 bg-blue-50 text-blue-800 text-xs font-bold rounded-xl border border-blue-200 hover:bg-blue-100 transition">✓ Tandai Semua Hadir</button><button onClick={handleSaveAttendance} disabled={savingAttendance || attendanceSaveStatus === 'saved'} className="px-4 py-2 bg-emerald-700 text-white text-xs font-bold rounded-xl hover:bg-emerald-800 disabled:opacity-50 transition">{savingAttendance ? 'Menyimpan…' : 'Simpan / Kumpulkan Absen'}</button></div>
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
                    {['PRESENT', 'SICK', 'PERMISSION', 'ABSENT'].map(st => {
                      const isActive = currentAttendance[std.id] === st;
                      const label = { PRESENT: 'Hadir', SICK: 'Sakit', PERMISSION: 'Izin', ABSENT: 'Alpa' }[st];
                      let activeStyle = '';
                      if (st === 'PRESENT') activeStyle = 'bg-emerald-600 text-white font-bold shadow-sm';
                      if (st === 'SICK') activeStyle = 'bg-amber-500 text-white font-bold shadow-sm';
                      if (st === 'PERMISSION') activeStyle = 'bg-blue-600 text-white font-bold shadow-sm';
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
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
              <div><h1 className="text-2xl font-black text-slate-900">Student Learning Map</h1><p className="text-xs text-slate-500 mt-1">Pilih kelas yang diampu, pantau kehadiran, rata-rata nilai, dan status siswa.</p></div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs font-bold text-slate-600">Kelas</label>
                <select value={mapClassFilter} onChange={e => { setMapClassFilter(e.target.value); setStudentSearchTerm(''); }} className="p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold">
                  <option value="ALL">Semua kelas yang diampu</option>{teacherAssignedClasses.filter(c => c !== 'ALL').map(c => <option key={c} value={c}>Kelas {c}</option>)}
                </select>
                <input type="text" placeholder="Cari nama/NISN..." value={studentSearchTerm} onChange={e => setStudentSearchTerm(e.target.value)} className="p-2.5 bg-white border border-slate-300 rounded-xl text-xs" />
                <button onClick={handleSaveAllGrades} disabled={savingAllGrades} className="px-3 py-2.5 bg-blue-800 text-white rounded-xl text-xs font-bold disabled:opacity-50">{savingAllGrades ? 'Menyimpan…' : 'Simpan Semua Nilai'}</button>
                <button onClick={handleAddLearningTask} className="px-3 py-2.5 bg-emerald-700 text-white rounded-xl text-xs font-bold">+ Tambah Tugas</button>
              </div>
            </div>
            <p className="text-xs text-slate-500">Mata pelajaran: <b>{currentUser.subject || 'yang diampu'}</b> · {teacherLearningTasks.length} tugas aktif milik akun Anda · Nilai 0–100.</p>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[900px]">
                <thead className="bg-slate-100 text-slate-600 font-bold uppercase border-b border-slate-200"><tr><th className="p-3">Nama Siswa</th><th className="p-3">Kelas</th><th className="p-3 text-center">Kehadiran</th>{teacherLearningTasks.map(task=><th key={task.id} className="p-3 text-center"><div>{task.title}</div><div className="text-[10px] normal-case text-slate-400 mt-1">Tugas {task.assignmentNo}</div><button type="button" title={'Hapus '+task.title} disabled={teacherLearningTasks.length<=1} onClick={()=>handleDeleteLearningTask(task)} className="mt-1 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-rose-50 text-rose-700 normal-case disabled:opacity-30"><Trash2 className="w-3 h-3"/> Hapus</button></th>)}<th className="p-3 text-center">Rata-rata</th><th className="p-3 text-center">Simpan</th><th className="p-3 text-center">Status</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.map(std => <tr key={std.id} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-800">{std.name}</td><td className="p-3 font-bold text-blue-800">{std.class}</td>
                    <td className="p-3 text-center font-mono">{std.attendanceRate == null ? 'Belum ada data' : std.attendanceRate + '%'}</td>
                    {teacherLearningTasks.map(task=><td key={task.id} className="p-2 text-center"><input type="number" min="0" max="100" step="0.01" aria-label={'Nilai '+task.title+' '+std.name} value={gradeDrafts[std.id]?.[task.assignmentNo] ?? ''} onChange={e=>setGradeDrafts(prev=>({...prev,[std.id]:{...(prev[std.id]||{}),[task.assignmentNo]:e.target.value}}))} className="w-16 p-2 text-center border border-slate-300 rounded-lg" placeholder="—" /></td>)}
                    <td className="p-3 text-center font-bold">{std.averageScore == null ? '—' : std.averageScore+'%'}</td>
                    <td className="p-2 text-center"><button onClick={()=>handleSaveStudentGrades(std)} disabled={savingGradesFor===std.id} className="px-3 py-2 rounded-lg bg-blue-800 text-white font-bold disabled:opacity-50">{savingGradesFor===std.id?'Menyimpan…':'Simpan'}</button></td>
                    <td className="p-3 text-center whitespace-nowrap">
                      {std.statusFlag==='VERY_GOOD' && <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">🟢 Sangat Baik</span>}
                      {std.statusFlag==='GOOD' && <span className="px-2.5 py-1 bg-orange-100 text-orange-800 text-[10px] font-bold rounded-full">🟠 Baik</span>}
                      {std.statusFlag==='NEEDS_SUPPORT' && <span className="px-2.5 py-1 bg-yellow-100 text-yellow-900 text-[10px] font-bold rounded-full">🟡 Perlu Pendampingan</span>}
                      {std.statusFlag==='WATCH' && <span className="px-2.5 py-1 bg-amber-100 text-red-700 text-[10px] font-bold rounded-full">⚠️ Butuh Pengawasan</span>}
                      {std.statusFlag==='NO_DATA' && <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-full">Belum Ada Data</span>}
                    </td>
                  </tr>)}
                  {!filteredStudents.length && <tr><td colSpan={teacherLearningTasks.length+6} className="p-6 text-center text-slate-500">Tidak ada siswa untuk kelas/pencarian ini.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {/* TEACHER - REPORTS AND PDF EXPORT */}
        {currentUser.role === 'TEACHER' && activeTab === 'reports' && (
          <div className="space-y-6">
            <div><h1 className="text-2xl font-black text-slate-900 flex items-center gap-2"><Printer className="w-6 h-6 text-purple-700" /> Laporan & Ekspor PDF</h1><p className="text-xs text-slate-500 mt-1">Cetak rekap jurnal, absensi, dan nilai secara terpisah dengan format siap arsip.</p></div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><label className="block text-xs font-bold text-slate-700 mb-1">Kelas</label><select value={reportClass || selectedClass} onChange={e=>setReportClass(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold">{teacherAssignedClasses.filter(c=>c!=='ALL').map(c=><option key={c} value={c}>Kelas {c}</option>)}</select></div>
              <div><label className="block text-xs font-bold text-slate-700 mb-1">Tanggal Awal</label><input type="date" value={reportFromDate} onChange={e=>setReportFromDate(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs"/></div>
              <div><label className="block text-xs font-bold text-slate-700 mb-1">Tanggal Akhir</label><input type="date" value={reportToDate} onChange={e=>setReportToDate(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs"/></div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm"><div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center mb-3"><FileText className="w-5 h-5"/></div><h2 className="font-extrabold text-slate-900">Jurnal Mengajar</h2><p className="text-xs text-slate-500 mt-2 mb-4">Tanggal, materi, metode, dan catatan refleksi jurnal pada periode terpilih.</p><button onClick={()=>generatePdfReport('journal')} className="w-full py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold flex items-center justify-center gap-2"><Download className="w-4 h-4"/> Cetak / Simpan PDF</button></div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm"><div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-3"><CheckCircle className="w-5 h-5"/></div><h2 className="font-extrabold text-slate-900">Rekap Absensi</h2><p className="text-xs text-slate-500 mt-2 mb-4">Daftar siswa, tanggal kehadiran, status, serta ringkasan hadir, terlambat, sakit, izin, dan alpa.</p><button onClick={()=>generatePdfReport('attendance')} className="w-full py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center justify-center gap-2"><Download className="w-4 h-4"/> Cetak / Simpan PDF</button></div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm"><div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center mb-3"><BarChart2 className="w-5 h-5"/></div><h2 className="font-extrabold text-slate-900">Rekap Nilai Tugas</h2><p className="text-xs text-slate-500 mt-2 mb-4">Tabel nilai tiap siswa, tugas aktif milik Anda, dan rata-rata nilai.</p><button onClick={()=>generatePdfReport('grades')} className="w-full py-2.5 rounded-xl bg-blue-800 hover:bg-blue-900 text-white text-xs font-bold flex items-center justify-center gap-2"><Download className="w-4 h-4"/> Cetak / Simpan PDF</button></div>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-900"><b>Petunjuk:</b> pilih kelas dan rentang tanggal, lalu klik salah satu laporan. Pada dialog cetak browser, pilih <b>Simpan sebagai PDF (Save as PDF)</b>. Setiap laporan dibuat terpisah dan dilengkapi tanggal cetak serta ruang tanda tangan.</div>
          </div>
        )}

        {/* LEADER - STUDENT FOLLOW-UP */}
        {currentUser.role === 'LEADER' && activeTab === 'leader_followups' && (
          <div className="space-y-6 max-w-6xl">
            <div><h1 className="text-2xl font-black text-slate-900 flex items-center gap-2"><ClipboardCheck className="w-6 h-6 text-emerald-700"/> Tindak Lanjut Siswa</h1><p className="text-xs text-slate-500 mt-1">Catat pembinaan dan tindak lanjut bagi siswa yang membutuhkan perhatian khusus.</p></div>
            <form onSubmit={handleSaveFollowUp} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="font-extrabold text-slate-900">Catatan tindak lanjut baru</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="text-xs font-bold text-slate-700">Cari nama siswa<input value={followUpSearch} onChange={e=>setFollowUpSearch(e.target.value)} placeholder="Ketik nama siswa atau NISN..." className="mt-1 w-full p-3 border border-slate-300 rounded-xl text-sm font-normal"/></label>
                <label className="text-xs font-bold text-slate-700">Pilih siswa<select required value={followUpForm.studentId} onChange={e=>setFollowUpForm(p=>({...p,studentId:e.target.value}))} className="mt-1 w-full p-3 border border-slate-300 rounded-xl bg-white text-sm font-normal"><option value="">Pilih siswa</option>{students.filter(st=>st.name.toLowerCase().includes(followUpSearch.toLowerCase())||String(st.nisn||'').includes(followUpSearch)).map(st=><option key={st.id} value={st.id}>{st.name} · Kelas {st.class} · {st.nisn||'Tanpa NISN'}</option>)}</select></label>
                <label className="text-xs font-bold text-slate-700">Tanggal tindak lanjut<input type="date" required value={followUpForm.date} onChange={e=>setFollowUpForm(p=>({...p,date:e.target.value}))} className="mt-1 w-full p-3 border border-slate-300 rounded-xl text-sm font-normal"/></label>
                <label className="text-xs font-bold text-slate-700">Kategori<select value={followUpForm.category} onChange={e=>setFollowUpForm(p=>({...p,category:e.target.value}))} className="mt-1 w-full p-3 border border-slate-300 rounded-xl bg-white text-sm font-normal"><option>Kehadiran rendah</option><option>Nilai akademik rendah</option><option>Perilaku / kedisiplinan</option><option>Motivasi belajar</option><option>Permasalahan sosial-emosional</option><option>Lainnya</option></select></label>
                <label className="text-xs font-bold text-slate-700 md:col-span-2">Tindakan yang dilakukan<textarea required rows={3} maxLength={3000} value={followUpForm.action} onChange={e=>setFollowUpForm(p=>({...p,action:e.target.value}))} placeholder="Tuliskan langkah pembinaan, komunikasi dengan siswa/orang tua, atau intervensi yang dilakukan..." className="mt-1 w-full p-3 border border-slate-300 rounded-xl text-sm font-normal"/></label>
                <label className="text-xs font-bold text-slate-700 md:col-span-2">Hasil tindak lanjut<textarea required rows={3} maxLength={3000} value={followUpForm.result} onChange={e=>setFollowUpForm(p=>({...p,result:e.target.value}))} placeholder="Jelaskan respons siswa dan perubahan yang teramati..." className="mt-1 w-full p-3 border border-slate-300 rounded-xl text-sm font-normal"/></label>
                <label className="text-xs font-bold text-slate-700 md:col-span-2">Rencana tindak lanjut berikutnya<textarea rows={2} maxLength={2000} value={followUpForm.nextStep} onChange={e=>setFollowUpForm(p=>({...p,nextStep:e.target.value}))} placeholder="Langkah pemantauan selanjutnya..." className="mt-1 w-full p-3 border border-slate-300 rounded-xl text-sm font-normal"/></label>
                <label className="text-xs font-bold text-slate-700">Status<select value={followUpForm.status} onChange={e=>setFollowUpForm(p=>({...p,status:e.target.value}))} className="mt-1 w-full p-3 border border-slate-300 rounded-xl bg-white text-sm font-normal"><option value="MONITORING">Perlu monitoring</option><option value="SELESAI">Tindak lanjut selesai</option></select></label>
                <label className="text-xs font-bold text-slate-700">Catatan tambahan<textarea rows={2} maxLength={2000} value={followUpForm.notes} onChange={e=>setFollowUpForm(p=>({...p,notes:e.target.value}))} className="mt-1 w-full p-3 border border-slate-300 rounded-xl text-sm font-normal"/></label>
              </div>
              {followUpNotice && <p className="rounded-xl bg-blue-50 text-blue-800 p-3 text-xs font-semibold">{followUpNotice}</p>}
              <button disabled={followUpSaving} className="px-5 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2"><Save className="w-4 h-4"/>{followUpSaving?'Menyimpan laporan…':'Simpan Tindak Lanjut'}</button>
            </form>
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100"><h2 className="font-extrabold text-slate-900">Riwayat tindak lanjut</h2><p className="text-xs text-slate-500 mt-1">{followUps.length} catatan tersimpan</p></div>
              {followUps.length===0 ? <p className="p-8 text-center text-sm text-slate-500">Belum ada catatan tindak lanjut.</p> : <div className="divide-y divide-slate-100">{followUps.map(record=><article key={record.id} className="p-5 space-y-3"><div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3"><div><h3 className="font-bold text-slate-900">{record.studentName} <span className="font-normal text-slate-500">· Kelas {record.studentClass}</span></h3><p className="text-xs text-slate-500 mt-1">{record.date} · {record.category} · Petugas: {record.createdByName}</p></div><div className="flex items-center gap-2"><span className={'px-2.5 py-1 rounded-full text-[10px] font-bold '+(record.status==='SELESAI'?'bg-emerald-50 text-emerald-700':'bg-amber-50 text-amber-700')}>{record.status==='SELESAI'?'Selesai':'Monitoring'}</span><button type="button" onClick={()=>generateFollowUpPdf(record)} className="px-3 py-2 rounded-lg bg-blue-800 hover:bg-blue-900 text-white text-xs font-bold flex items-center gap-1"><Printer className="w-3.5 h-3.5"/> Cetak PDF</button></div></div><div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs"><div className="rounded-xl bg-slate-50 p-3"><p className="font-bold text-slate-700 mb-1">Tindakan</p><p className="text-slate-600 whitespace-pre-wrap">{record.action}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="font-bold text-slate-700 mb-1">Hasil</p><p className="text-slate-600 whitespace-pre-wrap">{record.result}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="font-bold text-slate-700 mb-1">Rencana berikutnya</p><p className="text-slate-600 whitespace-pre-wrap">{record.nextStep||'-'}</p></div></div></article>)}</div>}
            </section>
          </div>
        )}

        {/* LEADER - SCHOOL-WIDE LEARNING MAP */}
        {currentUser.role === 'LEADER' && activeTab === 'students' && (
          <div className="space-y-6">
            <div><h1 className="text-2xl font-black text-slate-900">Learning Map Sekolah</h1><p className="text-xs text-slate-500 mt-1">Seluruh kelas dipantau bersama. Siswa yang butuh pengawasan ditampilkan paling atas.</p></div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-3"><label className="text-xs font-bold text-slate-700">Filter kelas<select value={mapClassFilter} onChange={e=>setMapClassFilter(e.target.value)} className="mt-1 w-full p-2.5 border border-slate-300 rounded-xl bg-white"><option value="ALL">Semua kelas</option>{classesList.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select></label><label className="text-xs font-bold text-slate-700">Cari nama / NISN siswa<input value={studentSearchTerm} onChange={e=>setStudentSearchTerm(e.target.value)} placeholder="Cari siswa yang perlu dipantau..." className="mt-1 w-full p-2.5 border border-slate-300 rounded-xl text-xs"/></label></div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                {key:'WATCH',label:'Butuh Pengawasan',color:'text-red-700'},
                {key:'NEEDS_SUPPORT',label:'Perlu Pendampingan',color:'text-yellow-700'},
                {key:'GOOD',label:'Baik',color:'text-orange-700'},
                {key:'VERY_GOOD',label:'Sangat Baik',color:'text-emerald-700'}
              ].map(item=><div key={item.key} className="bg-white p-4 rounded-xl border border-slate-200"><p className="text-xs text-slate-500">{item.label}</p><p className={'text-2xl font-black '+item.color}>{leaderLearningStudents.filter(s=>s.statusFlag===item.key).length}</p></div>)}
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto"><table className="w-full text-left text-xs min-w-[780px]">
              <thead className="bg-slate-100 text-slate-600 font-bold uppercase"><tr><th className="p-3">Nama Siswa</th><th className="p-3">Kelas</th><th className="p-3">Kehadiran</th><th className="p-3">Rata-rata Tugas</th><th className="p-3">Status Perhatian</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{filteredLeaderStudents.map(std=><tr key={std.id} className={std.statusFlag==='WATCH'?'bg-amber-50':std.statusFlag==='NEEDS_SUPPORT'?'bg-yellow-50':'hover:bg-slate-50'}>
                <td className="p-3 font-bold">{std.name}</td><td className="p-3">{std.class}</td><td className="p-3">{std.attendanceRate==null?'Belum ada data':std.attendanceRate+'%'}</td><td className="p-3">{std.averageScore==null?'Belum ada nilai':std.averageScore+'%'}</td>
                <td className="p-3 whitespace-nowrap">
                  {std.statusFlag==='VERY_GOOD'&&<span>🟢 Sangat Baik</span>}{std.statusFlag==='GOOD'&&<span>🟠 Baik</span>}{std.statusFlag==='NEEDS_SUPPORT'&&<span>🟡 Perlu Pendampingan</span>}{std.statusFlag==='WATCH'&&<span>⚠️ Butuh Pengawasan</span>}{std.statusFlag==='NO_DATA'&&<span className="text-slate-500">Belum Ada Data</span>}
                </td></tr>)}</tbody>
            </table></div>
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
                  <select value={aiSubject} onChange={e => setAiSubject(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold">{SUBJECT_OPTIONS.map(subject => <option key={subject} value={subject}>{subject}</option>)}</select>
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


        {/* LEADER - OVERVIEW */}
        {currentUser.role === 'LEADER' && activeTab === 'leader_overview' && (
          <div className="space-y-6">
            <div><h1 className="text-2xl font-black text-slate-900">Dashboard Leader</h1><p className="text-xs text-slate-500 mt-1">Ringkasan guru, kelas, dan siswa. Buka daftar lengkap melalui tombol Selengkapnya.</p></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm"><p className="text-xs text-slate-500">Total Guru Aktif</p><p className="text-2xl font-black text-blue-800">{users.filter(u => u.role === 'TEACHER' && u.active).length} Guru</p><div className="mt-3 space-y-2">{users.filter(u => u.role === 'TEACHER' && u.active).slice(0,5).map(u => <p key={u.id} className="text-xs text-slate-700">{u.name} <span className="text-slate-400">· {u.subject || 'Mapel belum diisi'}</span></p>)}</div><button onClick={() => setActiveTab('admin_teachers')} className="mt-4 text-xs font-bold text-blue-800 hover:underline">Selengkapnya: Daftar Guru →</button></div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm"><p className="text-xs text-slate-500">Total Kelas Aktif</p><p className="text-2xl font-black text-purple-600">{classesList.length} Kelas</p><div className="mt-3 space-y-2">{classesList.slice(0,5).map(k => <p key={k.id} className="text-xs text-slate-700">Kelas {k.name} <span className="text-slate-400">· {students.filter(s => s.class === k.name).length} siswa</span></p>)}</div><button onClick={() => setActiveTab('admin_classes')} className="mt-4 text-xs font-bold text-purple-700 hover:underline">Selengkapnya: Daftar Kelas →</button></div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm"><p className="text-xs text-slate-500">Total Siswa Aktif</p><p className="text-2xl font-black text-emerald-600">{students.length} Siswa</p><div className="mt-3 space-y-2">{students.slice(0,5).map(s => <p key={s.id} className="text-xs text-slate-700">{s.name} <span className="text-slate-400">· {s.class}</span></p>)}</div><button onClick={() => setActiveTab('admin_students')} className="mt-4 text-xs font-bold text-emerald-700 hover:underline">Selengkapnya: Daftar Siswa →</button></div>
            </div>
          </div>
        )}

        {/* ADMIN - OVERVIEW */}
        {currentUser.role === 'ADMIN' && activeTab === 'admin_overview' && (
          <div className="space-y-6">
            <div><h1 className="text-2xl font-black text-slate-900">Dashboard Performa Sekolah</h1><p className="text-xs text-slate-500 mt-1">Ringkasan akun guru, kelas, dan siswa UPTD SMPN 2 Bajuin.</p></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm"><p className="text-xs text-slate-500">Total Guru Aktif</p><p className="text-2xl font-black text-blue-800">{users.filter(u => u.role === 'TEACHER' && u.active).length} Guru</p><div className="mt-3 space-y-2">{users.filter(u => u.role === 'TEACHER' && u.active).slice(0,5).map(u => <p key={u.id} className="text-xs text-slate-700">{u.name} <span className="text-slate-400">· {u.subject || 'Mapel belum diisi'}</span></p>)}</div><button onClick={() => setActiveTab('admin_teachers')} className="mt-4 text-xs font-bold text-blue-800 hover:underline">Selengkapnya: Manajemen Guru →</button></div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm"><p className="text-xs text-slate-500">Total Kelas Aktif</p><p className="text-2xl font-black text-purple-600">{classesList.length} Kelas</p><div className="mt-3 space-y-2">{classesList.slice(0,5).map(k => <p key={k.id} className="text-xs text-slate-700">Kelas {k.name} <span className="text-slate-400">· {students.filter(s => s.class === k.name).length} siswa</span></p>)}</div><button onClick={() => setActiveTab('admin_classes')} className="mt-4 text-xs font-bold text-purple-700 hover:underline">Selengkapnya: Manajemen Kelas →</button></div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm"><p className="text-xs text-slate-500">Total Siswa Aktif</p><p className="text-2xl font-black text-emerald-600">{students.length} Siswa</p><div className="mt-3 space-y-2">{students.slice(0,5).map(s => <p key={s.id} className="text-xs text-slate-700">{s.name} <span className="text-slate-400">· {s.class}</span></p>)}</div><button onClick={() => setActiveTab('admin_students')} className="mt-4 text-xs font-bold text-emerald-700 hover:underline">Selengkapnya: Manajemen Siswa →</button></div>
            </div>
          </div>
        )}

        {/* ADMIN - MANAJEMEN GURU */}
        {currentUser.role === 'ADMIN' && activeTab === 'admin_users' && (
          <div className="space-y-6">
            <div><h1 className="text-2xl font-black text-slate-900">Manajemen Akun</h1><p className="text-xs text-slate-500 mt-1">Atur peran, reset password, dan aktif/nonaktifkan akun. Izin tetap divalidasi oleh server.</p></div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[760px]">
                <thead className="bg-slate-100 text-slate-600 uppercase"><tr><th className="p-3">Nama</th><th className="p-3">Username</th><th className="p-3">Peran</th><th className="p-3">Status</th><th className="p-3">Tindakan</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map(u => <tr key={u.id} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-800">{u.name}</td><td className="p-3 font-mono">{u.username}</td><td className="p-3">{u.role}</td>
                    <td className="p-3"><span className={`px-2 py-1 rounded-full font-bold ${u.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>{u.active ? 'Aktif' : 'Nonaktif'}</span></td>
                    <td className="p-3"><div className="flex flex-wrap gap-2">
                      {(u.role === 'TEACHER' || u.role === 'LEADER') && u.active && <button onClick={() => handleUserRoleChange(u.id, u.role === 'TEACHER' ? 'LEADER' : 'TEACHER')} className="px-2 py-1 rounded bg-blue-50 text-blue-800 font-bold">Jadikan {u.role === 'TEACHER' ? 'Leader' : 'Guru'}</button>}
                      {u.active && <button onClick={() => handleResetUserPassword(u.id)} className="px-2 py-1 rounded bg-amber-50 text-amber-800 font-bold">Reset Password</button>}
                      <button onClick={() => handleToggleUserActive(u)} disabled={u.id === currentUser.id && u.active} className="px-2 py-1 rounded bg-rose-50 text-rose-800 font-bold disabled:opacity-40">{u.active ? 'Nonaktifkan' : 'Aktifkan'}</button>
                    </div></td>
                  </tr>)}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {(currentUser.role === 'ADMIN' || currentUser.role === 'LEADER') && activeTab === 'admin_teachers' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-blue-800" /> Tambah Akun Guru Baru
              </h2>
              {currentUser.role === 'ADMIN' && <form onSubmit={handleAddTeacher} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <input type="text" placeholder="Nama Guru & Gelar" value={newTeacher.name} onChange={e => setNewTeacher({...newTeacher, name: e.target.value})} className="p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs" required />
                <input type="text" placeholder="NIP" value={newTeacher.nip} onChange={e => setNewTeacher({...newTeacher, nip: e.target.value})} className="p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs" />
                <select value={newTeacher.subject} onChange={e => setNewTeacher({...newTeacher, subject: e.target.value})} className="p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs" required>{SUBJECT_OPTIONS.map(subject => <option key={subject} value={subject}>{subject}</option>)}</select>
                <input type="text" placeholder="Username Login" value={newTeacher.username} onChange={e => setNewTeacher({...newTeacher, username: e.target.value})} className="p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs" required />
                <input type="password" minLength="12" placeholder="Password Login (min. 12 karakter)" value={newTeacher.password} onChange={e => setNewTeacher({...newTeacher, password: e.target.value})} className="p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs" required />
                <div className="sm:col-span-2 lg:col-span-3 rounded-xl border border-slate-200 p-3"><p className="text-xs font-bold text-slate-700 mb-2">Kelas yang diampu (pilih satu atau lebih)</p><div className="flex flex-wrap gap-3">{classesList.map(klass => <label key={klass.id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={newTeacher.assignedClasses.includes(klass.name)} onChange={e => setNewTeacher(prev => ({...prev, assignedClasses: e.target.checked ? [...prev.assignedClasses, klass.name] : prev.assignedClasses.filter(x => x !== klass.name)}))} />{klass.name}</label>)}</div></div>
                <button type="submit" className="py-2.5 bg-blue-800 text-white font-bold text-xs rounded-xl shadow-sm hover:bg-blue-900 transition">+ Simpan Guru</button>
              </form>}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[500px]">
                <thead className="bg-slate-100 text-slate-600 font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th className="p-3">Nama Guru</th>
                    <th className="p-3">Mata Pelajaran</th>
                    <th className="p-3">Username</th>
                    <th className="p-3">Kelas Pengampuan</th>{currentUser.role === 'ADMIN' && <th className="p-3">Tindakan</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.filter(u => u.role === 'TEACHER').map(t => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-800">{t.name}</td>
                      <td className="p-3 font-bold text-blue-800">{t.subject}</td>
                      <td className="p-3 font-mono text-purple-700">{t.username}</td>
                      <td className="p-3 font-bold text-emerald-600">{(t.assignedClasses || []).join(', ') || 'Belum ditentukan'}</td>
                      {currentUser.role === 'ADMIN' && <td className="p-3"><button onClick={() => handleEditTeacher(t)} className="px-2 py-1 rounded bg-blue-50 text-blue-800 font-bold">Edit</button></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

                {/* ADMIN - ROMBEL KELAS */}
        {(currentUser.role === 'ADMIN' || currentUser.role === 'LEADER') && activeTab === 'admin_classes' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Tambah Rombel Kelas Baru</h2>
              {currentUser.role === 'ADMIN' && <form onSubmit={handleAddClass} className="grid grid-cols-1 sm:grid-cols-4 gap-3"><input type="text" placeholder="Nama Kelas (VII C)" value={newClass.name} onChange={e => setNewClass({...newClass, name: e.target.value})} className="p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs" required /><select value={newClass.grade} onChange={e => setNewClass({...newClass, grade: e.target.value})} className="p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold"><option value="VII">Tingkat VII</option><option value="VIII">Tingkat VIII</option><option value="IX">Tingkat IX</option></select><input type="text" placeholder="Nama Wali Kelas" value={newClass.homeroomTeacher} onChange={e => setNewClass({...newClass, homeroomTeacher: e.target.value})} className="p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs" /><button type="submit" className="py-2.5 bg-blue-800 text-white font-bold text-xs rounded-xl shadow-sm hover:bg-blue-900 transition">+ Simpan Rombel</button></form>}
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-slate-100 text-slate-600"><tr><th className="p-3">Kelas</th><th className="p-3">Tingkat</th><th className="p-3">Jumlah Siswa</th><th className="p-3">Wali Kelas</th>{currentUser.role === 'ADMIN' && <th className="p-3">Tindakan</th>}</tr></thead><tbody className="divide-y divide-slate-100">
              {classesList.map(c => <tr key={c.id}><td className="p-3 font-bold">{c.name}</td><td className="p-3">{c.grade}</td><td className="p-3">{students.filter(st => st.class === c.name).length}</td><td className="p-3">{c.homeroomTeacher || 'Belum ditentukan'}</td>{currentUser.role === 'ADMIN' && <td className="p-3"><div className="flex gap-2"><button onClick={() => handleEditClass(c)} className="px-2 py-1 rounded bg-blue-50 text-blue-800 font-bold">Edit</button><button onClick={() => handleDeactivateClass(c)} className="px-2 py-1 rounded bg-rose-50 text-rose-800 font-bold">Nonaktifkan</button></div></td>}</tr>)}
            </tbody></table></div>
          </div>
        )}

                {/* ADMIN - DATA SISWA */}
        {(currentUser.role === 'ADMIN' || currentUser.role === 'LEADER') && activeTab === 'admin_students' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Tambah Data Siswa Baru</h2>
              {currentUser.role === 'ADMIN' && <form onSubmit={handleAddStudent} className="grid grid-cols-1 sm:grid-cols-5 gap-3"><input type="text" placeholder="Nama Siswa" value={newStudent.name} onChange={e => setNewStudent({...newStudent, name: e.target.value})} className="p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs" required /><input type="text" placeholder="NISN" value={newStudent.nisn} onChange={e => setNewStudent({...newStudent, nisn: e.target.value})} className="p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs" required /><select value={newStudent.class} onChange={e => setNewStudent({...newStudent, class: e.target.value})} className="p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold" required>{classesList.map(c => <option key={c.id} value={c.name}>Kelas {c.name}</option>)}</select><select value={newStudent.gender} onChange={e => setNewStudent({...newStudent, gender:e.target.value})} className="p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs"><option value="L">Laki-laki</option><option value="P">Perempuan</option></select><button type="submit" className="py-2.5 bg-blue-800 text-white font-bold text-xs rounded-xl shadow-sm hover:bg-blue-900 transition">+ Simpan Siswa</button></form>}
            </div>
            {currentUser.role === 'ADMIN' && <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-2"><FileSpreadsheet className="w-5 h-5 text-emerald-700"/> Impor Siswa dari Excel</h2><p className="text-xs text-slate-500 mt-1">Tambahkan banyak siswa sekaligus melalui file Excel. Data diperiksa terlebih dahulu sebelum disimpan.</p></div>
                <button type="button" onClick={downloadStudentTemplate} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold"><Download className="w-4 h-4"/> Unduh Template Excel</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
                <div><label className="block text-xs font-bold text-slate-700 mb-1">Pilih file Excel (.xlsx / .xls)</label><input type="file" accept=".xlsx,.xls" onChange={handleStudentExcelSelected} className="block w-full text-xs file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-700 file:font-bold border border-slate-300 rounded-xl p-2"/></div>
                {studentImportRows.length > 0 && <button type="button" disabled={studentImportBusy || !studentImportRows.some(row=>!row.error)} onClick={handleImportStudents} className="px-5 py-2.5 rounded-xl bg-blue-800 hover:bg-blue-900 disabled:opacity-50 text-white text-xs font-bold">{studentImportBusy ? 'Mengimpor...' : 'Impor '+studentImportRows.filter(row=>!row.error).length+' Siswa Valid'}</button>}
              </div>
              <p className="text-[11px] text-slate-500">Kolom wajib: Nama Siswa, NISN, Kelas, Jenis Kelamin (L/P). Pastikan nama kelas sudah terdaftar. NISN yang sudah ada dan baris tidak valid akan dilewati.</p>
              {studentImportRows.length > 0 && <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs"><span className="font-bold text-slate-800">{studentImportFileName}</span><span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-800">{studentImportRows.filter(row=>!row.error).length} valid</span><span className="px-2 py-1 rounded-full bg-rose-50 text-rose-800">{studentImportRows.filter(row=>row.error).length} perlu diperbaiki</span></div>
                <div className="max-h-80 overflow-auto border border-slate-200 rounded-xl"><table className="w-full min-w-[700px] text-left text-xs"><thead className="sticky top-0 bg-slate-100 text-slate-600"><tr><th className="p-2">Baris</th><th className="p-2">Nama Siswa</th><th className="p-2">NISN</th><th className="p-2">Kelas</th><th className="p-2">Jenis Kelamin</th><th className="p-2">Status Validasi</th></tr></thead><tbody className="divide-y divide-slate-100">{studentImportRows.map((row,i)=><tr key={row.rowNumber+'-'+i} className={row.error?'bg-rose-50/70':''}><td className="p-2">{row.rowNumber}</td><td className="p-2 font-semibold">{row.name||'-'}</td><td className="p-2 font-mono">{row.nisn||'-'}</td><td className="p-2">{row.class||'-'}</td><td className="p-2">{row.gender||'-'}</td><td className={'p-2 '+(row.error?'text-rose-700':'text-emerald-700')}>{row.error||'Siap diimpor'}</td></tr>)}</tbody></table></div>
              </div>}
            </div>}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-3"><label className="text-xs font-bold text-slate-700">Filter kelas<select value={adminStudentClassFilter} onChange={e=>{setAdminStudentClassFilter(e.target.value);setAdminStudentPage(1);}} className="mt-1 w-full p-2.5 border border-slate-300 rounded-xl bg-white"><option value="ALL">Semua kelas</option>{classesList.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select></label><label className="text-xs font-bold text-slate-700 sm:col-span-2">Cari nama atau NISN siswa<input value={adminStudentSearch} onChange={e=>{setAdminStudentSearch(e.target.value);setAdminStudentPage(1);}} placeholder="Ketik nama atau NISN..." className="mt-1 w-full p-2.5 border border-slate-300 rounded-xl text-xs"/></label></div>
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 text-xs"><span className="font-bold text-slate-600">Tampilkan</span><select value={adminStudentPageSize} onChange={e=>{setAdminStudentPageSize(Number(e.target.value));setAdminStudentPage(1);}} className="p-2 border border-slate-300 rounded-lg font-bold">{[10,15,20,25,50].map(n=><option key={n} value={n}>{n} siswa</option>)}</select><span className="text-slate-500">per halaman · Total {filteredAdminStudents.length} siswa sesuai filter</span></div>
              <div className="text-xs text-slate-500">Halaman {Math.min(adminStudentPage,adminStudentPageCount)} dari {adminStudentPageCount}</div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto"><table className="w-full text-left text-xs min-w-[600px]"><thead className="bg-slate-100 text-slate-600"><tr><th className="p-3">No.</th><th className="p-3">Nama Siswa</th><th className="p-3">NISN</th><th className="p-3">Kelas</th><th className="p-3">Jenis Kelamin</th>{currentUser.role==='ADMIN'&&<th className="p-3">Tindakan</th>}</tr></thead><tbody className="divide-y divide-slate-100">
              {paginatedAdminStudents.map((student,index) => <tr key={student.id}><td className="p-3 text-slate-500">{(adminStudentPage-1)*adminStudentPageSize+index+1}</td><td className="p-3 font-bold">{student.name}</td><td className="p-3 font-mono">{student.nisn}</td><td className="p-3">{student.class}</td><td className="p-3">{student.gender === 'P' ? 'Perempuan' : 'Laki-laki'}</td>{currentUser.role==='ADMIN'&&<td className="p-3"><div className="flex gap-2"><button onClick={() => handleEditStudent(student)} className="px-2 py-1 rounded bg-blue-50 text-blue-800 font-bold">Edit</button><button onClick={() => handleDeactivateStudent(student)} className="px-2 py-1 rounded bg-rose-50 text-rose-800 font-bold">Nonaktifkan</button></div></td>}</tr>)}
              {!paginatedAdminStudents.length&&<tr><td colSpan={currentUser.role==='ADMIN'?6:5} className="p-6 text-center text-slate-500">Belum ada data siswa.</td></tr>}
            </tbody></table></div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-500">Menampilkan {filteredAdminStudents.length?((adminStudentPage-1)*adminStudentPageSize+1):0}–{Math.min(adminStudentPage*adminStudentPageSize,filteredAdminStudents.length)} dari {filteredAdminStudents.length} siswa</p>
              <div className="flex flex-wrap gap-1 items-center">
                <button disabled={adminStudentPage<=1} onClick={()=>setAdminStudentPage(p=>Math.max(1,p-1))} className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold disabled:opacity-40">Sebelumnya</button>
                {Array.from({length:adminStudentPageCount},(_,i)=>i+1).filter(p=>p===1||p===adminStudentPageCount||Math.abs(p-adminStudentPage)<=1).map((p,i,arr)=><React.Fragment key={p}>{i>0&&p-arr[i-1]>1&&<span className="px-1 text-slate-400">…</span>}<button onClick={()=>setAdminStudentPage(p)} className={'min-w-9 px-3 py-2 rounded-lg border text-xs font-bold '+(p===adminStudentPage?'bg-blue-800 text-white border-blue-800':'border-slate-300 text-slate-700')}>{p}</button></React.Fragment>)}
                <button disabled={adminStudentPage>=adminStudentPageCount} onClick={()=>setAdminStudentPage(p=>Math.min(adminStudentPageCount,p+1))} className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold disabled:opacity-40">Berikutnya</button>
              </div>
            </div>
          </div>
        )}

                {/* ADMIN - AI CONFIGURATION */}
        {currentUser.role === 'ADMIN' && activeTab === 'admin_api' && (
          <div className="space-y-6 max-w-2xl">
            <div><h1 className="text-2xl font-black text-slate-900 flex items-center gap-2"><Key className="w-6 h-6 text-amber-500" /> Konfigurasi AI Server</h1>
              <p className="text-xs text-slate-500 mt-1">Kunci API tidak dimasukkan melalui browser demi menjaga keamanan.</p></div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <p className="text-sm text-slate-700">Pengelola teknis perlu mengatur <code>GEMINI_API_KEY</code> pada file <code>.env</code> di server backend, lalu memulai ulang layanan API.</p>
              <p className="text-xs text-slate-500">Jangan tempelkan kunci API di chat, GitHub, atau kolom browser. Jika belum dikonfigurasi, fitur AI akan memberi tahu bahwa layanan belum tersedia.</p>
            </div>
          </div>
        )}

        {/* TEACHING SCHEDULE & NOTIFICATIONS */}
        {currentUser.role === 'ADMIN' && activeTab === 'announcements' && (
          <div className="space-y-6 max-w-5xl">
            <div><h1 className="text-2xl font-black text-slate-900 flex items-center gap-2"><BellRing className="w-6 h-6 text-blue-800" /> Pengumuman Sekolah</h1><p className="text-xs text-slate-500 mt-1">Terbitkan informasi resmi untuk ditampilkan di dashboard Guru.</p></div>
            <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"><h2 className="font-bold text-slate-900">Buat pengumuman baru</h2><form onSubmit={handleSaveAnnouncement} className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="text-xs font-bold text-slate-700 md:col-span-2">Judul pengumuman<input required maxLength={120} value={announcementForm.title} onChange={e => setAnnouncementForm(p => ({ ...p, title: e.target.value }))} placeholder="Contoh: Rapat koordinasi guru" className="mt-1 w-full p-3 border border-slate-300 rounded-xl text-sm font-normal" /></label>
              <label className="text-xs font-bold text-slate-700 md:col-span-2">Isi pengumuman<textarea required maxLength={2000} rows={4} value={announcementForm.message} onChange={e => setAnnouncementForm(p => ({ ...p, message: e.target.value }))} placeholder="Tuliskan informasi yang perlu diketahui guru..." className="mt-1 w-full p-3 border border-slate-300 rounded-xl text-sm font-normal resize-y" /></label>
              <label className="text-xs font-bold text-slate-700">Kategori<select value={announcementForm.type} onChange={e => setAnnouncementForm(p => ({ ...p, type: e.target.value }))} className="mt-1 w-full p-3 border border-slate-300 rounded-xl bg-white text-sm font-normal"><option value="info">Informasi</option><option value="important">Penting</option><option value="event">Agenda kegiatan</option></select></label>
              <label className="text-xs font-bold text-slate-700">Tampilkan sampai (opsional)<input type="date" value={announcementForm.expiresAt} onChange={e => setAnnouncementForm(p => ({ ...p, expiresAt: e.target.value }))} className="mt-1 w-full p-3 border border-slate-300 rounded-xl text-sm font-normal" /></label>
              <label className="md:col-span-2 flex items-center gap-2 text-xs font-semibold text-slate-700"><input type="checkbox" checked={announcementForm.pinned} onChange={e => setAnnouncementForm(p => ({ ...p, pinned: e.target.checked }))} /> Tandai sebagai pengumuman penting</label>
              {announcementNotice && <p className="md:col-span-2 text-xs font-semibold text-blue-800">{announcementNotice}</p>}
              <div className="md:col-span-2"><button disabled={announcementSaving} className="px-5 py-3 rounded-xl bg-blue-800 hover:bg-blue-900 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2"><Plus className="w-4 h-4" />{announcementSaving ? 'Menerbitkan…' : 'Terbitkan pengumuman'}</button></div>
            </form></section>
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"><div className="p-5 border-b border-slate-100"><h2 className="font-bold text-slate-900">Pengumuman aktif</h2><p className="text-xs text-slate-500 mt-1">{announcements.length} pengumuman sedang ditampilkan</p></div>{announcements.length === 0 ? <p className="p-6 text-sm text-slate-500">Belum ada pengumuman yang diterbitkan.</p> : <div className="divide-y divide-slate-100">{announcements.map(item => <div key={item.id} className="p-5 flex flex-col sm:flex-row sm:items-start gap-3"><div className="flex-1"><p className="font-bold text-sm text-slate-900">{item.title}</p><p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">{item.message}</p><p className="text-[10px] text-slate-400 mt-2">{item.createdAt ? new Date(item.createdAt).toLocaleString('id-ID') : ''}{item.expiresAt ? ' · Berakhir ' + new Date(item.expiresAt).toLocaleDateString('id-ID') : ''}</p></div><button onClick={() => handleDeleteAnnouncement(item)} className="self-start px-3 py-2 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-bold">Nonaktifkan</button></div>)}</div>}</section>
          </div>
        )}

        {activeTab === 'schedule' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div><h1 className="text-2xl font-black text-slate-900 flex items-center gap-2"><Calendar className="w-6 h-6 text-blue-800" /> Jadwal Mengajar</h1><p className="text-xs text-slate-500 mt-1">Jadwal tersimpan di server dan pengingat otomatis 5 menit sebelum pelajaran dimulai.</p></div>
              <button onClick={() => { setScheduleLoading(true); fetch(`${API_BASE_URL}/schedules`, { credentials: 'include' }).then(async r => { const d = await r.json(); if (!r.ok || !d.success) throw new Error(d.message || 'Gagal memuat jadwal'); setSchedules(d.schedules || []); }).catch(e => alert(e.message)).finally(() => setScheduleLoading(false)); }} className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-bold flex items-center justify-center gap-2"><RefreshCw className="w-4 h-4" /> Segarkan</button>
            </div>

            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
              <div className="flex items-start gap-3"><div className="p-2.5 bg-blue-50 text-blue-800 rounded-xl"><BellRing className="w-5 h-5" /></div><div className="flex-1"><h2 className="font-bold text-slate-900">Pengingat sebelum mengajar</h2><p className="text-xs text-slate-500 mt-1">Aktifkan sekali pada setiap perangkat/browser. Pengingat web memerlukan izin notifikasi dan konfigurasi FCM/VAPID.</p></div></div>
              <button onClick={handleEnableNotifications} disabled={notificationStatus === 'working'} className="px-4 py-2.5 bg-blue-800 hover:bg-blue-900 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-2"><Bell className="w-4 h-4" />{notificationStatus === 'working' ? 'Mengaktifkan…' : notificationStatus === 'enabled' ? 'Aktifkan ulang perangkat' : 'Aktifkan Notifikasi'}</button>
              {notificationMessage && <p className={`text-xs rounded-xl p-3 ${notificationStatus === 'error' ? 'bg-rose-50 text-rose-700' : notificationStatus === 'enabled' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-800'}`}>{notificationMessage}</p>}
              <p className="text-[11px] text-slate-500">Catatan: pengingat tidak akan terkirim sebelum FCM, VAPID, dan cron server dikonfigurasi. Browser harus mengizinkan notifikasi. Integrasi notifikasi native APK masih tahap berikutnya.</p>
            </section>

            {currentUser.role === 'ADMIN' && <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
              <div><h2 className="font-bold text-slate-900">Tambah jadwal</h2><p className="text-xs text-slate-500 mt-1">Hanya admin yang dapat mengatur jadwal guru.</p></div>
              <form onSubmit={handleCreateSchedule} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <label className="text-xs font-bold text-slate-700">Guru<select required value={scheduleForm.teacherId} onChange={e => setScheduleForm(p => ({ ...p, teacherId: e.target.value }))} className="mt-1 w-full p-2.5 border border-slate-300 rounded-xl bg-white text-xs"><option value="">Pilih guru</option>{users.filter(u => u.role === 'TEACHER' && u.active !== false).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
                <label className="text-xs font-bold text-slate-700">Kelas<select required value={scheduleForm.classId} onChange={e => setScheduleForm(p => ({ ...p, classId: e.target.value }))} className="mt-1 w-full p-2.5 border border-slate-300 rounded-xl bg-white text-xs"><option value="">Pilih kelas</option>{classesList.filter(c => c.active !== false).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
                <label className="text-xs font-bold text-slate-700">Mata pelajaran<select required value={scheduleForm.subject} onChange={e => setScheduleForm(p => ({ ...p, subject: e.target.value }))} className="mt-1 w-full p-2.5 border border-slate-300 rounded-xl bg-white text-xs">{SUBJECT_OPTIONS.map(subject => <option key={subject} value={subject}>{subject}</option>)}</select></label>
                <label className="text-xs font-bold text-slate-700">Hari<select required value={scheduleForm.dayOfWeek} onChange={e => setScheduleForm(p => ({ ...p, dayOfWeek: e.target.value }))} className="mt-1 w-full p-2.5 border border-slate-300 rounded-xl bg-white text-xs">{[['1','Senin'],['2','Selasa'],['3','Rabu'],['4','Kamis'],['5','Jumat'],['6','Sabtu'],['7','Minggu']].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label className="text-xs font-bold text-slate-700">Mulai<input required type="time" value={scheduleForm.startTime} onChange={e => setScheduleForm(p => ({ ...p, startTime: e.target.value }))} className="mt-1 w-full p-2.5 border border-slate-300 rounded-xl text-xs" /></label>
                <label className="text-xs font-bold text-slate-700">Selesai<input required type="time" value={scheduleForm.endTime} onChange={e => setScheduleForm(p => ({ ...p, endTime: e.target.value }))} className="mt-1 w-full p-2.5 border border-slate-300 rounded-xl text-xs" /></label>
                <label className="text-xs font-bold text-slate-700">Ruang (opsional)<input value={scheduleForm.room} onChange={e => setScheduleForm(p => ({ ...p, room: e.target.value }))} placeholder="Contoh: VII A / Lab" className="mt-1 w-full p-2.5 border border-slate-300 rounded-xl text-xs" /></label>
                <div className="flex items-end"><button disabled={scheduleSaving} type="submit" className="w-full p-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2"><Plus className="w-4 h-4" />{scheduleSaving ? 'Menyimpan…' : 'Simpan Jadwal'}</button></div>
              </form>
            </section>}

            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><div><h2 className="font-bold text-slate-900">Jadwal berdasarkan hari</h2><p className="text-xs text-slate-500 mt-1">{visibleSchedules.length} jadwal sesuai filter</p></div><div className="flex items-center gap-2"><label htmlFor="schedule-day-filter" className="text-xs font-semibold text-slate-600">Pilih hari</label><select id="schedule-day-filter" value={selectedScheduleDay} onChange={e => setSelectedScheduleDay(e.target.value)} className="p-2.5 border border-slate-300 rounded-xl bg-white text-xs font-semibold">{[["1","Senin"],["2","Selasa"],["3","Rabu"],["4","Kamis"],["5","Jumat"],["6","Sabtu"],["7","Minggu"]].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select>{currentUser.role === 'LEADER' && <><label className="text-xs font-semibold text-slate-600">Kelas<select value={scheduleFilterClass} onChange={e=>setScheduleFilterClass(e.target.value)} className="p-2.5 border border-slate-300 rounded-xl bg-white text-xs font-semibold"><option value="ALL">Semua kelas</option>{classesList.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select></label><label className="text-xs font-semibold text-slate-600">Guru<select value={scheduleFilterTeacher} onChange={e=>setScheduleFilterTeacher(e.target.value)} className="p-2.5 border border-slate-300 rounded-xl bg-white text-xs font-semibold"><option value="ALL">Semua guru</option>{users.filter(u=>u.role==='TEACHER'&&u.active!==false).map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label></>}{scheduleLoading && <RefreshCw className="w-4 h-4 text-blue-700 animate-spin" />}</div></div>
              {scheduleLoading && schedules.length === 0 ? <p className="p-8 text-center text-xs text-slate-500">Memuat jadwal…</p> : visibleSchedules.length === 0 ? <p className="p-8 text-center text-xs text-slate-500">Belum ada jadwal untuk hari yang dipilih. Pilih hari lain untuk melihat jadwal.</p> : <div className="divide-y divide-slate-100">{visibleSchedules.slice().sort((a,b) => a.startTime.localeCompare(b.startTime)).map(schedule => <div key={schedule.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5"><div className="sm:w-28 shrink-0"><p className="font-black text-blue-800">{[['',''],['Senin',''],['Selasa',''],['Rabu',''],['Kamis',''],['Jumat',''],['Sabtu',''],['Minggu','']][Number(schedule.dayOfWeek)]?.[0] || 'Hari'}</p><p className="text-xs text-slate-600 font-bold mt-1">{schedule.startTime}–{schedule.endTime}</p></div><div className="flex-1"><p className="font-bold text-slate-900">{schedule.subject}</p><p className="text-xs text-slate-500 mt-1">Kelas {schedule.className} · {schedule.teacherName || currentUser.name}{schedule.room ? ` · Ruang ${schedule.room}` : ''}</p></div>{currentUser.role === 'ADMIN' && <button onClick={() => handleDeactivateSchedule(schedule)} className="self-start sm:self-auto px-3 py-2 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-bold flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" /> Nonaktifkan</button>}</div>)}</div>}
            </section>
          </div>
        )}

        {/* ADMIN - SCHOOL LETTERHEAD SETTINGS */}
        {currentUser.role === 'ADMIN' && activeTab === 'settings' && (
          <div className="space-y-6 max-w-4xl">
            <div><h1 className="text-2xl font-black text-slate-900">Pengaturan Kop Surat</h1><p className="text-xs text-slate-500 mt-1">Informasi ini digunakan pada laporan PDF KELAS+ dan laporan tindak lanjut siswa.</p></div>
            <form onSubmit={handleSaveLetterhead} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="text-xs font-bold text-slate-700">Nama sekolah / instansi<input required maxLength={160} value={letterheadForm.schoolName||''} onChange={e=>setLetterheadForm(p=>({...p,schoolName:e.target.value}))} className="mt-1 w-full p-3 border border-slate-300 rounded-xl text-sm font-normal"/></label>
                <label className="text-xs font-bold text-slate-700">Tahun pelajaran<input maxLength={30} value={letterheadForm.academicYear||''} onChange={e=>setLetterheadForm(p=>({...p,academicYear:e.target.value}))} className="mt-1 w-full p-3 border border-slate-300 rounded-xl text-sm font-normal"/></label>
                <label className="text-xs font-bold text-slate-700 md:col-span-2">Alamat sekolah<textarea rows={2} maxLength={300} value={letterheadForm.schoolAddress||''} onChange={e=>setLetterheadForm(p=>({...p,schoolAddress:e.target.value}))} placeholder="Alamat lengkap sekolah" className="mt-1 w-full p-3 border border-slate-300 rounded-xl text-sm font-normal"/></label>
                <label className="text-xs font-bold text-slate-700">Nomor telepon<input maxLength={160} value={letterheadForm.schoolPhone||''} onChange={e=>setLetterheadForm(p=>({...p,schoolPhone:e.target.value}))} className="mt-1 w-full p-3 border border-slate-300 rounded-xl text-sm font-normal"/></label>
                <label className="text-xs font-bold text-slate-700">Email sekolah<input maxLength={160} value={letterheadForm.schoolEmail||''} onChange={e=>setLetterheadForm(p=>({...p,schoolEmail:e.target.value}))} className="mt-1 w-full p-3 border border-slate-300 rounded-xl text-sm font-normal"/></label>
                <label className="text-xs font-bold text-slate-700 md:col-span-2">Subjudul kop surat<input maxLength={160} value={letterheadForm.letterheadSubtitle||''} onChange={e=>setLetterheadForm(p=>({...p,letterheadSubtitle:e.target.value}))} className="mt-1 w-full p-3 border border-slate-300 rounded-xl text-sm font-normal"/></label>
                <label className="text-xs font-bold text-slate-700">Nama kepala sekolah<input maxLength={160} value={letterheadForm.principalName||''} onChange={e=>setLetterheadForm(p=>({...p,principalName:e.target.value}))} placeholder="Nama lengkap dan gelar" className="mt-1 w-full p-3 border border-slate-300 rounded-xl text-sm font-normal"/></label>
                <label className="text-xs font-bold text-slate-700">NIP kepala sekolah<input maxLength={160} value={letterheadForm.principalNip||''} onChange={e=>setLetterheadForm(p=>({...p,principalNip:e.target.value}))} className="mt-1 w-full p-3 border border-slate-300 rounded-xl text-sm font-normal"/></label>
              </div>
              {letterheadNotice && <p className="rounded-xl bg-blue-50 text-blue-800 p-3 text-xs font-semibold">{letterheadNotice}</p>}
              <button type="submit" disabled={letterheadSaving} className="px-5 py-3 rounded-xl bg-blue-800 hover:bg-blue-900 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2"><Save className="w-4 h-4"/>{letterheadSaving?'Menyimpan pengaturan…':'Simpan Pengaturan Kop Surat'}</button>
            </form>
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-900">Perubahan berlaku pada laporan PDF yang dibuat setelah pengaturan disimpan. Tidak diperlukan Firebase Storage.</div>
          </div>
        )}

        {/* PROFILE SETTINGS */}
        {currentUser.role === 'TEACHER' && activeTab === "settings" && (
          <div className="space-y-6 max-w-2xl"><div><h1 className="text-2xl font-black text-slate-900">Pengaturan Akun & Profil</h1><p className="text-xs text-slate-500 mt-1">Kelola informasi akun Anda</p></div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
              <div className="flex items-center gap-4"><div className="w-20 h-20 rounded-full border border-slate-200 bg-slate-100 flex items-center justify-center text-slate-500" aria-label="Avatar pengguna"><svg viewBox="0 0 24 24" className="w-12 h-12" fill="currentColor" aria-hidden="true"><path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2c-4.1 0-7.5 2.2-7.5 5v2h15v-2c0-2.8-3.4-5-7.5-5Z"/></svg></div><div><p className="font-bold text-slate-800">Avatar Profil</p><p className="text-xs text-slate-500 my-2">Avatar siluet pengguna sebagai foto profil default.</p></div></div>
              <div><label className="block text-xs font-bold text-slate-700 mb-1">Nama Lengkap</label><input type="text" value={profileForm.name || currentUser.name || ""} disabled className="w-full p-2.5 bg-slate-100 text-slate-600 border border-slate-300 rounded-xl text-xs font-bold" /></div>
              <div><label className="block text-xs font-bold text-slate-700 mb-1">Username</label><input type="text" value={currentUser.username || ""} disabled className="w-full p-2.5 bg-slate-100 text-slate-600 border border-slate-300 rounded-xl text-xs font-bold" /></div>
              <div><label className="block text-xs font-bold text-slate-700 mb-1">Mata Pelajaran</label><input type="text" value={currentUser.subject || "-"} disabled className="w-full p-2.5 bg-slate-100 text-slate-600 border border-slate-300 rounded-xl text-xs font-bold" /></div>
              <div><label className="block text-xs font-bold text-slate-700 mb-1">Status Peran</label><input type="text" value={currentUser.role} disabled className="w-full p-2.5 bg-slate-100 text-slate-600 border border-slate-300 rounded-xl text-xs font-bold" /></div>
            </div></div>
        )}

        <footer className="mt-10 pt-5 pb-2 border-t border-slate-200 text-right text-[10px] leading-relaxed text-slate-400"><span className="font-semibold text-slate-500">KELAS+</span> · Dikembangkan oleh <span className="font-semibold text-slate-600">Guntur Angga Saputra, S.Pd.</span><br />Untuk mengikuti Lomba Inovasi Daerah 2026 · Kabupaten Tanah Laut<br /><span>© 2026 KELAS+ · Versi {APP_VERSION}. Hak cipta dilindungi.</span></footer>
      </main>
    </div>
  );
}
