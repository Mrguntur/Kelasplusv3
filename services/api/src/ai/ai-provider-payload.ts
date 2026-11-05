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
