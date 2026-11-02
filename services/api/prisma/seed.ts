import { PrismaClient, SchoolRole, SchoolStatus, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

function requiredLocalDatabase(): void {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL belum diatur.');
  const url = new URL(raw);
  const isLocal = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  if (!isLocal || url.port !== '5433' || url.pathname !== '/kelasplus_dev') {
    throw new Error(
      'Seed demo ditolak: hanya boleh berjalan pada localhost:5433/kelasplus_dev. Database lain tidak akan disentuh.',
    );
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seed demo tidak boleh dijalankan dengan NODE_ENV=production.');
  }
}

async function main(): Promise<void> {
  requiredLocalDatabase();

  const password = process.env.KELASPLUS_SEED_ADMIN_PASSWORD;
  if (!password || password.length < 12 || password.length > 128) {
    throw new Error('Atur KELASPLUS_SEED_ADMIN_PASSWORD dengan panjang 12–128 karakter.');
  }

  const email = (process.env.KELASPLUS_SEED_ADMIN_EMAIL ?? 'admin@kelasplus.local').trim().toLowerCase();
  const displayName = (process.env.KELASPLUS_SEED_ADMIN_NAME ?? 'Administrator Demo KELAS+').trim();
  if (!email || !displayName) throw new Error('Email dan nama administrator tidak boleh kosong.');

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  const result = await prisma.$transaction(async (tx) => {
    // This context is transaction-local and only permits creation/update of the
    // explicitly named local demo school through the platform-admin RLS policy.
    await tx.$executeRaw`SELECT set_config('app.is_platform_admin', 'true', true)`;

    const school = await tx.school.upsert({
      where: { slug: 'smpn-2-bajuin-demo' },
      create: {
        slug: 'smpn-2-bajuin-demo',
        name: 'UPTD SMPN 2 Bajuin (Demo Lokal)',
        status: SchoolStatus.ACTIVE,
        timezone: 'Asia/Makassar',
        locale: 'id-ID',
      },
      update: {
        name: 'UPTD SMPN 2 Bajuin (Demo Lokal)',
        status: SchoolStatus.ACTIVE,
        timezone: 'Asia/Makassar',
        locale: 'id-ID',
      },
      select: { id: true, name: true, slug: true },
    });

    const user = await tx.user.upsert({
      where: { email },
      create: {
        email,
        displayName,
        passwordHash,
        status: UserStatus.ACTIVE,
      },
      update: {
        displayName,
        passwordHash,
        status: UserStatus.ACTIVE,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
      select: { id: true, email: true, displayName: true },
    });

    // Membership writes require both identity and tenant context under RLS.
    await tx.$executeRaw`SELECT set_config('app.current_user_id', ${user.id}, true)`;
    await tx.$executeRaw`SELECT set_config('app.current_school_id', ${school.id}, true)`;

    await tx.schoolMembership.upsert({
      where: { schoolId_userId: { schoolId: school.id, userId: user.id } },
      create: { schoolId: school.id, userId: user.id, role: SchoolRole.SCHOOL_ADMIN },
      update: { role: SchoolRole.SCHOOL_ADMIN },
    });

    return { school, user };
  });

  console.log('Local KELAS+ demo seed berhasil.');
  console.log(`Sekolah: ${result.school.name} (${result.school.slug})`);
  console.log(`Akun admin: ${result.user.email}`);
  console.log('Kata sandi: menggunakan KELASPLUS_SEED_ADMIN_PASSWORD (tidak ditampilkan).');
}

main()
  .catch((error: unknown) => {
    console.error('Local demo seed gagal:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
