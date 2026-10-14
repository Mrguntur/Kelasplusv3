import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'node:crypto';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { registerScheduleRoutes } from './schedule-routes.js';

dotenv.config();
const app = express();
const PORT = Number(process.env.PORT || 5000);
const ENV = process.env.NODE_ENV || 'development';
const ORIGINS = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173').split(',').map(v => v.trim());
const COOKIE = 'kelasplus_session';
const TTL = 30 * 60 * 1000;

let adminApp = getApps()[0];
if (!adminApp) {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON belum diatur. Backend Firestore tidak dapat dijalankan.');
  const serviceAccount = JSON.parse(raw);
  adminApp = initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id || process.env.VITE_FIREBASE_PROJECT_ID });
}
const authAdmin = getAuth(adminApp);
const db = getFirestore(adminApp);
const col = name => db.collection(name);
const nowIso = () => new Date().toISOString();
const schoolClock = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Makassar', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const dayMap = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return { dayOfWeek: dayMap[values.weekday], time: `${values.hour}:${values.minute}` };
};
const id = () => crypto.randomUUID();
const fail = (res, code, message) => res.status(code).json({ success: false, message });
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
const cookieOptions = () => ({ httpOnly: true, secure: ENV === 'production', sameSite: 'lax', maxAge: TTL, path: '/' });
const clean = value => String(value ?? '').trim();
const list = async name => (await col(name).get()).docs.map(doc => ({ id: doc.id, ...doc.data() }));
const listBy = async (name, field, value) => (await col(name).where(field, '==', value).get()).docs.map(doc => ({ id: doc.id, ...doc.data() }));
const listByMany = async (name, field, values) => (await Promise.all([...new Set(values)].map(value => listBy(name, field, value)))).flat();
const getDoc = async (name, docId) => { const snap = await col(name).doc(String(docId)).get(); return snap.exists ? { id: snap.id, ...snap.data() } : null; };
const setDoc = (name, docId, data, merge = false) => col(name).doc(String(docId)).set(data, { merge });
const delDoc = (name, docId) => col(name).doc(String(docId)).delete();

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.scryptSync(password, salt, 64).toString('hex');
}
function verifyPassword(password, stored) {
  const parts = String(stored || '').split(':');
  if (parts.length !== 2) return false;
  const actual = crypto.scryptSync(password, parts[0], 64);
  const expected = Buffer.from(parts[1], 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
function publicUser(user) {
  return { id: user.id, username: user.username, name: user.name, nip: user.nip || '', role: user.role,
    subject: user.subject || '', assignedClasses: Array.isArray(user.assignedClasses) ? user.assignedClasses : [],
    avatar: user.avatar || '', active: Boolean(user.active) };
}
async function audit(user, action, entityType, entityId = null, details = {}) {
  await col('auditLogs').doc(id()).set({ actorUserId: user?.id || null, action, entityType, entityId,
    details, createdAt: nowIso() });
}
function allow(...roles) {
  return (req, res, next) => roles.includes(req.user.role) ? next() : fail(res, 403, 'Anda tidak memiliki izin untuk tindakan ini.');
}
async function auth(req, res, next) {
  try {
    const bearer = (req.headers.authorization || '').startsWith('Bearer ') ? req.headers.authorization.slice(7) : '';
    const part = (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith(COOKIE + '='));
    const token = part ? decodeURIComponent(part.slice(COOKIE.length + 1)) : bearer;
    if (!token) return fail(res, 401, 'Silakan login terlebih dahulu.');
    const digest = crypto.createHash('sha256').update(token).digest('hex');
    const session = await getDoc('sessions', digest);
    if (!session || session.revokedAt || session.expiresAt <= Date.now()) return fail(res, 401, 'Sesi berakhir. Silakan login kembali.');
    const user = await getDoc('users', session.userId);
    if (!user || !user.active) return fail(res, 401, 'Akun tidak aktif. Silakan hubungi administrator.');
    const renewedExpiry = Date.now() + TTL;
    await setDoc('sessions', digest, { expiresAt: renewedExpiry, lastActivityAt: nowIso() }, true);
    res.cookie(COOKIE, token, cookieOptions());
    req.user = publicUser(user);
    req.sessionId = digest;
    next();
  } catch (error) { next(error); }
}
async function createFirebaseCustomToken(user) {
  await setDoc('users', user.id, { name: user.name, username: user.username, role: user.role,
    subject: user.subject || '', assignedClasses: user.assignedClasses || [], avatar: user.avatar || '',
    active: Boolean(user.active), updatedAt: nowIso() }, true);
  return authAdmin.createCustomToken(user.id, { kelasplusRole: user.role });
}
async function init() {
  const users = await list('users');
  const credentials = await list('userCredentials');
  // Existing Firebase profile-only documents do not contain login credentials.
  // Keep password hashes in a server-only collection, never in readable user profiles.
  if (!credentials.some(credential => credential.role === 'ADMIN')) {
    const username = clean(process.env.INITIAL_ADMIN_USERNAME);
    const password = process.env.INITIAL_ADMIN_PASSWORD || '';
    if (!username || password.length < 12) {
      throw new Error('Belum ada akun Admin login di Firestore. Atur INITIAL_ADMIN_USERNAME dan INITIAL_ADMIN_PASSWORD (minimal 12 karakter) di .env.');
    }
    const existing = users.find(user => clean(user.username).toLowerCase() === username.toLowerCase());
    const adminId = existing?.id || id();
    await setDoc('users', adminId, { username, usernameLower: username.toLowerCase(),
      name: existing?.name || 'Administrator Sekolah', nip: existing?.nip || '', role: 'ADMIN', subject: 'Administrator',
      assignedClasses: ['ALL'], avatar: existing?.avatar || '', active: true,
      createdAt: existing?.createdAt || nowIso(), updatedAt: nowIso() }, true);
    await setDoc('userCredentials', adminId, { passwordHash: hashPassword(password), usernameLower: username.toLowerCase(), role: 'ADMIN', updatedAt: nowIso() }, true);
    console.log('Akun Admin login disiapkan di Firestore dari environment.');
  }
  const classes = await list('classes');
  if (!classes.length) {
    for (const [name, grade] of [['VII A','VII'],['VII B','VII'],['VIII A','VIII'],['VIII B','VIII'],['IX A','IX'],['IX B','IX']]) {
      await col('classes').doc(id()).set({ name, grade, homeroomTeacher: '', active: true, createdAt: nowIso() });
    }
    console.log('Kelas awal dibuat di Firestore.');
  }
  const teachers = (await list('users')).filter(u => u.role === 'TEACHER' && u.active);
  for (const teacher of teachers) {
    const tasks = (await list('assignmentTasks')).filter(t => t.teacherId === teacher.id && t.subject === (teacher.subject || 'Umum'));
    if (!tasks.length) for (let assignmentNo = 1; assignmentNo <= 4; assignmentNo++) {
      await col('assignmentTasks').doc(id()).set({ teacherId: teacher.id, subject: teacher.subject || 'Umum',
        assignmentNo, title: 'Tugas ' + assignmentNo, createdAt: nowIso() });
    }
  }
}
await init();

app.disable('x-powered-by');
app.use(cors({ origin: ORIGINS, credentials: true }));
app.use(express.json({ limit: '1mb' }));
const loginAttempts = new Map();
function loginRateLimit(req, res, next) {
  const key = req.ip || req.socket.remoteAddress || 'unknown', now = Date.now();
  const record = loginAttempts.get(key) || { count: 0, resetAt: now + 15 * 60 * 1000 };
  if (now > record.resetAt) { record.count = 0; record.resetAt = now + 15 * 60 * 1000; }
  record.count++; loginAttempts.set(key, record);
  if (record.count > 120) return fail(res, 429, 'Terlalu banyak percobaan login dari jaringan ini. Coba lagi setelah 15 menit.');
  next();
}
app.get('/api/health', (_req, res) => res.json({ success: true, status: 'ok', database: 'firestore', timestamp: nowIso() }));
app.post('/api/login', loginRateLimit, async (req, res, next) => {
  try {
    const username = clean(req.body?.username), password = String(req.body?.password || '');
    if (!username || !password) return fail(res, 400, 'Username dan password wajib diisi.');
    const user = (await list('users')).find(u => (u.usernameLower || clean(u.username).toLowerCase()) === username.toLowerCase() && u.active);
    const credential = user ? await getDoc('userCredentials', user.id) : null;
    if (!user || !credential || !verifyPassword(password, credential.passwordHash)) {
      await new Promise(resolve => setTimeout(resolve, 250));
      return fail(res, 401, 'Username atau password tidak valid.');
    }
    const firebaseCustomToken = await createFirebaseCustomToken(user);
    const token = crypto.randomBytes(32).toString('base64url');
    const digest = crypto.createHash('sha256').update(token).digest('hex');
    await setDoc('sessions', digest, { userId: user.id, expiresAt: Date.now() + TTL, revokedAt: null, createdAt: nowIso() });
    res.cookie(COOKIE, token, cookieOptions());
    await audit(publicUser(user), 'LOGIN', 'session');
    res.json({ success: true, user: publicUser(user), firebaseCustomToken });
  } catch (error) { next(error); }
});
app.get('/api/auth/me', auth, (req, res) => res.json({ success: true, user: req.user }));
app.post('/api/auth/activity', auth, (req, res) => res.json({ success: true, expiresIn: TTL }));
app.post('/api/auth/logout', auth, async (req, res, next) => {
  try {
    await setDoc('sessions', req.sessionId, { revokedAt: Date.now() }, true);
    res.clearCookie(COOKIE, { httpOnly: true, secure: ENV === 'production', sameSite: 'lax', path: '/' });
    res.json({ success: true });
  } catch (error) { next(error); }
});

app.get('/api/bootstrap', auth, async (req, res, next) => {
  try {
    // Resolve visible classes first so teacher requests only read records for assigned classes.
    const classRows = await list('classes');
    const activeClasses = classRows.filter(c => c.active !== false).sort((a,b) => a.name.localeCompare(b.name));
    const assigned = req.user.assignedClasses || [];
    const visibleClasses = activeClasses.filter(c => req.user.role !== 'TEACHER' || assigned.includes('ALL') || assigned.includes(c.name));
    const visibleIds = new Set(visibleClasses.map(c => c.id));
    const teacherOnly = req.user.role === 'TEACHER';
    const visibleClassIds = [...visibleIds];

    const [studentRows, attendanceRows, journalRows, userRows, scoreRows, taskRows, settingsRows] = await Promise.all([
      teacherOnly && visibleClassIds.length ? listByMany('students', 'classId', visibleClassIds) : list('students'),
      teacherOnly && visibleClassIds.length ? listByMany('attendanceRecords', 'classId', visibleClassIds) : list('attendanceRecords'),
      teacherOnly ? listBy('journals', 'teacherId', req.user.id) : list('journals'),
      teacherOnly ? Promise.resolve([req.user]) : list('users'),
      teacherOnly ? listBy('teacherAssignmentScores', 'teacherId', req.user.id) : list('teacherAssignmentScores'),
      teacherOnly ? listBy('assignmentTasks', 'teacherId', req.user.id) : list('assignmentTasks'),
      list('appSettings')
    ]);

    const students = studentRows.filter(s => s.active !== false && visibleIds.has(s.classId))
      .sort((a,b) => a.name.localeCompare(b.name)).map(s => {
        const cls = classRows.find(c => c.id === s.classId);
        return { id:s.id, nisn:s.nisn, name:s.name, class:cls?.name || '', gender:s.gender || 'L',
          status:'ACTIVE', attendanceRate:null, assignmentScore:null, statusFlag:'GOOD' };
      });
    const journals = journalRows.filter(j => req.user.role !== 'TEACHER' || j.teacherId === req.user.id)
      .sort((a,b) => String(b.date).localeCompare(String(a.date))).slice(0,1000).map(j => {
        const teacher = userRows.find(u => u.id === j.teacherId), cls = classRows.find(c => c.id === j.classId);
        return { id:j.id, teacherUsername:teacher?.username || '', teacherName:teacher?.name || '',
          class:cls?.name || '', date:j.date, month:String(j.date || '').slice(5,7),
          topic:j.topic, method:j.method, pulse:j.pulse, text:j.text };
      });
    const attendanceRecords = attendanceRows.filter(a => visibleIds.has(a.classId)).map(a => ({
      class:classRows.find(c => c.id === a.classId)?.name || '', date:a.date, student_id:a.studentId, status:a.status
    }));
    const users = userRows.filter(u => req.user.role === 'ADMIN' || req.user.role === 'LEADER' || u.id === req.user.id).map(publicUser);
    const assignmentScores = scoreRows.filter(g => visibleIds.has(g.classId) && (req.user.role !== 'TEACHER' || g.teacherId === req.user.id))
      .map(g => ({ id:g.id, studentId:g.studentId, studentName:studentRows.find(s => s.id === g.studentId)?.name || '',
        nisn:studentRows.find(s => s.id === g.studentId)?.nisn || '', class:classRows.find(c => c.id === g.classId)?.name || '',
        subject:g.subject, assignmentNo:g.assignmentNo, score:g.score, teacherId:g.teacherId }));
    const assignmentTasks = taskRows.filter(t => req.user.role !== 'TEACHER' || t.teacherId === req.user.id)
      .map(t => ({ id:t.id, teacherId:t.teacherId, teacherName:userRows.find(u => u.id === t.teacherId)?.name || '',
        subject:t.subject, assignmentNo:t.assignmentNo, title:t.title }));
    const settings = Object.fromEntries(settingsRows.filter(s => !String(s.key).toLowerCase().includes('key')).map(s => [s.key,s.value]));
    res.json({ success:true, users, classes:visibleClasses.map(c => ({ id:c.id, name:c.name, grade:c.grade,
      totalStudents:students.filter(s => s.class === c.name).length, homeroomTeacher:c.homeroomTeacher || '' })),
      students, journals, attendanceRecords, assignmentScores, assignmentTasks,
      settings: { schoolName:'UPTD SMPN 2 BAJUIN', academicYear:'2026/2027', ...settings } });
  } catch (error) { next(error); }
});
app.get('/api/users', auth, allow('ADMIN','LEADER'), async (req,res,next) => {
  try { res.json({ success:true, users:(await list('users')).sort((a,b)=>a.name.localeCompare(b.name)).map(publicUser) }); }
  catch(error) { next(error); }
});
app.post('/api/teachers', auth, allow('ADMIN'), async (req,res,next) => {
  try {
    const b=req.body||{}, name=clean(b.name), username=clean(b.username), password=String(b.password||'');
    if(!name||!username||password.length<12) return fail(res,400,'Nama, username, dan password minimal 12 karakter wajib diisi.');
    if((await list('users')).some(u=>clean(u.username).toLowerCase()===username.toLowerCase())) return fail(res,409,'Username sudah digunakan.');
    const userId=id(), subject=clean(b.subject)||'Umum';
    const user={ username, usernameLower:username.toLowerCase(), name, nip:clean(b.nip),
      role:'TEACHER', subject, assignedClasses:Array.isArray(b.assignedClasses)?b.assignedClasses:[], avatar:'', active:true,
      createdAt:nowIso(), updatedAt:nowIso() };
    await setDoc('users',userId,user);
    await setDoc('userCredentials',userId,{passwordHash:hashPassword(password),usernameLower:username.toLowerCase(),role:'TEACHER',updatedAt:nowIso()});
    for(let assignmentNo=1;assignmentNo<=4;assignmentNo++) await col('assignmentTasks').doc(id()).set({ teacherId:userId, subject, assignmentNo, title:'Tugas '+assignmentNo, createdAt:nowIso() });
    await audit(req.user,'CREATE','user',userId);
    res.status(201).json({success:true,user:publicUser({id:userId,...user})});
  } catch(error) { next(error); }
});
app.post('/api/classes', auth, allow('ADMIN'), async (req,res,next) => {
  try {
    const b=req.body||{}, name=clean(b.name), grade=clean(b.grade), homeroomTeacher=clean(b.homeroomTeacher);
    if(!name||!['VII','VIII','IX'].includes(grade)) return fail(res,400,'Nama kelas dan tingkat tidak valid.');
    const rows=await list('classes'), existing=rows.find(c=>c.name.toLowerCase()===name.toLowerCase());
    if(existing?.active) return fail(res,409,'Nama kelas sudah digunakan.');
    if(existing) { await setDoc('classes',existing.id,{grade,homeroomTeacher,active:true,updatedAt:nowIso()},true); await audit(req.user,'RESTORE','class',existing.id); return res.json({success:true,restored:true,class:{id:existing.id,name,grade,homeroomTeacher}}); }
    const classId=id(); await setDoc('classes',classId,{name,grade,homeroomTeacher,active:true,createdAt:nowIso()});
    await audit(req.user,'CREATE','class',classId); res.status(201).json({success:true,class:{id:classId,name,grade,homeroomTeacher}});
  } catch(error) { next(error); }
});
app.post('/api/students', auth, allow('ADMIN'), async (req,res,next) => {
  try {
    const b=req.body||{}, name=clean(b.name), nisn=clean(b.nisn), className=clean(b.class), gender=b.gender||'L';
    if(!name||!nisn||!className||!['L','P'].includes(gender)) return fail(res,400,'Nama, NISN, kelas, dan jenis kelamin wajib valid.');
    const classes=await list('classes'), cls=classes.find(c=>c.name===className&&c.active!==false);
    if(!cls) return fail(res,400,'Kelas tidak ditemukan.');
    const students=await list('students'), existing=students.find(s=>s.nisn===nisn);
    if(existing?.active!==false && existing) return fail(res,409,'NISN sudah terdaftar.');
    if(existing) { await setDoc('students',existing.id,{name,classId:cls.id,gender,active:true,updatedAt:nowIso()},true); await audit(req.user,'RESTORE','student',existing.id,{className}); return res.json({success:true,restored:true,student:{id:existing.id,nisn,name,class:className,gender,status:'ACTIVE'}}); }
    const studentId=id(); await setDoc('students',studentId,{nisn,name,classId:cls.id,gender,active:true,createdAt:nowIso()});
    await audit(req.user,'CREATE','student',studentId); res.status(201).json({success:true,student:{id:studentId,nisn,name,class:className,gender,status:'ACTIVE'}});
  } catch(error) { next(error); }
});
app.post('/api/attendance', auth, allow('ADMIN','TEACHER'), async (req,res,next) => {
  try {
    const b=req.body||{}, className=clean(b.className), date=b.date, records=b.records;
    if(!className||!validDate(date)||!records||typeof records!=='object'||Array.isArray(records)) return fail(res,400,'Data presensi tidak valid.');
    if(req.user.role==='TEACHER'&&!req.user.assignedClasses.includes('ALL')&&!req.user.assignedClasses.includes(className)) return fail(res,403,'Anda tidak ditugaskan pada kelas ini.');
    if (req.user.role === 'TEACHER') {
      const clock = schoolClock();
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      if (date !== today) return fail(res, 403, 'Absensi hanya dapat diubah pada tanggal hari ini dan selama jam mengajar.');
      const schedules = await listBy('teachingSchedules', 'teacherId', req.user.id);
      const inTeachingWindow = schedules.some(item => item.active !== false && item.teacherId === req.user.id && item.className === className && Number(item.dayOfWeek) === clock.dayOfWeek && clock.time >= item.startTime && clock.time < item.endTime);
      if (!inTeachingWindow) return fail(res, 403, 'Anda tidak berada dalam jam mengajar untuk kelas ini. Absensi hanya dapat diubah selama jadwal mengajar berlangsung.');
    }
    const classes=await list('classes'), cls=classes.find(c=>c.name===className&&c.active!==false);
    if(!cls) return fail(res,404,'Kelas tidak ditemukan.');
    const students=await list('students'), batch=db.batch();
    for(const [studentId,status] of Object.entries(records)) {
      if(!['PRESENT','ABSENT','SICK','PERMISSION','LATE'].includes(status)) return fail(res,400,'Status presensi tidak valid.');
      const student=students.find(s=>s.id===studentId&&s.classId===cls.id&&s.active!==false);
      if(!student) return fail(res,400,'Siswa tidak sesuai dengan kelas.');
      const recordId=crypto.createHash('sha256').update(studentId+'|'+date).digest('hex');
      batch.set(col('attendanceRecords').doc(recordId),{studentId,classId:cls.id,date,status,recordedBy:req.user.id,updatedAt:nowIso()},{merge:true});
    }
    await batch.commit(); await audit(req.user,'UPSERT','attendance',null,{className,date,count:Object.keys(records).length});
    res.json({success:true,message:'Presensi tersimpan.'});
  } catch(error) { next(error); }
});
app.post('/api/grades', auth, allow('ADMIN','TEACHER'), async (req,res,next) => {
  try {
    const b=req.body||{}, studentId=clean(b.studentId), subject=(req.user.role==='TEACHER'?req.user.subject:clean(b.subject)||req.user.subject||'Umum').trim();
    const assignmentNo=Number(b.assignmentNo), score=b.score===null||b.score===''?null:Number(b.score);
    if(!studentId||!subject||!Number.isInteger(assignmentNo)||assignmentNo<1||!(score===null||(Number.isFinite(score)&&score>=0&&score<=100))) return fail(res,400,'Data nilai tidak valid. Tugas harus valid dan nilai 0–100.');
    const [students,classes,tasks,scores]=await Promise.all([list('students'),list('classes'),list('assignmentTasks'),list('teacherAssignmentScores')]);
    const student=students.find(s=>s.id===studentId&&s.active!==false), cls=student&&classes.find(c=>c.id===student.classId&&c.active!==false);
    if(!student||!cls) return fail(res,404,'Siswa aktif tidak ditemukan.');
    if(req.user.role==='TEACHER'&&!req.user.assignedClasses.includes('ALL')&&!req.user.assignedClasses.includes(cls.name)) return fail(res,403,'Anda tidak ditugaskan pada kelas ini.');
    if(req.user.role==='TEACHER'&&!tasks.some(t=>t.teacherId===req.user.id&&t.subject===subject&&Number(t.assignmentNo)===assignmentNo)) return fail(res,404,'Tugas tidak ditemukan atau bukan milik akun Anda.');
    const existing=scores.find(g=>g.studentId===studentId&&g.teacherId===req.user.id&&g.subject===subject&&Number(g.assignmentNo)===assignmentNo);
    const scoreId=existing?.id||id(), data={studentId,classId:cls.id,subject,assignmentNo,score,teacherId:req.user.id,recordedBy:req.user.id,updatedAt:nowIso()};
    await setDoc('teacherAssignmentScores',scoreId,data,true); await audit(req.user,'UPSERT','assignment_score',scoreId,{studentId,subject,assignmentNo,score});
    res.json({success:true,score:{id:scoreId,studentId,subject,assignmentNo,score,teacherId:req.user.id}});
  } catch(error) { next(error); }
});
app.post('/api/tasks', auth, allow('TEACHER'), async (req,res,next) => {
  try {
    const title=clean(req.body?.title), subject=clean(req.user.subject)||'Umum';
    if(!title||title.length>100) return fail(res,400,'Nama tugas wajib diisi dan maksimal 100 karakter.');
    const latest=(await list('assignmentTasks')).filter(t=>t.teacherId===req.user.id&&t.subject===subject).reduce((max,t)=>Math.max(max,Number(t.assignmentNo)||0),0);
    const assignmentNo=latest+1, taskId=id();
    await setDoc('assignmentTasks',taskId,{teacherId:req.user.id,subject,assignmentNo,title,createdAt:nowIso()});
    await audit(req.user,'CREATE','assignment_task',taskId,{subject,assignmentNo,title});
    res.status(201).json({success:true,task:{id:taskId,teacherId:req.user.id,subject,assignmentNo,title}});
  } catch(error) { next(error); }
});
app.delete('/api/tasks/:id', auth, allow('TEACHER'), async (req,res,next) => {
  try {
    const task=await getDoc('assignmentTasks',req.params.id);
    if(!task||task.teacherId!==req.user.id) return fail(res,404,'Tugas tidak ditemukan atau bukan milik akun Anda.');
    const tasks=(await list('assignmentTasks')).filter(t=>t.teacherId===req.user.id&&t.subject===task.subject);
    if(tasks.length<=1) return fail(res,400,'Minimal harus ada satu tugas aktif.');
    const batch=db.batch();
    for(const score of (await list('teacherAssignmentScores')).filter(s=>s.teacherId===req.user.id&&s.subject===task.subject&&Number(s.assignmentNo)===Number(task.assignmentNo))) batch.delete(col('teacherAssignmentScores').doc(score.id));
    batch.delete(col('assignmentTasks').doc(task.id)); await batch.commit();
    await audit(req.user,'DELETE','assignment_task',task.id,{subject:task.subject,assignmentNo:task.assignmentNo}); res.json({success:true});
  } catch(error) { next(error); }
});
app.post('/api/journals', auth, allow('ADMIN','TEACHER'), async (req,res,next) => {
  try {
    const b=req.body||{}, className=clean(b.class), date=b.date, topic=clean(b.topic);
    if(!className||!validDate(date)||!topic) return fail(res,400,'Kelas, tanggal, dan topik wajib diisi.');
    if(req.user.role==='TEACHER'&&!req.user.assignedClasses.includes('ALL')&&!req.user.assignedClasses.includes(className)) return fail(res,403,'Anda tidak ditugaskan pada kelas ini.');
    const cls=(await list('classes')).find(c=>c.name===className&&c.active!==false);
    if(!cls) return fail(res,404,'Kelas tidak ditemukan.');
    const journalId=id(); await setDoc('journals',journalId,{teacherId:req.user.id,classId:cls.id,date,topic,method:clean(b.method),pulse:clean(b.pulse),text:clean(b.text),createdAt:nowIso()});
    await audit(req.user,'CREATE','journal',journalId); res.status(201).json({success:true,journal:{id:journalId}});
  } catch(error) { next(error); }
});
app.post('/api/ai/teaching-recommendations', auth, async (req,res,next) => {
  try {
    const b=req.body||{}; if(!clean(b.topic)) return fail(res,400,'Topik wajib diisi.');
    if(!process.env.GEMINI_API_KEY) return fail(res,503,'AI belum dikonfigurasi pada server.');
    const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+(process.env.GEMINI_MODEL||'gemini-3.8-flash')+':generateContent?key='+encodeURIComponent(process.env.GEMINI_API_KEY),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:'Anda konsultan pedagogi SMP Indonesia. Buat 3 rekomendasi mengajar praktis. Kembalikan JSON array murni dengan id,title,type,duration,objective,steps (array string). Mata pelajaran: '+clean(b.subject).slice(0,100)+'. Topik: '+clean(b.topic).slice(0,300)+'. Kondisi: '+clean(b.condition).slice(0,200)+'.'}]}]})});
    const data=await response.json();
    if(!response.ok) return fail(res,response.status===429?503:502,'Layanan Gemini gagal (HTTP '+response.status+'). Periksa konfigurasi GEMINI_API_KEY dan GEMINI_MODEL.');
    const raw=data.candidates?.[0]?.content?.parts?.[0]?.text||'', match=raw.match(/\[[\s\S]*\]/);
    if(!match) return fail(res,502,'Format rekomendasi AI tidak dikenali.');
    try { res.json({success:true,recommendations:JSON.parse(match[0])}); } catch { return fail(res,502,'Respons AI tidak dapat dibaca.'); }
  } catch(error) { next(error); }
});
app.patch('/api/profile', auth, async (req,res,next) => {
  try {
    const avatar = clean(req.body?.avatar);
    if (!avatar || avatar.length > 2048 || !/^https:\/\//i.test(avatar)) {
      return fail(res, 400, 'URL foto profil tidak valid.');
    }
    const parsed = new URL(avatar);
    const allowedHosts = ['firebasestorage.googleapis.com', 'storage.googleapis.com'];
    if (!allowedHosts.includes(parsed.hostname)) return fail(res, 400, 'Foto profil harus berasal dari Firebase Storage.');
    await setDoc('users', req.user.id, { avatar, updatedAt: nowIso() }, true);
    await audit(req.user, 'UPDATE_PROFILE_PHOTO', 'user', req.user.id);
    res.json({ success: true, avatar });
  } catch(error) { next(error); }
});

