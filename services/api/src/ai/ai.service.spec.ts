import { AiService } from './ai.service';
import type { PrismaService } from '../database/prisma.service';
import type { ConfigService } from '@nestjs/config';
import type { EntitlementService } from '../entitlements/entitlement.service';
import type { AuditService } from '../audit/audit.service';

describe('AiService privacy safeguards', () => {
  const service = new AiService(
    {} as unknown as PrismaService,
    {} as unknown as ConfigService,
    {} as unknown as EntitlementService,
    {} as unknown as AuditService,
  );

  const internals = service as unknown as {
    redactSensitiveText(value: string): string;
    redactCaseQuestion(value: string, names: Array<string | null | undefined>): string;
    buildPrompt(capability: 'teacher_assistant' | 'leadership_insights', context: Record<string, unknown>): string;
    normalizeAssessmentScore(score: unknown, maxScore: number): number | null;
  };


  it('normalizes only finite scores within the assessment maximum', () => {
    expect(internals.normalizeAssessmentScore(8, 10)).toBe(80);
    expect(internals.normalizeAssessmentScore(0, 10)).toBe(0);
    expect(internals.normalizeAssessmentScore(10, 10)).toBe(100);
    expect(internals.normalizeAssessmentScore(null, 10)).toBeNull();
    expect(internals.normalizeAssessmentScore(-1, 10)).toBeNull();
    expect(internals.normalizeAssessmentScore(11, 10)).toBeNull();
    expect(internals.normalizeAssessmentScore(Number.NaN, 10)).toBeNull();
    expect(internals.normalizeAssessmentScore(5, 0)).toBeNull();
    expect(internals.normalizeAssessmentScore(5, Number.POSITIVE_INFINITY)).toBeNull();
  });

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

  it('redacts long student and national identity number patterns from free text', () => {
    const redacted = internals.redactSensitiveText(
      'NISN 0012345678 dan NIK 6301021234567890 tercantum pada pertanyaan.',
    );

    expect(redacted).not.toContain('0012345678');
    expect(redacted).not.toContain('6301021234567890');
    expect(redacted.split('[NOMOR IDENTITAS DIHAPUS]').length - 1).toBe(2);
  });

  it('removes the selected student name from the free-text question before provider submission', () => {
    const sanitized = internals.redactCaseQuestion(
      'Bagaimana membantu Ahmad Saputra yang sering absen?',
      ['Ahmad Saputra', 'Ahmad'],
    );

    expect(sanitized).not.toContain('Ahmad Saputra');
    expect(sanitized).not.toContain('Ahmad');
    expect(sanitized).toContain('[IDENTITAS SISWA DIHAPUS]');
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
    expect(prompt).toContain('jangan membuat kesimpulan');
    expect(prompt).toContain('persentase kehadiran hanya jika total catatan tersedia');
    expect(prompt).not.toContain('nama siswa');
  });
});
