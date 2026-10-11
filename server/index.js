import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();
const app = express();
const PORT = Number(process.env.PORT || 5000);
const ENV = process.env.NODE_ENV || 'development';
const ORIGINS = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173').split(',').map(x => x.trim());
const COOKIE = 'kelasplus_session';
const TTL = 8 * 60 * 60 * 1000;
const DB_PATH = process.env.DB_PATH || path.join(path.dirname(fileURLToPath(import.meta.url)), 'kelasplus.sqlite');
app.disable('x-powered-by');
app.use(cors({ origin: ORIGINS, credentials: true }));
app.use(express.json({ limit: '1mb' }));

const db = await open({ filename: DB_PATH, driver: sqlite3.Database });
await db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
await db.exec("CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,username TEXT NOT NULL UNIQUE COLLATE NOCASE,password_hash TEXT NOT NULL,name TEXT NOT NULL,nip TEXT DEFAULT '',role TEXT NOT NULL CHECK(role IN ('ADMIN','LEADER','TEACHER')),subject TEXT DEFAULT '',assigned_classes TEXT NOT NULL DEFAULT '[]',avatar TEXT DEFAULT '',active INTEGER NOT NULL DEFAULT 1,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);");
await db.exec("CREATE TABLE IF NOT EXISTS classes(id TEXT PRIMARY KEY,name TEXT NOT NULL UNIQUE,grade TEXT NOT NULL,homeroom_teacher TEXT DEFAULT '',active INTEGER NOT NULL DEFAULT 1,created_at TEXT DEFAULT CURRENT_TIMESTAMP);");
await db.exec("CREATE TABLE IF NOT EXISTS students(id TEXT PRIMARY KEY,nisn TEXT NOT NULL UNIQUE,name TEXT NOT NULL,class_id TEXT NOT NULL REFERENCES classes(id),gender TEXT NOT NULL DEFAULT 'L' CHECK(gender IN ('L','P')),active INTEGER NOT NULL DEFAULT 1,created_at TEXT DEFAULT CURRENT_TIMESTAMP);");
await db.exec("CREATE TABLE IF NOT EXISTS attendance_records(id TEXT PRIMARY KEY,student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,date TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('PRESENT','ABSENT','SICK','PERMISSION','LATE')),recorded_by TEXT NOT NULL REFERENCES users(id),updated_at TEXT DEFAULT CURRENT_TIMESTAMP,UNIQUE(student_id,date));");
await db.exec("CREATE TABLE IF NOT EXISTS journals(id TEXT PRIMARY KEY,teacher_id TEXT NOT NULL REFERENCES users(id),class_id TEXT NOT NULL REFERENCES classes(id),date TEXT NOT NULL,topic TEXT NOT NULL,method TEXT DEFAULT '',pulse TEXT DEFAULT '',text TEXT DEFAULT '',created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);");
await db.exec("CREATE TABLE IF NOT EXISTS assignment_scores(id TEXT PRIMARY KEY,student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,subject TEXT NOT NULL,assignment_no INTEGER NOT NULL CHECK(assignment_no >= 1),score REAL CHECK(score BETWEEN 0 AND 100),recorded_by TEXT NOT NULL REFERENCES users(id),updated_at TEXT DEFAULT CURRENT_TIMESTAMP,UNIQUE(student_id,subject,assignment_no));");
await db.exec("CREATE TABLE IF NOT EXISTS teacher_assignment_scores(id TEXT PRIMARY KEY,student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,subject TEXT NOT NULL,assignment_no INTEGER NOT NULL CHECK(assignment_no >= 1),score REAL CHECK(score BETWEEN 0 AND 100),teacher_id TEXT NOT NULL REFERENCES users(id),recorded_by TEXT NOT NULL REFERENCES users(id),updated_at TEXT DEFAULT CURRENT_TIMESTAMP,UNIQUE(student_id,teacher_id,subject,assignment_no));");
await db.exec("CREATE TABLE IF NOT EXISTS assignment_tasks(id TEXT PRIMARY KEY,teacher_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,subject TEXT NOT NULL,assignment_no INTEGER NOT NULL CHECK(assignment_no >= 1),title TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP,UNIQUE(teacher_id,subject,assignment_no));");
await db.exec("CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,token_hash TEXT NOT NULL UNIQUE,expires_at INTEGER NOT NULL,revoked_at INTEGER,created_at TEXT DEFAULT CURRENT_TIMESTAMP);");
await db.exec("CREATE TABLE IF NOT EXISTS app_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_by TEXT REFERENCES users(id),updated_at TEXT DEFAULT CURRENT_TIMESTAMP);");
await db.exec("CREATE TABLE IF NOT EXISTS audit_logs(id TEXT PRIMARY KEY,actor_user_id TEXT REFERENCES users(id),action TEXT NOT NULL,entity_type TEXT NOT NULL,entity_id TEXT,details_json TEXT DEFAULT '{}',created_at TEXT DEFAULT CURRENT_TIMESTAMP);");
await db.exec('CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id); CREATE INDEX IF NOT EXISTS idx_attendance_date_class ON attendance_records(date,class_id); CREATE INDEX IF NOT EXISTS idx_journals_teacher_date ON journals(teacher_id,date); CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);');

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
function publicUser(u) {
 return { id:u.id, username:u.username, name:u.name, nip:u.nip || '', role:u.role, subject:u.subject || '', assignedClasses:JSON.parse(u.assigned_classes || '[]'), avatar:u.avatar || '', active: Boolean(u.active) };
}
function fail(res, code, message) { return res.status(code).json({ success:false, message }); }
function validDate(v) { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)); }
function allow() {
 const roles = Array.from(arguments);
 return (req,res,next) => roles.includes(req.user.role) ? next() : fail(res,403,'Anda tidak memiliki izin untuk tindakan ini.');
}
function cookieOptions() { return { httpOnly:true, secure:ENV === 'production', sameSite:'lax', maxAge:TTL, path:'/' }; }
async function audit(user, action, type, id, details) {
 await db.run('INSERT INTO audit_logs(id,actor_user_id,action,entity_type,entity_id,details_json) VALUES(?,?,?,?,?,?)',
 crypto.randomUUID(), user ? user.id : null, action, type, id || null, JSON.stringify(details || {}));
}
async function auth(req,res,next) {
 try {
  const token = (req.headers.authorization || '').startsWith('Bearer ') ? req.headers.authorization.slice(7) : '';
  const cookieHeader = req.headers.cookie || '';
  const cookiePart = cookieHeader.split(';').map(x => x.trim()).find(x => x.startsWith(COOKIE + '='));
  const raw = cookiePart ? decodeURIComponent(cookiePart.slice(COOKIE.length + 1)) : token;
  if (!raw) return fail(res,401,'Silakan login terlebih dahulu.');
  const digest = crypto.createHash('sha256').update(raw).digest('hex');
  const row = await db.get('SELECT s.id AS sid,s.expires_at,u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND u.active=1',digest,Date.now());
  if (!row) return fail(res,401,'Sesi berakhir. Silakan login kembali.');
  req.user = publicUser(row); req.sessionId = row.sid; next();
 } catch(e) { next(e); }
}
async function init() {
 const users = await db.get('SELECT COUNT(*) n FROM users');
 if (!users.n) {
  const username = process.env.INITIAL_ADMIN_USERNAME || '';
  const password = process.env.INITIAL_ADMIN_PASSWORD || '';
  if (username && password.length >= 12) {
   await db.run('INSERT INTO users(id,username,password_hash,name,role,subject,assigned_classes) VALUES(?,?,?,?,?,?,?)',
    crypto.randomUUID(),username.trim(),hashPassword(password),'Administrator Sekolah','ADMIN','Administrator','["ALL"]');
   console.log('Initial administrator created from environment settings.');
  } else console.warn('No user exists. Configure INITIAL_ADMIN_USERNAME and INITIAL_ADMIN_PASSWORD (12+ characters) in .env.');
 }
 const classes = await db.get('SELECT COUNT(*) n FROM classes');
 if (!classes.n) for (const pair of [['VII A','VII'],['VII B','VII'],['VIII A','VIII'],['VIII B','VIII'],['IX A','IX'],['IX B','IX']])
  await db.run('INSERT INTO classes(id,name,grade) VALUES(?,?,?)',crypto.randomUUID(),pair[0],pair[1]);
}
await init();
await db.run('INSERT OR IGNORE INTO teacher_assignment_scores(id,student_id,subject,assignment_no,score,teacher_id,recorded_by,updated_at) SELECT id,student_id,subject,assignment_no,score,recorded_by,recorded_by,updated_at FROM assignment_scores');
const initialTeachers = await db.all("SELECT id,subject FROM users WHERE role='TEACHER' AND active=1");
for (const teacher of initialTeachers) {
 const count = await db.get('SELECT COUNT(*) n FROM assignment_tasks WHERE teacher_id=? AND subject=?',teacher.id,teacher.subject || 'Umum');
 if (!count.n) for (let assignmentNo=1; assignmentNo<=4; assignmentNo+=1) await db.run('INSERT OR IGNORE INTO assignment_tasks(id,teacher_id,subject,assignment_no,title) VALUES(?,?,?,?,?)',crypto.randomUUID(),teacher.id,teacher.subject || 'Umum',assignmentNo,'Tugas '+assignmentNo);
}

