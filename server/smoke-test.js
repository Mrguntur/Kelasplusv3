import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'kelasplus-smoke-'));
const port = 5100 + Math.floor(Math.random() * 700);
const origin = 'http://localhost:5173';
const env = {
  ...process.env,
  NODE_ENV: 'test',
  PORT: String(port),
  FRONTEND_ORIGIN: origin,
  DB_PATH: path.join(tempDir, 'test.sqlite'),
  INITIAL_ADMIN_USERNAME: 'ci-admin',
  INITIAL_ADMIN_PASSWORD: 'CI-only-passphrase-123!'
};
const server = spawn(process.execPath, ['server/index.js'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
let output = '';
server.stdout.on('data', chunk => { output += chunk.toString(); });
server.stderr.on('data', chunk => { output += chunk.toString(); });
const base = 'http://127.0.0.1:' + port + '/api';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function request(pathname, options = {}) {
  return fetch(base + pathname, options);
}

try {
  let healthy = false;
  for (let i = 0; i < 80; i += 1) {
    if (server.exitCode !== null) throw new Error('Backend exited before health check:\n' + output);
    try {
      const response = await request('/health');
      if (response.ok) { healthy = true; break; }
    } catch {}
    await wait(250);
  }
  assert.equal(healthy, true, 'health endpoint should become ready');

  const anonymousBootstrap = await request('/bootstrap');
  assert.equal(anonymousBootstrap.status, 401, 'bootstrap must require authentication');

  const wrongLogin = await request('/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'ci-admin', password: 'wrong-password' })
  });
  assert.equal(wrongLogin.status, 401, 'invalid credentials must be rejected');

  const login = await request('/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'ci-admin', password: env.INITIAL_ADMIN_PASSWORD })
  });
  assert.equal(login.status, 200, 'valid initial admin credentials should work');
  const setCookie = login.headers.get('set-cookie');
  assert.ok(setCookie && setCookie.includes('HttpOnly'), 'session cookie should be HttpOnly');
  const cookie = setCookie.split(';')[0];
  const headers = { Cookie: cookie, 'Content-Type': 'application/json' };

  const bootstrapResponse = await request('/bootstrap', { headers });
  assert.equal(bootstrapResponse.status, 200);
  const bootstrap = await bootstrapResponse.json();
  assert.equal(bootstrap.success, true);
  assert.ok(bootstrap.classes.length > 0, 'seed classes should exist');
  assert.equal(Object.hasOwn(bootstrap.users[0], 'password'), false, 'password must not be returned');

  const createClass = await request('/classes', {
    method: 'POST', headers, body: JSON.stringify({ name: 'VII CI TEST', grade: 'VII' })
  });
  assert.equal(createClass.status, 201, 'admin should create a class');
  const classData = await createClass.json();

  const duplicateClass = await request('/classes', {
    method: 'POST', headers, body: JSON.stringify({ name: 'VII CI TEST', grade: 'VII' })
  });
  assert.equal(duplicateClass.status, 409, 'duplicate class names should be rejected');

  const createStudent = await request('/students', {
    method: 'POST', headers,
    body: JSON.stringify({ name: 'CI Test Student', nisn: 'CI' + Date.now(), class: 'VII CI TEST', gender: 'L' })
  });
  assert.equal(createStudent.status, 201, 'admin should create a student');
  const studentData = await createStudent.json();

  const attendance = await request('/attendance', {
    method: 'POST', headers,
    body: JSON.stringify({ className: 'VII CI TEST', date: '2026-10-11', records: { [studentData.student.id]: 'PRESENT' } })
  });
  assert.equal(attendance.status, 200, 'attendance should persist for a valid student/class');

  const logout = await request('/auth/logout', { method: 'POST', headers });
  assert.equal(logout.status, 200);
  const revoked = await request('/bootstrap', { headers });
  assert.equal(revoked.status, 401, 'revoked session must not access protected routes');

  console.log('KELAS+ smoke tests passed: health, authentication, protected bootstrap, CRUD validation, attendance, logout.');
} catch (error) {
  console.error(output);
  throw error;
} finally {
  server.kill('SIGTERM');
  await wait(300);
  if (server.exitCode === null) server.kill('SIGKILL');
  await rm(tempDir, { recursive: true, force: true });
}
