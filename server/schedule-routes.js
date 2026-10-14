/**
 * KELAS+ teaching schedules and push notifications.
 * Reminder delivery is server-driven: cPanel cron should call
 * POST /api/internal/notifications/dispatch every minute with X-Cron-Secret.
 */
import crypto from 'node:crypto';
import { getMessaging } from 'firebase-admin/messaging';

const DAYS = new Set([1, 2, 3, 4, 5, 6, 7]);
const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const tokenHash = token => crypto.createHash('sha256').update(token).digest('hex');
const fail = (res, code, message) => res.status(code).json({ success: false, message });
const clean = value => String(value ?? '').trim();
const nowIso = () => new Date().toISOString();

function jakartaParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
    weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date);
  const p = Object.fromEntries(parts.map(item => [item.type, item.value]));
  const days = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return { date: `${p.year}-${p.month}-${p.day}`, dayOfWeek: days[p.weekday], hour: Number(p.hour), minute: Number(p.minute) };
}

export function registerScheduleRoutes({ app, auth, allow, col, list, listBy, getDoc, setDoc, audit, id, adminApp }) {
  const messaging = getMessaging(adminApp);

  app.get('/api/schedules', auth, async (req, res, next) => {
    try {
      const rows = (req.user.role === 'TEACHER' ? await listBy('teachingSchedules', 'teacherId', req.user.id) : await list('teachingSchedules')).filter(row => row.active !== false);
      const visible = rows;
      visible.sort((a, b) => (a.dayOfWeek - b.dayOfWeek) || a.startTime.localeCompare(b.startTime));
      res.json({ success: true, schedules: visible });
    } catch (error) { next(error); }
  });

  app.post('/api/schedules', auth, allow('ADMIN'), async (req, res, next) => {
    try {
      const b = req.body || {};
      const teacherId = clean(b.teacherId), classId = clean(b.classId);
      const subject = clean(b.subject), room = clean(b.room);
      const dayOfWeek = Number(b.dayOfWeek), startTime = clean(b.startTime), endTime = clean(b.endTime);
      if (!teacherId || !classId || !subject || !DAYS.has(dayOfWeek) || !TIME_RE.test(startTime) || !TIME_RE.test(endTime) || startTime >= endTime) {
        return fail(res, 400, 'Guru, kelas, mata pelajaran, hari, dan rentang waktu jadwal wajib valid.');
      }
      const [teacher, klass] = await Promise.all([getDoc('users', teacherId), getDoc('classes', classId)]);
      if (!teacher || teacher.role !== 'TEACHER' || !teacher.active) return fail(res, 400, 'Guru aktif tidak ditemukan.');
      if (!klass || klass.active === false) return fail(res, 400, 'Kelas aktif tidak ditemukan.');
      const schedules = await listBy('teachingSchedules', 'teacherId', teacherId);
      const conflict = schedules.find(s => s.active !== false && Number(s.dayOfWeek) === dayOfWeek &&
        startTime < s.endTime && endTime > s.startTime);
      if (conflict) return fail(res, 409, 'Jadwal bertabrakan dengan jadwal guru tersebut.');
      const scheduleId = id(), timestamp = nowIso();
      const schedule = { id: scheduleId, teacherId, teacherName: teacher.name, classId, className: klass.name,
        subject, room, dayOfWeek, startTime, endTime, active: true, createdAt: timestamp, updatedAt: timestamp, createdBy: req.user.id };
      await col('teachingSchedules').doc(scheduleId).set(schedule);
      await audit(req.user, 'CREATE', 'teachingSchedule', scheduleId, { teacherId, classId, dayOfWeek, startTime, endTime });
      res.status(201).json({ success: true, schedule });
    } catch (error) { next(error); }
  });

  app.patch('/api/schedules/:id', auth, allow('ADMIN'), async (req, res, next) => {
    try {
      const old = await getDoc('teachingSchedules', req.params.id);
      if (!old) return fail(res, 404, 'Jadwal tidak ditemukan.');
      const b = req.body || {};
      const teacherId = clean(b.teacherId ?? old.teacherId), classId = clean(b.classId ?? old.classId);
      const subject = clean(b.subject ?? old.subject), room = clean(b.room ?? old.room);
      const dayOfWeek = Number(b.dayOfWeek ?? old.dayOfWeek), startTime = clean(b.startTime ?? old.startTime), endTime = clean(b.endTime ?? old.endTime);
      if (!teacherId || !classId || !subject || !DAYS.has(dayOfWeek) || !TIME_RE.test(startTime) || !TIME_RE.test(endTime) || startTime >= endTime) {
        return fail(res, 400, 'Data jadwal tidak valid.');
      }
      const [teacher, klass, schedules] = await Promise.all([getDoc('users', teacherId), getDoc('classes', classId), listBy('teachingSchedules', 'teacherId', teacherId)]);
      if (!teacher || teacher.role !== 'TEACHER' || !teacher.active) return fail(res, 400, 'Guru aktif tidak ditemukan.');
      if (!klass || klass.active === false) return fail(res, 400, 'Kelas aktif tidak ditemukan.');
      const conflict = schedules.find(s => s.id !== old.id && s.active !== false && s.teacherId === teacherId && Number(s.dayOfWeek) === dayOfWeek && startTime < s.endTime && endTime > s.startTime);
      if (conflict) return fail(res, 409, 'Jadwal bertabrakan dengan jadwal guru tersebut.');
      const schedule = { teacherId, teacherName: teacher.name, classId, className: klass.name, subject, room, dayOfWeek, startTime, endTime, active: b.active === undefined ? old.active !== false : Boolean(b.active), updatedAt: nowIso() };
      await setDoc('teachingSchedules', old.id, schedule, true);
      await audit(req.user, 'UPDATE', 'teachingSchedule', old.id, { teacherId, classId, dayOfWeek, startTime, endTime });
      res.json({ success: true, schedule: { ...old, ...schedule } });
    } catch (error) { next(error); }
  });

  app.delete('/api/schedules/:id', auth, allow('ADMIN'), async (req, res, next) => {
    try {
      const old = await getDoc('teachingSchedules', req.params.id);
      if (!old) return fail(res, 404, 'Jadwal tidak ditemukan.');
      await setDoc('teachingSchedules', old.id, { active: false, updatedAt: nowIso() }, true);
      await audit(req.user, 'DEACTIVATE', 'teachingSchedule', old.id);
      res.json({ success: true });
    } catch (error) { next(error); }
  });

  app.post('/api/notifications/register', auth, async (req, res, next) => {
    try {
      const token = clean(req.body?.token);
      const platform = clean(req.body?.platform);
      if (token.length < 30 || token.length > 4096 || !['web', 'android'].includes(platform)) {
        return fail(res, 400, 'Token perangkat atau platform tidak valid.');
      }
      const tokenId = tokenHash(token);
      await col('notificationDevices').doc(tokenId).set({ token, userId: req.user.id, platform, active: true, updatedAt: nowIso() }, { merge: true });
      res.json({ success: true });
    } catch (error) { next(error); }
  });

  app.delete('/api/notifications/register', auth, async (req, res, next) => {
    try {
      const token = clean(req.body?.token);
      if (!token) return fail(res, 400, 'Token perangkat wajib diisi.');
      const tokenId = tokenHash(token);
      const saved = await getDoc('notificationDevices', tokenId);
      if (saved && saved.userId === req.user.id) await col('notificationDevices').doc(tokenId).delete();
      res.json({ success: true });
    } catch (error) { next(error); }
  });

  // Configure CRON_SECRET on the server and call this endpoint every minute.
  // This endpoint intentionally does not use a browser session.
  app.post('/api/internal/notifications/dispatch', async (req, res, next) => {
    try {
      const expected = process.env.CRON_SECRET || '';
      const supplied = String(req.headers['x-cron-secret'] || '');
      if (expected.length < 32 || supplied.length !== expected.length ||
          !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
        return fail(res, 401, 'Unauthorized scheduler.');
      }
      const current = jakartaParts();
      const currentMinute = current.hour * 60 + current.minute;
      const targetMinute = currentMinute + 5;
      const targetDay = targetMinute >= 1440 ? (current.dayOfWeek % 7) + 1 : current.dayOfWeek;
      const normalizedTargetMinute = targetMinute % 1440;
      const targetTime = `${String(Math.floor(normalizedTargetMinute / 60)).padStart(2, '0')}:${String(normalizedTargetMinute % 60).padStart(2, '0')}`;
      const scheduleSnapshot = await col('teachingSchedules').where('dayOfWeek', '==', targetDay).get();
      const schedules = scheduleSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(s => s.active !== false && s.startTime === targetTime);
      let sent = 0, skipped = 0, failed = 0;
      for (const schedule of schedules) {
        const dispatchId = `${current.date}_${schedule.id}_${targetTime.replace(':', '')}`;
        const dispatchRef = col('notificationDispatches').doc(dispatchId);
        const reserved = await col('notificationDispatches').firestore.runTransaction(async tx => {
          const snap = await tx.get(dispatchRef);
          if (snap.exists) return false;
          tx.create(dispatchRef, { scheduleId: schedule.id, scheduledDate: current.date, targetTime, status: 'sending', createdAt: nowIso() });
          return true;
        });
        if (!reserved) { skipped++; continue; }
        try {
          const deviceSnapshot = await col('notificationDevices').where('userId', '==', schedule.teacherId).get();
          const devices = deviceSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(d => d.token);
          if (!devices.length) {
            await dispatchRef.delete();
            skipped++;
            continue;
          }
          const result = await messaging.sendEachForMulticast({
            tokens: devices.map(d => d.token),
            notification: { title: 'Pengingat Mengajar', body: `5 menit lagi: ${schedule.subject} — ${schedule.className} (${schedule.startTime}).` },
            data: { type: 'teaching_reminder', scheduleId: schedule.id, url: '/?page=schedule' },
            webpush: { fcmOptions: { link: 'https://kelasplus.my.id/?page=schedule' }, notification: { icon: '/favicon.png', tag: `schedule-${schedule.id}-${current.date}` } },
            android: { priority: 'high', notification: { channelId: 'teaching-reminders', tag: `schedule-${schedule.id}-${current.date}` } }
          });
          const batch = col('notificationDevices').firestore.batch();
          result.responses.forEach((response, index) => {
            if (!response.success && ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(response.error?.code)) {
              batch.delete(col('notificationDevices').doc(tokenHash(devices[index].token)));
            }
          });
          await batch.commit();
          await dispatchRef.set({ status: 'sent', successCount: result.successCount, failureCount: result.failureCount, sentAt: nowIso() }, { merge: true });
          sent += result.successCount;
          failed += result.failureCount;
        } catch (error) {
          await dispatchRef.delete().catch(() => {});
          console.error('Schedule notification dispatch failed:', error?.message || error);
          failed++;
        }
      }
      res.json({ success: true, timezone: 'Asia/Jakarta', targetTime, matchedSchedules: schedules.length, sent, skipped, failed });
    } catch (error) { next(error); }
  });
}
