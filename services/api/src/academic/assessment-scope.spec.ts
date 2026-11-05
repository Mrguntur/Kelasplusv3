import { buildAssessmentAssignmentScope } from './assessment-scope';

describe('buildAssessmentAssignmentScope', () => {
  it('keeps all subjects for school leaders, admins and homeroom teachers', () => {
    expect(buildAssessmentAssignmentScope(null)).toEqual({ archivedAt: null });
  });

  it('limits subject teachers to their assigned subjects and removes duplicates', () => {
    expect(buildAssessmentAssignmentScope(['english-id', 'math-id', 'english-id'])).toEqual({
      archivedAt: null,
      subjectId: { in: ['english-id', 'math-id'] },
    });
  });

  it('does not silently broaden an empty subject assignment to all subjects', () => {
    expect(buildAssessmentAssignmentScope([])).toEqual({
      archivedAt: null,
      subjectId: { in: [] },
    });
  });
});
