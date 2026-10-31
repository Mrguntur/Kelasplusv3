-- Core academic model: staff, students, classes, assignments, attendance,
-- teaching journals, assessments and scores. Never run against production here.
CREATE TYPE "StaffProfileStatus" AS ENUM ('ACTIVE','INACTIVE');
CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE','TRANSFERRED','GRADUATED','INACTIVE');
CREATE TYPE "SchoolClassStatus" AS ENUM ('ACTIVE','ARCHIVED');
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE','ENDED');
CREATE TYPE "SubjectStatus" AS ENUM ('ACTIVE','ARCHIVED');
CREATE TYPE "AttendanceSessionStatus" AS ENUM ('DRAFT','OPEN','FINALIZED');
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT','LATE','SICK','EXCUSED','ABSENT');
CREATE TYPE "TeachingJournalStatus" AS ENUM ('DRAFT','SUBMITTED');
CREATE TYPE "AssessmentStatus" AS ENUM ('DRAFT','PUBLISHED','ARCHIVED');

-- Ensure term IDs can be referenced in composite same-school foreign keys.
ALTER TABLE "terms" ADD CONSTRAINT "terms_school_id_id_key" UNIQUE ("school_id","id");

CREATE TABLE "staff_profiles" (
 "id" UUID PRIMARY KEY, "school_id" UUID NOT NULL, "user_id" UUID NOT NULL,
 "employee_number" VARCHAR(60), "display_name" VARCHAR(200) NOT NULL,
 "status" "StaffProfileStatus" NOT NULL DEFAULT 'ACTIVE',
 "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updated_at" TIMESTAMPTZ(6) NOT NULL,
 CONSTRAINT "staff_profiles_school_id_id_key" UNIQUE ("school_id","id"),
 CONSTRAINT "staff_profiles_school_id_user_id_key" UNIQUE ("school_id","user_id"),
 CONSTRAINT "staff_profiles_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "staff_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "staff_profiles_school_id_status_display_name_idx" ON "staff_profiles"("school_id","status","display_name");

CREATE TABLE "students" (
 "id" UUID PRIMARY KEY, "school_id" UUID NOT NULL, "student_number" VARCHAR(60),
 "full_name" VARCHAR(200) NOT NULL, "preferred_name" VARCHAR(100), "birth_date" DATE,
 "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
 "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updated_at" TIMESTAMPTZ(6) NOT NULL, "archived_at" TIMESTAMPTZ(6),
 CONSTRAINT "students_school_id_id_key" UNIQUE ("school_id","id"),
 CONSTRAINT "students_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "students_school_id_full_name_idx" ON "students"("school_id","full_name");
CREATE UNIQUE INDEX "students_school_id_student_number_key" ON "students"("school_id","student_number") WHERE "student_number" IS NOT NULL;

CREATE TABLE "school_classes" (
 "id" UUID PRIMARY KEY, "school_id" UUID NOT NULL, "academic_year_id" UUID NOT NULL,
 "name" VARCHAR(80) NOT NULL, "grade_level" INTEGER NOT NULL, "homeroom_staff_profile_id" UUID,
 "status" "SchoolClassStatus" NOT NULL DEFAULT 'ACTIVE',
 "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updated_at" TIMESTAMPTZ(6) NOT NULL,
 CONSTRAINT "school_classes_grade_level_check" CHECK ("grade_level" BETWEEN 1 AND 12),
 CONSTRAINT "school_classes_school_id_id_key" UNIQUE ("school_id","id"),
 CONSTRAINT "school_classes_school_id_academic_year_id_name_key" UNIQUE ("school_id","academic_year_id","name"),
 CONSTRAINT "school_classes_year_fkey" FOREIGN KEY ("school_id","academic_year_id") REFERENCES "academic_years"("school_id","id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "school_classes_homeroom_fkey" FOREIGN KEY ("school_id","homeroom_staff_profile_id") REFERENCES "staff_profiles"("school_id","id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "school_classes_school_id_academic_year_id_status_idx" ON "school_classes"("school_id","academic_year_id","status");

CREATE TABLE "class_enrollments" (
 "id" UUID PRIMARY KEY, "school_id" UUID NOT NULL, "class_id" UUID NOT NULL, "student_id" UUID NOT NULL,
 "enrolled_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "left_at" TIMESTAMPTZ(6),
 "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
 "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "class_enrollments_class_fkey" FOREIGN KEY ("school_id","class_id") REFERENCES "school_classes"("school_id","id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "class_enrollments_student_fkey" FOREIGN KEY ("school_id","student_id") REFERENCES "students"("school_id","id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "class_enrollments_date_check" CHECK ("left_at" IS NULL OR "left_at" >= "enrolled_at")
);
CREATE INDEX "class_enrollments_school_id_class_id_status_idx" ON "class_enrollments"("school_id","class_id","status");
CREATE INDEX "class_enrollments_school_id_student_id_status_idx" ON "class_enrollments"("school_id","student_id","status");
-- Prevent two simultaneously active enrollments for the same student in a given class-year.
CREATE UNIQUE INDEX "class_enrollments_one_active_per_class_student_key" ON "class_enrollments"("school_id","class_id","student_id") WHERE "status"='ACTIVE';

CREATE TABLE "subjects" (
 "id" UUID PRIMARY KEY, "school_id" UUID NOT NULL, "code" VARCHAR(40), "name" VARCHAR(120) NOT NULL,
 "status" "SubjectStatus" NOT NULL DEFAULT 'ACTIVE',
 "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updated_at" TIMESTAMPTZ(6) NOT NULL,
 CONSTRAINT "subjects_school_id_id_key" UNIQUE ("school_id","id"),
 CONSTRAINT "subjects_school_id_name_key" UNIQUE ("school_id","name"),
 CONSTRAINT "subjects_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "subjects_school_id_code_key" ON "subjects"("school_id","code") WHERE "code" IS NOT NULL;
CREATE INDEX "subjects_school_id_status_idx" ON "subjects"("school_id","status");

CREATE TABLE "teaching_assignments" (
 "id" UUID PRIMARY KEY, "school_id" UUID NOT NULL, "class_id" UUID NOT NULL, "subject_id" UUID NOT NULL,
 "staff_profile_id" UUID NOT NULL, "term_id" UUID, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "archived_at" TIMESTAMPTZ(6),
 CONSTRAINT "teaching_assignments_school_id_id_key" UNIQUE ("school_id","id"),
 CONSTRAINT "teaching_assignments_class_fkey" FOREIGN KEY ("school_id","class_id") REFERENCES "school_classes"("school_id","id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "teaching_assignments_subject_fkey" FOREIGN KEY ("school_id","subject_id") REFERENCES "subjects"("school_id","id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "teaching_assignments_staff_fkey" FOREIGN KEY ("school_id","staff_profile_id") REFERENCES "staff_profiles"("school_id","id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "teaching_assignments_term_fkey" FOREIGN KEY ("school_id","term_id") REFERENCES "terms"("school_id","id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "teaching_assignments_school_id_class_id_subject_id_idx" ON "teaching_assignments"("school_id","class_id","subject_id");
CREATE INDEX "teaching_assignments_school_id_staff_profile_id_idx" ON "teaching_assignments"("school_id","staff_profile_id");

CREATE TABLE "attendance_sessions" (
 "id" UUID PRIMARY KEY, "school_id" UUID NOT NULL, "class_id" UUID NOT NULL, "date" DATE NOT NULL,
 "session_label" VARCHAR(40) NOT NULL DEFAULT 'REGULAR',
 "status" "AttendanceSessionStatus" NOT NULL DEFAULT 'DRAFT', "taken_by_staff_profile_id" UUID NOT NULL,
 "finalized_at" TIMESTAMPTZ(6), "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updated_at" TIMESTAMPTZ(6) NOT NULL,
 CONSTRAINT "attendance_sessions_school_id_id_key" UNIQUE ("school_id","id"),
 CONSTRAINT "attendance_sessions_class_fkey" FOREIGN KEY ("school_id","class_id") REFERENCES "school_classes"("school_id","id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "attendance_sessions_staff_fkey" FOREIGN KEY ("school_id","taken_by_staff_profile_id") REFERENCES "staff_profiles"("school_id","id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "attendance_sessions_finalized_check" CHECK (("status"='FINALIZED') = ("finalized_at" IS NOT NULL) OR "status" <> 'FINALIZED')
);
CREATE UNIQUE INDEX "attendance_sessions_school_class_date_label_key" ON "attendance_sessions"("school_id","class_id","date","session_label");
CREATE INDEX "attendance_sessions_school_id_date_status_idx" ON "attendance_sessions"("school_id","date","status");

CREATE TABLE "attendance_records" (
 "id" UUID PRIMARY KEY, "school_id" UUID NOT NULL, "attendance_session_id" UUID NOT NULL,
 "student_id" UUID NOT NULL, "status" "AttendanceStatus" NOT NULL, "note" VARCHAR(500),
 "recorded_by_user_id" UUID NOT NULL, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updated_at" TIMESTAMPTZ(6) NOT NULL,
 CONSTRAINT "attendance_records_school_session_student_key" UNIQUE ("school_id","attendance_session_id","student_id"),
 CONSTRAINT "attendance_records_session_fkey" FOREIGN KEY ("school_id","attendance_session_id") REFERENCES "attendance_sessions"("school_id","id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "attendance_records_student_fkey" FOREIGN KEY ("school_id","student_id") REFERENCES "students"("school_id","id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "attendance_records_user_fkey" FOREIGN KEY ("recorded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "attendance_records_school_id_student_id_status_idx" ON "attendance_records"("school_id","student_id","status");

CREATE TABLE "teaching_journals" (
 "id" UUID PRIMARY KEY, "school_id" UUID NOT NULL, "teaching_assignment_id" UUID NOT NULL,
 "journal_date" DATE NOT NULL, "topic" VARCHAR(250) NOT NULL, "learning_activity" TEXT NOT NULL,
 "reflection" TEXT, "status" "TeachingJournalStatus" NOT NULL DEFAULT 'DRAFT', "created_by_user_id" UUID NOT NULL,
 "submitted_at" TIMESTAMPTZ(6), "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updated_at" TIMESTAMPTZ(6) NOT NULL,
 CONSTRAINT "teaching_journals_school_id_id_key" UNIQUE ("school_id","id"),
 CONSTRAINT "teaching_journals_assignment_fkey" FOREIGN KEY ("school_id","teaching_assignment_id") REFERENCES "teaching_assignments"("school_id","id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "teaching_journals_user_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "teaching_journals_school_assignment_date_idx" ON "teaching_journals"("school_id","teaching_assignment_id","journal_date");

CREATE TABLE "assessments" (
 "id" UUID PRIMARY KEY, "school_id" UUID NOT NULL, "teaching_assignment_id" UUID NOT NULL,
 "title" VARCHAR(200) NOT NULL, "assessment_type" VARCHAR(60) NOT NULL, "max_score" DECIMAL(7,2) NOT NULL,
 "weight" DECIMAL(5,2), "due_date" DATE, "status" "AssessmentStatus" NOT NULL DEFAULT 'DRAFT',
 "created_by_user_id" UUID NOT NULL, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updated_at" TIMESTAMPTZ(6) NOT NULL,
 CONSTRAINT "assessments_school_id_id_key" UNIQUE ("school_id","id"),
 CONSTRAINT "assessments_max_score_check" CHECK ("max_score" > 0),
 CONSTRAINT "assessments_weight_check" CHECK ("weight" IS NULL OR ("weight" >= 0 AND "weight" <= 100)),
 CONSTRAINT "assessments_assignment_fkey" FOREIGN KEY ("school_id","teaching_assignment_id") REFERENCES "teaching_assignments"("school_id","id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "assessments_user_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "assessments_school_assignment_status_idx" ON "assessments"("school_id","teaching_assignment_id","status");

CREATE TABLE "assessment_scores" (
 "id" UUID PRIMARY KEY, "school_id" UUID NOT NULL, "assessment_id" UUID NOT NULL, "student_id" UUID NOT NULL,
 "score" DECIMAL(7,2), "feedback" VARCHAR(1000), "entered_by_user_id" UUID NOT NULL,
 "entered_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(6) NOT NULL,
 CONSTRAINT "assessment_scores_school_assessment_student_key" UNIQUE ("school_id","assessment_id","student_id"),
 CONSTRAINT "assessment_scores_score_nonnegative_check" CHECK ("score" IS NULL OR "score" >= 0),
 CONSTRAINT "assessment_scores_assessment_fkey" FOREIGN KEY ("school_id","assessment_id") REFERENCES "assessments"("school_id","id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "assessment_scores_student_fkey" FOREIGN KEY ("school_id","student_id") REFERENCES "students"("school_id","id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "assessment_scores_user_fkey" FOREIGN KEY ("entered_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "assessment_scores_school_student_idx" ON "assessment_scores"("school_id","student_id");

-- FORCE RLS and fail closed for missing context. Membership is rechecked at the DB boundary.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'staff_profiles','students','school_classes','class_enrollments','subjects',
    'teaching_assignments','attendance_sessions','attendance_records',
    'teaching_journals','assessments','assessment_scores'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I USING (school_id = NULLIF(current_setting(''app.current_school_id'', true), '''')::uuid AND EXISTS (SELECT 1 FROM public.school_memberships m WHERE m.school_id = %I.school_id AND m.user_id = NULLIF(current_setting(''app.current_user_id'', true), '''')::uuid)) WITH CHECK (school_id = NULLIF(current_setting(''app.current_school_id'', true), '''')::uuid AND EXISTS (SELECT 1 FROM public.school_memberships m WHERE m.school_id = %I.school_id AND m.user_id = NULLIF(current_setting(''app.current_user_id'', true), '''')::uuid))',
      t || '_tenant_scope', t, t, t
    );
  END LOOP;
END $$;