const loginAttempts = new Map();
function loginRateLimit(req,res,next) {
 const key = req.ip || req.socket.remoteAddress || 'unknown';
 const now = Date.now();
 const previous = loginAttempts.get(key) || { count:0, resetAt:now + 15 * 60 * 1000 };
 if (now > previous.resetAt) { previous.count = 0; previous.resetAt = now + 15 * 60 * 1000; }
 previous.count += 1; loginAttempts.set(key,previous);
 if (previous.count > 120) return fail(res,429,'Terlalu banyak percobaan login dari jaringan ini. Coba lagi setelah 15 menit.');
 if (loginAttempts.size > 5000) for (const [k,v] of loginAttempts) if (now > v.resetAt) loginAttempts.delete(k);
 next();
}
app.get('/api/health',(_req,res)=>res.json({success:true,status:'ok',database:'connected',timestamp:new Date().toISOString()}));
app.post('/api/login',loginRateLimit,async(req,res,next)=>{
 try {
  const username=String(req.body && req.body.username || '').trim(), password=String(req.body && req.body.password || '');
  if(!username||!password)return fail(res,400,'Username dan password wajib diisi.');
  const row=await db.get('SELECT * FROM users WHERE username=? COLLATE NOCASE AND active=1',username);
  if(!row||!verifyPassword(password,row.password_hash)){await new Promise(r=>setTimeout(r,250));return fail(res,401,'Username atau password tidak valid.');}
  const token=crypto.randomBytes(32).toString('base64url');
  await db.run('INSERT INTO sessions(id,user_id,token_hash,expires_at) VALUES(?,?,?,?)',crypto.randomUUID(),row.id,crypto.createHash('sha256').update(token).digest('hex'),Date.now()+TTL);
  res.cookie(COOKIE,token,cookieOptions()); await audit(publicUser(row),'LOGIN','session',null);
  res.json({success:true,user:publicUser(row)});
 } catch(e){next(e);}
});
app.get('/api/auth/me',auth,(req,res)=>res.json({success:true,user:req.user}));
app.post('/api/auth/logout',auth,async(req,res,next)=>{
 try { await db.run('UPDATE sessions SET revoked_at=? WHERE id=?',Date.now(),req.sessionId);res.clearCookie(COOKIE,{httpOnly:true,secure:ENV==='production',sameSite:'lax',path:'/'});res.json({success:true}); } catch(e){next(e);}
});
app.get('/api/bootstrap',auth,async(req,res,next)=>{
 try {
  const allClasses=await db.all('SELECT * FROM classes WHERE active=1 ORDER BY name');
  const allStudents=await db.all('SELECT s.*,c.name class_name FROM students s JOIN classes c ON c.id=s.class_id WHERE s.active=1 ORDER BY s.name');
  const allAttendance=await db.all('SELECT a.*,c.name class_name FROM attendance_records a JOIN classes c ON c.id=a.class_id ORDER BY a.date DESC');
  const allJournals=await db.all('SELECT j.*,u.username teacher_username,u.name teacher_name,c.name class_name FROM journals j JOIN users u ON u.id=j.teacher_id JOIN classes c ON c.id=j.class_id ORDER BY j.date DESC LIMIT 1000');
  const allUsers=await db.all('SELECT * FROM users ORDER BY name');
  const allGrades=await db.all('SELECT g.*,s.name student_name,s.nisn,s.class_id,c.name class_name FROM teacher_assignment_scores g JOIN students s ON s.id=g.student_id JOIN classes c ON c.id=s.class_id ORDER BY s.name,g.assignment_no');
  const allTasks=await db.all('SELECT t.*,u.name teacher_name FROM assignment_tasks t JOIN users u ON u.id=t.teacher_id ORDER BY u.name,t.subject,t.assignment_no');
  const settingsRows=await db.all("SELECT key,value FROM app_settings WHERE key NOT LIKE '%key%'");
  const assigned=req.user.assignedClasses || [];
  const visibleClasses=allClasses.filter(c=>req.user.role!=='TEACHER'||assigned.includes('ALL')||assigned.includes(c.name));
  const visibleIds=new Set(visibleClasses.map(c=>c.id));
  const students=allStudents.filter(s=>visibleIds.has(s.class_id)).map(s=>({id:s.id,nisn:s.nisn,name:s.name,class:s.class_name,gender:s.gender,status:'ACTIVE',attendanceRate:null,assignmentScore:null,statusFlag:'GOOD'}));
  const journals=allJournals.filter(j=>req.user.role!=='TEACHER'||j.teacher_id===req.user.id).map(j=>({id:j.id,teacherUsername:j.teacher_username,teacherName:j.teacher_name,class:j.class_name,date:j.date,month:j.date.slice(5,7),topic:j.topic,method:j.method,pulse:j.pulse,text:j.text}));
  const attendanceRecords=allAttendance.filter(a=>visibleIds.has(a.class_id)).map(a=>({class:a.class_name,date:a.date,student_id:a.student_id,status:a.status}));
  const users=allUsers.filter(u=>req.user.role==='ADMIN'||req.user.role==='LEADER'||u.id===req.user.id).map(publicUser);
  const assignmentScores=allGrades.filter(g=>visibleIds.has(g.class_id)&&(req.user.role!=='TEACHER'||g.teacher_id===req.user.id)).map(g=>({id:g.id,studentId:g.student_id,studentName:g.student_name,nisn:g.nisn,class:g.class_name,subject:g.subject,assignmentNo:g.assignment_no,score:g.score,teacherId:g.teacher_id}));
  const assignmentTasks=allTasks.filter(t=>req.user.role!=='TEACHER'||t.teacher_id===req.user.id).map(t=>({id:t.id,teacherId:t.teacher_id,teacherName:t.teacher_name,subject:t.subject,assignmentNo:t.assignment_no,title:t.title}));
  res.json({success:true,users,classes:visibleClasses.map(c=>({id:c.id,name:c.name,grade:c.grade,totalStudents:students.filter(s=>s.class===c.name).length,homeroomTeacher:c.homeroom_teacher})),students,journals,attendanceRecords,assignmentScores,assignmentTasks,settings:Object.assign({schoolName:'UPTD SMPN 2 BAJUIN',academicYear:'2026/2027'},Object.fromEntries(settingsRows))});
 } catch(e){next(e);}
});
app.get('/api/users',auth,allow('ADMIN','LEADER'),async(req,res,next)=>{try{const rows=await db.all('SELECT * FROM users ORDER BY name');res.json({success:true,users:rows.map(publicUser)});}catch(e){next(e);}});
app.post('/api/teachers',auth,allow('ADMIN'),async(req,res,next)=>{
 try {
  const b=req.body||{},name=String(b.name||'').trim(),username=String(b.username||'').trim(),password=String(b.password||'');
  if(!name||!username||password.length<12)return fail(res,400,'Nama, username, dan password minimal 12 karakter wajib diisi.');
  const assigned=Array.isArray(b.assignedClasses)?b.assignedClasses:[];
  const id=crypto.randomUUID();await db.run('INSERT INTO users(id,username,password_hash,name,nip,role,subject,assigned_classes) VALUES(?,?,?,?,?,?,?,?)',id,username,hashPassword(password),name,String(b.nip||''),'TEACHER',String(b.subject||''),JSON.stringify(assigned));
  const row=await db.get('SELECT * FROM users WHERE id=?',id);await audit(req.user,'CREATE','user',id);res.status(201).json({success:true,user:publicUser(row)});
 } catch(e){if(e.code==='SQLITE_CONSTRAINT' && /UNIQUE constraint failed/.test(e.message))return fail(res,409,'Username sudah digunakan.');next(e);}
});
app.post('/api/classes',auth,allow('ADMIN'),async(req,res,next)=>{
 try {
  const b=req.body||{},name=String(b.name||'').trim(),grade=String(b.grade||''),homeroomTeacher=String(b.homeroomTeacher||'');
  if(!name||!['VII','VIII','IX'].includes(grade))return fail(res,400,'Nama kelas dan tingkat tidak valid.');
  const existing=await db.get('SELECT * FROM classes WHERE name=?',name);
  if(existing&&existing.active)return fail(res,409,'Nama kelas sudah digunakan.');
  if(existing&&!existing.active){
   await db.run('UPDATE classes SET grade=?,homeroom_teacher=?,active=1 WHERE id=?',grade,homeroomTeacher,existing.id);
   await audit(req.user,'RESTORE','class',existing.id);
   return res.status(200).json({success:true,restored:true,class:{id:existing.id,name,grade,homeroomTeacher}});
  }
  const id=crypto.randomUUID();
  await db.run('INSERT INTO classes(id,name,grade,homeroom_teacher) VALUES(?,?,?,?)',id,name,grade,homeroomTeacher);
  await audit(req.user,'CREATE','class',id);
  res.status(201).json({success:true,class:{id,name,grade,homeroomTeacher}});
 }catch(e){if(e.code==='SQLITE_CONSTRAINT' && /UNIQUE constraint failed/.test(e.message))return fail(res,409,'Nama kelas sudah digunakan.');next(e);}
});
app.post('/api/students',auth,allow('ADMIN'),async(req,res,next)=>{
 try {
  const b=req.body||{},name=String(b.name||'').trim(),nisn=String(b.nisn||'').trim(),className=String(b.class||''),gender=b.gender||'L';
  if(!name||!nisn||!className||!['L','P'].includes(gender))return fail(res,400,'Nama, NISN, kelas, dan jenis kelamin wajib valid.');
  const c=await db.get('SELECT * FROM classes WHERE name=? AND active=1',className);
  if(!c)return fail(res,400,'Kelas tidak ditemukan.');
  const existing=await db.get('SELECT * FROM students WHERE nisn=?',nisn);
  if(existing&&existing.active)return fail(res,409,'NISN sudah terdaftar.');
  if(existing&&!existing.active){
   await db.run('UPDATE students SET name=?,class_id=?,gender=?,active=1 WHERE id=?',name,c.id,gender,existing.id);
   await audit(req.user,'RESTORE','student',existing.id,{className});
   return res.status(200).json({success:true,restored:true,student:{id:existing.id,nisn,name,class:className,gender,status:'ACTIVE'}});
  }
  const id=crypto.randomUUID();
  await db.run('INSERT INTO students(id,nisn,name,class_id,gender) VALUES(?,?,?,?,?)',id,nisn,name,c.id,gender);
  await audit(req.user,'CREATE','student',id);
  res.status(201).json({success:true,student:{id,nisn,name,class:className,gender,status:'ACTIVE'}});
 }catch(e){if(e.code==='SQLITE_CONSTRAINT' && /UNIQUE constraint failed/.test(e.message))return fail(res,409,'NISN sudah terdaftar.');next(e);}
});
app.post('/api/attendance',auth,async(req,res,next)=>{
 try {const b=req.body||{},className=String(b.className||''),date=b.date,records=b.records;
 if(!className||!validDate(date)||!records||typeof records!=='object'||Array.isArray(records))return fail(res,400,'Data presensi tidak valid.');
 if(req.user.role==='TEACHER'&&!req.user.assignedClasses.includes('ALL')&&!req.user.assignedClasses.includes(className))return fail(res,403,'Anda tidak ditugaskan pada kelas ini.');
 const c=await db.get('SELECT id FROM classes WHERE name=? AND active=1',className);if(!c)return fail(res,404,'Kelas tidak ditemukan.');
 await db.exec('BEGIN IMMEDIATE');try{
  for(const [studentId,status] of Object.entries(records)){
   if(!['PRESENT','ABSENT','SICK','PERMISSION','LATE'].includes(status))throw Object.assign(new Error('Status presensi tidak valid.'),{statusCode:400});
   const s=await db.get('SELECT id FROM students WHERE id=? AND class_id=? AND active=1',studentId,c.id);if(!s)throw Object.assign(new Error('Siswa tidak sesuai dengan kelas.'),{statusCode:400});
   await db.run('INSERT INTO attendance_records(id,student_id,class_id,date,status,recorded_by) VALUES(?,?,?,?,?,?) ON CONFLICT(student_id,date) DO UPDATE SET status=excluded.status,recorded_by=excluded.recorded_by,updated_at=CURRENT_TIMESTAMP',crypto.randomUUID(),studentId,c.id,date,status,req.user.id);
  }await db.exec('COMMIT');
 }catch(e){await db.exec('ROLLBACK');throw e;}
 await audit(req.user,'UPSERT','attendance',null,{className,date,count:Object.keys(records).length});res.json({success:true,message:'Presensi tersimpan.'});
 }catch(e){if(e.statusCode)return fail(res,e.statusCode,e.message);next(e);}
});
app.post('/api/grades',auth,allow('ADMIN','TEACHER'),async(req,res,next)=>{
 try {
  const b=req.body||{},studentId=String(b.studentId||''),subject=String(b.subject||req.user.subject||'').trim(),assignmentNo=Number(b.assignmentNo),score=b.score===null||b.score===''?null:Number(b.score);
  if(!studentId||!subject||![1,2,3,4].includes(assignmentNo)||!(score===null||(Number.isFinite(score)&&score>=0&&score<=100)))return fail(res,400,'Data nilai tidak valid. Pilih tugas 1–4 dan nilai 0–100.');
  const student=await db.get('SELECT s.id,s.class_id,c.name class_name FROM students s JOIN classes c ON c.id=s.class_id WHERE s.id=? AND s.active=1 AND c.active=1',studentId);
  if(!student)return fail(res,404,'Siswa aktif tidak ditemukan.');
  if(req.user.role==='TEACHER'&&!req.user.assignedClasses.includes('ALL')&&!req.user.assignedClasses.includes(student.class_name))return fail(res,403,'Anda tidak ditugaskan pada kelas siswa ini.');
  const existing=await db.get('SELECT id FROM assignment_scores WHERE student_id=? AND subject=? AND assignment_no=?',studentId,subject,assignmentNo);
  const id=existing?.id||crypto.randomUUID();
  await db.run('INSERT INTO assignment_scores(id,student_id,subject,assignment_no,score,recorded_by) VALUES(?,?,?,?,?,?) ON CONFLICT(student_id,subject,assignment_no) DO UPDATE SET score=excluded.score,recorded_by=excluded.recorded_by,updated_at=CURRENT_TIMESTAMP',id,studentId,subject,assignmentNo,score,req.user.id);
  await audit(req.user,'UPSERT','assignment_score',id,{studentId,subject,assignmentNo,score});
  res.json({success:true,score:{id,studentId,subject,assignmentNo,score}});
 }catch(e){next(e);}
});
app.post('/api/journals',auth,async(req,res,next)=>{
 try {const b=req.body||{},className=String(b.class||''),date=b.date,topic=String(b.topic||'').trim();if(!className||!validDate(date)||!topic)return fail(res,400,'Kelas, tanggal, dan topik wajib diisi.');
 if(req.user.role==='TEACHER'&&!req.user.assignedClasses.includes('ALL')&&!req.user.assignedClasses.includes(className))return fail(res,403,'Anda tidak ditugaskan pada kelas ini.');
 const c=await db.get('SELECT id FROM classes WHERE name=? AND active=1',className);if(!c)return fail(res,404,'Kelas tidak ditemukan.');
 const id=crypto.randomUUID();await db.run('INSERT INTO journals(id,teacher_id,class_id,date,topic,method,pulse,text) VALUES(?,?,?,?,?,?,?,?)',id,req.user.id,c.id,date,topic,String(b.method||''),String(b.pulse||''),String(b.text||''));await audit(req.user,'CREATE','journal',id);res.status(201).json({success:true,journal:{id}});
 }catch(e){next(e);}
});
app.post('/api/ai/teaching-recommendations',auth,async(req,res,next)=>{
 try {const b=req.body||{};if(!String(b.topic||'').trim())return fail(res,400,'Topik wajib diisi.');if(!process.env.GEMINI_API_KEY)return fail(res,503,'AI belum dikonfigurasi pada server.');
 const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+(process.env.GEMINI_MODEL||'gemini-3.8-flash')+':generateContent?key='+encodeURIComponent(process.env.GEMINI_API_KEY),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:'Anda konsultan pedagogi SMP Indonesia. Buat 3 rekomendasi mengajar praktis. Kembalikan JSON array murni dengan id,title,type,duration,objective,steps (array string). Mata pelajaran: '+String(b.subject||'').slice(0,100)+'. Topik: '+String(b.topic).slice(0,300)+'. Kondisi: '+String(b.condition||'').slice(0,200)+'.'}]}]})});
 const data=await response.json();
 if(!response.ok){
  const detail=String(data.error&&data.error.message||'').slice(0,240);
  console.error('Gemini API error:',response.status,detail);
  if(response.status===400||response.status===403) return fail(res,502,'Gemini menolak permintaan. Periksa GEMINI_API_KEY di file .env dan pastikan API aktif.'+(detail?' Detail: '+detail:''));
  if(response.status===404) return fail(res,502,'Model Gemini tidak ditemukan. Atur GEMINI_MODEL=gemini-3.8-flash pada environment Vercel/server dan pastikan model tersebut tersedia untuk API key ini.');
  if(response.status===429) return fail(res,503,'Kuota Gemini sedang habis atau terlalu banyak permintaan. Coba lagi nanti.');
  return fail(res,502,'Layanan Gemini sedang gagal (HTTP '+response.status+'). Coba lagi nanti.');
 }
 const raw=data.candidates&&data.candidates[0]&&data.candidates[0].content&&data.candidates[0].content.parts&&data.candidates[0].content.parts[0]&&data.candidates[0].content.parts[0].text||'';
 const match=raw.match(/\[[\s\S]*\]/);if(!match)return fail(res,502,'Gemini merespons tetapi format rekomendasi tidak dikenali. Coba ubah topik.');
 try {res.json({success:true,recommendations:JSON.parse(match[0])});}catch(parseError){return fail(res,502,'Respons Gemini tidak dapat dibaca. Silakan coba lagi.');}
 }catch(e){next(e);}
});
app.patch('/api/users/:id',auth,allow('ADMIN'),async(req,res,next)=>{
 try {const old=await db.get('SELECT * FROM users WHERE id=?',req.params.id);if(!old)return fail(res,404,'Pengguna tidak ditemukan.');const b=req.body||{};
 const role=b.role||old.role;if(!['ADMIN','LEADER','TEACHER'].includes(role))return fail(res,400,'Peran tidak valid.');
 await db.run('UPDATE users SET name=?,nip=?,subject=?,role=?,assigned_classes=?,active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',b.name===undefined?old.name:String(b.name).trim(),b.nip===undefined?old.nip:b.nip,b.subject===undefined?old.subject:b.subject,role,b.assignedClasses===undefined?old.assigned_classes:JSON.stringify(b.assignedClasses),b.active===undefined?old.active:(b.active?1:0),old.id);
 await audit(req.user,'UPDATE','user',old.id);res.json({success:true});
 }catch(e){next(e);}
});
app.post('/api/users/:id/reset-password',auth,allow('ADMIN'),async(req,res,next)=>{
 try {const password=String(req.body&&req.body.password||'');if(password.length<12)return fail(res,400,'Password minimal 12 karakter.');const result=await db.run('UPDATE users SET password_hash=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',hashPassword(password),req.params.id);if(!result.changes)return fail(res,404,'Pengguna tidak ditemukan.');await db.run('UPDATE sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL',Date.now(),req.params.id);await audit(req.user,'RESET_PASSWORD','user',req.params.id);res.json({success:true});}catch(e){next(e);}
});
app.delete('/api/users/:id',auth,allow('ADMIN'),async(req,res,next)=>{
 try {if(req.params.id===req.user.id)return fail(res,400,'Akun yang sedang digunakan tidak dapat dinonaktifkan.');const result=await db.run('UPDATE users SET active=0,updated_at=CURRENT_TIMESTAMP WHERE id=?',req.params.id);if(!result.changes)return fail(res,404,'Pengguna tidak ditemukan.');await db.run('UPDATE sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL',Date.now(),req.params.id);await audit(req.user,'DEACTIVATE','user',req.params.id);res.json({success:true});}catch(e){next(e);}
});
app.patch('/api/classes/:id',auth,allow('ADMIN'),async(req,res,next)=>{
 try {const old=await db.get('SELECT * FROM classes WHERE id=?',req.params.id);if(!old)return fail(res,404,'Kelas tidak ditemukan.');const b=req.body||{},name=String(b.name===undefined?old.name:b.name).trim(),grade=b.grade||old.grade;if(!name||!['VII','VIII','IX'].includes(grade))return fail(res,400,'Data kelas tidak valid.');
 await db.run('UPDATE classes SET name=?,grade=?,homeroom_teacher=? WHERE id=?',name,grade,String(b.homeroomTeacher===undefined?old.homeroom_teacher:b.homeroomTeacher),old.id);
 if(name!==old.name){
  const teacherRows=await db.all("SELECT id,assigned_classes FROM users WHERE role='TEACHER'");
  for(const teacher of teacherRows){
   let assigned=[];try{assigned=JSON.parse(teacher.assigned_classes||'[]');}catch{}
   if(assigned.includes(old.name)){const updated=assigned.map(x=>x===old.name?name:x);await db.run('UPDATE users SET assigned_classes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',JSON.stringify(updated),teacher.id);}
  }
 }
 await audit(req.user,'UPDATE','class',old.id,{previousName:old.name,name});res.json({success:true});
 }catch(e){if(e.code==='SQLITE_CONSTRAINT' && /UNIQUE constraint failed/.test(e.message))return fail(res,409,'Nama kelas sudah digunakan.');next(e);}
});
app.delete('/api/classes/:id',auth,allow('ADMIN'),async(req,res,next)=>{
 try {const usage=await db.get('SELECT COUNT(*) n FROM students WHERE class_id=? AND active=1',req.params.id);if(usage.n)return fail(res,409,'Kelas masih memiliki siswa aktif.');const result=await db.run('UPDATE classes SET active=0 WHERE id=?',req.params.id);if(!result.changes)return fail(res,404,'Kelas tidak ditemukan.');await audit(req.user,'DEACTIVATE','class',req.params.id);res.json({success:true});}catch(e){next(e);}
});
app.patch('/api/students/:id',auth,allow('ADMIN'),async(req,res,next)=>{
 try {const old=await db.get('SELECT * FROM students WHERE id=?',req.params.id);if(!old)return fail(res,404,'Siswa tidak ditemukan.');const b=req.body||{};let classId=old.class_id;if(b.class){const c=await db.get('SELECT id FROM classes WHERE name=? AND active=1',b.class);if(!c)return fail(res,400,'Kelas tidak ditemukan.');classId=c.id;}
 await db.run('UPDATE students SET name=?,nisn=?,gender=?,class_id=?,active=? WHERE id=?',String(b.name===undefined?old.name:b.name).trim(),String(b.nisn===undefined?old.nisn:b.nisn).trim(),b.gender||old.gender,classId,b.active===undefined?old.active:(b.active?1:0),old.id);await audit(req.user,'UPDATE','student',old.id);res.json({success:true});
 }catch(e){if(e.code==='SQLITE_CONSTRAINT' && /UNIQUE constraint failed/.test(e.message))return fail(res,409,'NISN sudah digunakan.');next(e);}
});
app.delete('/api/students/:id',auth,allow('ADMIN'),async(req,res,next)=>{
 try {const result=await db.run('UPDATE students SET active=0 WHERE id=?',req.params.id);if(!result.changes)return fail(res,404,'Siswa tidak ditemukan.');await audit(req.user,'DEACTIVATE','student',req.params.id);res.json({success:true});}catch(e){next(e);}
});
app.post('/api/settings/gemini-key',auth,allow('ADMIN'),(_req,res)=>fail(res,410,'Kunci AI tidak disimpan dari browser. Atur GEMINI_API_KEY pada environment server.'));
app.use((err,_req,res,_next)=>{console.error('API error:',err);res.status(500).json({success:false,message:'Terjadi kesalahan server. Silakan coba kembali.'});});
app.use((_req,res)=>fail(res,404,'Endpoint tidak ditemukan.'));
app.listen(PORT,()=>console.log('KELAS+ API listening on port '+PORT+'; database: '+DB_PATH));