app.patch('/api/users/:id', auth, allow('ADMIN'), async (req,res,next) => {
  try {
    const old=await getDoc('users',req.params.id); if(!old) return fail(res,404,'Pengguna tidak ditemukan.');
    const b=req.body||{}, role=b.role||old.role;
    if(!['ADMIN','LEADER','TEACHER'].includes(role)) return fail(res,400,'Peran tidak valid.');
    const updated={name:b.name===undefined?old.name:clean(b.name),nip:b.nip===undefined?old.nip:clean(b.nip),
      subject:b.subject===undefined?old.subject:clean(b.subject),role,
      assignedClasses:b.assignedClasses===undefined?(old.assignedClasses||[]):(Array.isArray(b.assignedClasses)?b.assignedClasses:[]),
      active:b.active===undefined?old.active:Boolean(b.active),updatedAt:nowIso()};
    await setDoc('users',old.id,updated,true); await audit(req.user,'UPDATE','user',old.id); res.json({success:true});
  } catch(error) { next(error); }
});
app.post('/api/users/:id/reset-password', auth, allow('ADMIN'), async (req,res,next) => {
  try {
    const password=String(req.body?.password||''); if(password.length<12) return fail(res,400,'Password minimal 12 karakter.');
    const user=await getDoc('users',req.params.id); if(!user) return fail(res,404,'Pengguna tidak ditemukan.');
    await setDoc('userCredentials',user.id,{passwordHash:hashPassword(password),usernameLower:clean(user.username).toLowerCase(),role:user.role,updatedAt:nowIso()},true);
    const sessions=await list('sessions'), batch=db.batch();
    for(const session of sessions.filter(s=>s.userId===user.id&&!s.revokedAt)) batch.set(col('sessions').doc(session.id),{revokedAt:Date.now()},{merge:true});
    await batch.commit(); await audit(req.user,'RESET_PASSWORD','user',user.id); res.json({success:true});
  } catch(error) { next(error); }
});
app.delete('/api/users/:id', auth, allow('ADMIN'), async (req,res,next) => {
  try {
    if(req.params.id===req.user.id) return fail(res,400,'Akun yang sedang digunakan tidak dapat dinonaktifkan.');
    const user=await getDoc('users',req.params.id); if(!user) return fail(res,404,'Pengguna tidak ditemukan.');
    await setDoc('users',user.id,{active:false,updatedAt:nowIso()},true);
    const sessions=await list('sessions'), batch=db.batch();
    for(const session of sessions.filter(s=>s.userId===user.id&&!s.revokedAt)) batch.set(col('sessions').doc(session.id),{revokedAt:Date.now()},{merge:true});
    await batch.commit(); await audit(req.user,'DEACTIVATE','user',user.id); res.json({success:true});
  } catch(error) { next(error); }
});
app.patch('/api/classes/:id', auth, allow('ADMIN'), async (req,res,next) => {
  try {
    const old=await getDoc('classes',req.params.id); if(!old) return fail(res,404,'Kelas tidak ditemukan.');
    const b=req.body||{}, name=clean(b.name===undefined?old.name:b.name), grade=b.grade||old.grade;
    if(!name||!['VII','VIII','IX'].includes(grade)) return fail(res,400,'Data kelas tidak valid.');
    const duplicate=(await list('classes')).find(c=>c.id!==old.id&&c.active!==false&&c.name.toLowerCase()===name.toLowerCase());
    if(duplicate) return fail(res,409,'Nama kelas sudah digunakan.');
    const batch=db.batch(); batch.set(col('classes').doc(old.id),{name,grade,homeroomTeacher:clean(b.homeroomTeacher===undefined?old.homeroomTeacher:b.homeroomTeacher),updatedAt:nowIso()},{merge:true});
    if(name!==old.name) for(const teacher of (await list('users')).filter(u=>u.role==='TEACHER')) {
      const assigned=teacher.assignedClasses||[];
      if(assigned.includes(old.name)) batch.set(col('users').doc(teacher.id),{assignedClasses:assigned.map(v=>v===old.name?name:v),updatedAt:nowIso()},{merge:true});
    }
    await batch.commit(); await audit(req.user,'UPDATE','class',old.id,{previousName:old.name,name}); res.json({success:true});
  } catch(error) { next(error); }
});
app.delete('/api/classes/:id', auth, allow('ADMIN'), async (req,res,next) => {
  try {
    const cls=await getDoc('classes',req.params.id); if(!cls) return fail(res,404,'Kelas tidak ditemukan.');
    if((await list('students')).some(s=>s.classId===cls.id&&s.active!==false)) return fail(res,409,'Kelas masih memiliki siswa aktif.');
    await setDoc('classes',cls.id,{active:false,updatedAt:nowIso()},true); await audit(req.user,'DEACTIVATE','class',cls.id); res.json({success:true});
  } catch(error) { next(error); }
});
app.patch('/api/students/:id', auth, allow('ADMIN'), async (req,res,next) => {
  try {
    const old=await getDoc('students',req.params.id); if(!old) return fail(res,404,'Siswa tidak ditemukan.');
    const b=req.body||{}, nisn=clean(b.nisn===undefined?old.nisn:b.nisn);
    const duplicate=(await list('students')).find(s=>s.id!==old.id&&s.nisn===nisn&&s.active!==false);
    if(duplicate) return fail(res,409,'NISN sudah digunakan.');
    let classId=old.classId;
    if(b.class) { const cls=(await list('classes')).find(c=>c.name===b.class&&c.active!==false); if(!cls) return fail(res,400,'Kelas tidak ditemukan.'); classId=cls.id; }
    const gender=b.gender||old.gender; if(!['L','P'].includes(gender)) return fail(res,400,'Jenis kelamin tidak valid.');
    await setDoc('students',old.id,{name:clean(b.name===undefined?old.name:b.name),nisn,gender,classId,active:b.active===undefined?old.active!==false:Boolean(b.active),updatedAt:nowIso()},true);
    await audit(req.user,'UPDATE','student',old.id); res.json({success:true});
  } catch(error) { next(error); }
});
app.delete('/api/students/:id', auth, allow('ADMIN'), async (req,res,next) => {
  try {
    const student=await getDoc('students',req.params.id); if(!student) return fail(res,404,'Siswa tidak ditemukan.');
    await setDoc('students',student.id,{active:false,updatedAt:nowIso()},true); await audit(req.user,'DEACTIVATE','student',student.id); res.json({success:true});
  } catch(error) { next(error); }
});
app.post('/api/settings/gemini-key', auth, allow('ADMIN'), (_req,res) => fail(res,410,'Kunci AI tidak disimpan dari browser. Atur GEMINI_API_KEY pada environment server.'));

