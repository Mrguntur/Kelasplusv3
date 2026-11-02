-- Enforce at most one active class placement per student in each school.
-- Existing duplicate active placements must be resolved before this migration can apply.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM class_enrollments
    WHERE status = 'ACTIVE'
    GROUP BY school_id, student_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot add active enrollment constraint: duplicate active student placements exist. Resolve duplicates first.';
  END IF;
END $$;

CREATE UNIQUE INDEX class_enrollments_one_active_per_student
  ON class_enrollments (school_id, student_id)
  WHERE status = 'ACTIVE';
