export interface StudentCaseProviderPayload {
  systemInstruction: { parts: Array<{ text: string }> };
  contents: Array<{ role: 'user'; parts: Array<{ text: string }> }>;
  generationConfig: { temperature: number; maxOutputTokens: number };
}

/**
 * Centralizes the exact request envelope sent to the AI provider so privacy
 * tests can inspect the serialized payload before any network call.
 */
export function buildStudentCaseProviderPayload(
  systemPrompt: string,
  sanitizedQuestion: string,
): StudentCaseProviderPayload {
  return {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: sanitizedQuestion }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 1100 },
  };
}

export function buildStudentCaseAuditMetadata(input: {
  caseReference: string;
  model: string;
  assessmentScope?: 'ALL_CLASS_SUBJECTS' | 'ASSIGNED_SUBJECTS_ONLY';
  generationStatus?: 'PENDING' | 'SUCCEEDED' | 'FAILED';
}) {
  return {
    caseReference: input.caseReference,
    capability: 'teacher_assistant',
    model: input.model,
    policyVersion: '2026-11-05-v1',
    ...(input.assessmentScope ? { assessmentScope: input.assessmentScope } : {}),
    ...(input.generationStatus ? { generationStatus: input.generationStatus } : {}),
    dataCategories: ['attendance_summary_90d', 'published_assessment_scores'],
    excludedCategories: [
      'student_name',
      'student_number',
      'contact_details',
      'address',
      'date_of_birth',
      'family_profile',
      'free_text_notes',
      'student_internal_id',
      'raw_prompt',
    ],
  };
}