app.patch('/api/settings/letterhead', auth, allow('ADMIN'), async (req, res, next) => {
  try {
    const allowed = ['schoolName','schoolAddress','schoolPhone','schoolEmail','academicYear','principalName','principalNip','letterheadSubtitle'];
    const values = {};
    for (const key of allowed) {
      if (req.body?.[key] !== undefined) values[key] = clean(req.body[key]).slice(0, key === 'schoolAddress' ? 300 : 160);
    }
    if (values.schoolName !== undefined && !values.schoolName) return fail(res, 400, 'Nama sekolah wajib diisi.');
    const batch = db.batch();
    for (const [key, value] of Object.entries(values)) {
      batch.set(col('appSettings').doc(key), { key, value, updatedAt: nowIso(), updatedBy: req.user.id }, { merge: true });
    }
    await batch.commit();
    await audit(req.user, 'UPDATE', 'appSettings', 'letterhead', { keys: Object.keys(values) });
    res.json({ success: true, settings: values });
  } catch (error) { next(error); }
});

app.get('/api/student-follow-ups', auth, allow('ADMIN','LEADER'), async (req, res, next) => {
  try {
    const [rows, studentRows, classRows, userRows] = await Promise.all([list('studentFollowUps'), list('students'), list('classes'), list('users')]);
    const visible = rows.map(row => {
      const student = studentRows.find(item => item.id === row.studentId);
      const klass = classRows.find(item => item.id === student?.classId);
      const author = userRows.find(item => item.id === row.createdBy);
      return { ...row, studentName: student?.name || 'Siswa tidak ditemukan', studentClass: klass?.name || '-', createdByName: author?.name || '-' };
    }).sort((a,b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    res.json({ success: true, followUps: visible });
  } catch (error) { next(error); }
});
app.post('/api/student-follow-ups', auth, allow('LEADER'), async (req, res, next) => {
  try {
    const b = req.body || {};
    const studentId = clean(b.studentId), date = clean(b.date), category = clean(b.category), action = clean(b.action);
    const result = clean(b.result), nextStep = clean(b.nextStep), notes = clean(b.notes);
    if (!studentId || !validDate(date) || !category || !action || !result) return fail(res, 400, 'Siswa, tanggal, kategori, tindakan, dan hasil tindak lanjut wajib diisi.');
    if (category.length > 120 || action.length > 3000 || result.length > 3000 || nextStep.length > 2000 || notes.length > 2000) return fail(res, 400, 'Isi laporan melebihi batas panjang yang diizinkan.');
    const student = await getDoc('students', studentId);
    if (!student || student.active === false) return fail(res, 404, 'Siswa aktif tidak ditemukan.');
    const followUpId = id();
    const record = { id: followUpId, studentId, date, category, action, result, nextStep, notes, status: ['MONITORING','SELESAI'].includes(b.status) ? b.status : 'MONITORING', createdBy: req.user.id, createdAt: nowIso(), updatedAt: nowIso() };
    await setDoc('studentFollowUps', followUpId, record);
    await audit(req.user, 'CREATE', 'studentFollowUp', followUpId, { studentId, category });
    const [classRows, user] = await Promise.all([list('classes'), getDoc('users', req.user.id)]);
    const klass = classRows.find(item => item.id === student.classId);
    res.status(201).json({ success: true, followUp: { ...record, studentName: student.name, studentClass: klass?.name || '-', createdByName: user?.name || '-' } });
  } catch (error) { next(error); }
});


app.get('/api/announcements', auth, async (req, res, next) => {
  try {
    const now = Date.now();
    const announcements = (await list('announcements'))
      .filter(item => item.active !== false && (!item.expiresAt || Date.parse(item.expiresAt) > now))
      .sort((a, b) => (b.pinned === true) - (a.pinned === true) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    res.json({ success: true, announcements });
  } catch (err) { next(err); }
});
app.post('/api/announcements', auth, allow('ADMIN'), async (req, res, next) => {
  try {
    const title = clean(req.body.title).slice(0, 120);
    const message = clean(req.body.message).slice(0, 2000);
    const type = ['info', 'important', 'event'].includes(req.body.type) ? req.body.type : 'info';
    const expiresAt = clean(req.body.expiresAt);
    if (!title || !message) return fail(res, 400, 'Judul dan isi pengumuman wajib diisi.');
    if (expiresAt && Number.isNaN(Date.parse(expiresAt))) return fail(res, 400, 'Tanggal kedaluwarsa tidak valid.');
    const announcementId = id();
    const announcement = { id: announcementId, title, message, type, active: true, pinned: Boolean(req.body.pinned), createdAt: nowIso(), createdBy: req.user.id, createdByName: req.user.name, expiresAt: expiresAt || null };
    await setDoc('announcements', announcementId, announcement);
    await audit(req.user, 'CREATE', 'announcement', announcementId, { title, type });
    res.status(201).json({ success: true, announcement });
  } catch (err) { next(err); }
});
app.delete('/api/announcements/:id', auth, allow('ADMIN'), async (req, res, next) => {
  try {
    const item = await getDoc('announcements', req.params.id);
    if (!item) return fail(res, 404, 'Pengumuman tidak ditemukan.');
    await setDoc('announcements', item.id, { active: false, updatedAt: nowIso(), updatedBy: req.user.id }, true);
    await audit(req.user, 'DEACTIVATE', 'announcement', item.id, { title: item.title });
    res.json({ success: true });
  } catch (err) { next(err); }
});

registerScheduleRoutes({ app, auth, allow, col, list, getDoc, setDoc, audit, id, adminApp });

app.use((err,_req,res,_next) => { console.error('API error:',err); res.status(500).json({success:false,message:'Terjadi kesalahan server. Silakan coba kembali.'}); });
app.use((_req,res) => fail(res,404,'Endpoint tidak ditemukan.'));
app.listen(PORT, () => console.log('KELAS+ Firestore backend aktif pada port '+PORT));
