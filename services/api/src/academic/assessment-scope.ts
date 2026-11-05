/**
 * Builds the least-privilege assessment assignment filter shared by class reports
 * and teacher AI case analysis. null means an authorized school/homeroom scope;
 * an array limits access to the teacher's assigned subjects.
 */
export function buildAssessmentAssignmentScope(subjectIds: string[] | null) {
  if (subjectIds === null) return { archivedAt: null };
  return {
    archivedAt: null,
    subjectId: { in: [...new Set(subjectIds)] },
  };
}
