import { AiService } from './ai.service';
import type { PrismaService } from '../database/prisma.service';
import type { ConfigService } from '@nestjs/config';
import type { EntitlementService } from '../entitlements/entitlement.service';

describe('AiService privacy safeguards', () => {
  const service = new AiService(
    {} as unknown as PrismaService,
    {} as unknown as ConfigService,
    {} as unknown as EntitlementService,
  );

  const internals = service as unknown as {
    redactSensitiveText(value: string): string;
    buildPrompt(capability: 'teacher_assistant' | 'leadership_insights', context: Record<string, unknown>): string;
  };

  it('redacts common email, Indonesian mobile and 10-digit identifier patterns', () => {
    const redacted = internals.redactSensitiveText(
      'Hubungi guru@example.sch.id atau 081234567890. Nomor lain 1234567890.',
    );

    expect(redacted).not.toContain('guru@example.sch.id');
    expect(redacted).not.toContain('081234567890');
    expect(redacted).not.toContain('1234567890');
    expect(redacted).toContain('[EMAIL DIHAPUS]');
    expect(redacted).toContain('[NOMOR TELEPON DIHAPUS]');
    expect(redacted).toContain('[NOMOR IDENTITAS DIHAPUS]');
  });

  it('keeps the teacher assistant prompt pedagogical and limited to aggregate context', () => {
    const prompt = internals.buildPrompt(
      'teacher_assistant',
      { scope: 'kelas yang ditugaskan', activeStudents: 24, activeClasses: 2 },
    );

    expect(prompt).toContain('asisten pedagogis guru SMP');
    expect(prompt).toContain('ringkasan statistik agregat');
    expect(prompt).toContain('Jangan mendiagnosis siswa');
    expect(prompt).toContain('tidak dibuktikan oleh statistik');
    expect(prompt).toContain('keputusan akhir tetap pada manusia');
    expect(prompt).toContain('ringkasan statistik agregat');
    expect(prompt).toContain('activeStudents');
    expect(prompt).not.toContain('Pertanyaan pengguna:');
  });

  it('keeps leadership insights at school level and requires human verification', () => {
    const prompt = internals.buildPrompt(
      'leadership_insights',
      { scope: 'agregat seluruh sekolah', activeStudents: 300, activeClasses: 12 },
    );

    expect(prompt).toContain('analis pendidikan untuk pimpinan sekolah');
    expect(prompt).toContain('agregat seluruh sekolah');
    expect(prompt).toContain('verifikasi manusia');
    expect(prompt).toContain('tidak membuat kesimpulan');
    expect(prompt).toContain('persentase kehadiran hanya jika total catatan tersedia');
    expect(prompt).not.toContain('nama siswa');
  });
});
