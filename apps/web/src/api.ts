const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1').replace(/\/$/, '');

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path.startsWith('/') ? path : `/${path}`}`, {
      ...init,
      credentials: 'include',
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError('Tidak dapat terhubung ke server. Periksa API dan koneksi jaringan.', 0);
  }
  if (!response.ok) {
    let message = `Permintaan gagal (${response.status}).`;
    try {
      const body = await response.json() as { message?: string | string[]; error?: string };
      if (Array.isArray(body.message)) message = body.message.join(', ');
      else if (body.message) message = body.message;
      else if (body.error) message = body.error;
    } catch { /* response may not contain JSON */ }
    throw new ApiError(message, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export interface School {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  locale: string;
  role: 'SCHOOL_ADMIN' | 'SCHOOL_LEADER' | 'TEACHER' | 'SCHOOL_OPERATOR' | string;
  activeSchoolId?: string;
}
export interface User { id: string; email: string; displayName: string; activeSchoolId?: string | null }
export interface DashboardSummary {
  role: string;
  period: { from: string; to: string };
  activeAcademicYear?: { name: string } | null;
  metrics: Record<string, number | null>;
  attendance?: Record<string, number>;
  recentJournals: Array<{
    id: string; journalDate: string; topic: string; submittedAt: string | null;
    teacherName?: string; className: string; subjectName: string;
  }>;
}