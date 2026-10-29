# KELAS+ Platform V2 — Academic Data Model Proposal

Status: design proposal; not yet applied to Prisma or PostgreSQL migrations.
Branch: `feat/platform-v2-foundation`

## Design principles

1. Every school-owned row carries a non-null `school_id` and is protected by PostgreSQL RLS with `FORCE ROW LEVEL SECURITY`.
2. API queries set `app.current_user_id` and `app.current_school_id` transaction-locally only after session and membership validation.
3. Foreign keys that connect school-owned records must prevent cross-school references. Prefer composite unique keys and composite foreign keys including `school_id`, rather than relying only on application checks.
4. Use soft archival/status fields for records that must remain in historical reports. Avoid hard deletion of students, staff, attendance, and assessments.
5. Keep identity (`users`) separate from school employment/profile. A user may belong to more than one school.
6. Store dates in the school's calendar context; store timestamps as `timestamptz`. Default school timezone remains `Asia/Makassar`, but use each school's configured timezone.
7. Grades and attendance are audit-sensitive. Changes should be attributable to an actor and written to the audit log.
8. Avoid storing student sensitive information unless the feature requires it. Define retention and export controls before production use.

## Proposed first academic slice

### 1. Academic year and term
- `academic_years`: id, school_id, name, start_date, end_date, status (PLANNED/ACTIVE/COMPLETED), created_at, updated_at.
- Unique: (school_id, name); no overlapping active years should be enforced by service validation and reviewed database constraints.
- `terms`: id, school_id, academic_year_id, name, sequence, start_date, end_date.
- Composite FK: (school_id, academic_year_id) references academic_years(school_id, id).
- Unique: (school_id, academic_year_id, sequence).

### 2. People and class roster
- `staff_profiles`: id, school_id, user_id, employee_number nullable, display_name, status (ACTIVE/INACTIVE), created_at, updated_at.
- Unique: (school_id, user_id); optional unique (school_id, employee_number) where employee_number is not null.
- `students`: id, school_id, student_number nullable, full_name, preferred_name nullable, birth_date nullable, status (ACTIVE/TRANSFERRED/GRADUATED/INACTIVE), created_at, updated_at, archived_at nullable.
- Unique: (school_id, student_number) when student_number is present.
- Student personal data is intentionally limited in the first slice; no national ID, address, religion, or medical data in this initial model.
- `school_classes`: id, school_id, academic_year_id, name, grade_level, homeroom_staff_profile_id nullable, status (ACTIVE/ARCHIVED), created_at, updated_at.
- Unique: (school_id, academic_year_id, name); composite FK to academic year and homeroom staff profile.
- `class_enrollments`: id, school_id, class_id, student_id, enrolled_at, left_at nullable, status (ACTIVE/ENDED).
- Composite FKs enforce class and student belong to the same school. A partial unique index should prevent multiple active enrollments for the same student in the same academic year; validate this carefully against class moves.

### 3. Subjects and teaching assignments
- `subjects`: id, school_id, code nullable, name, status (ACTIVE/ARCHIVED).
- Unique: (school_id, name); optional unique (school_id, code) where code is not null.
- `teaching_assignments`: id, school_id, class_id, subject_id, staff_profile_id, term_id nullable, created_at, archived_at nullable.
- Composite FKs enforce every referenced object belongs to the same school.
- Unique active assignment by (school_id, class_id, subject_id, staff_profile_id, term_id) needs a clear policy for nullable term IDs; consider separate partial unique indexes.

### 4. Attendance
- `attendance_sessions`: id, school_id, class_id, date, session_label nullable, status (DRAFT/OPEN/FINALIZED), taken_by_staff_profile_id, finalized_at nullable, created_at, updated_at.
- Unique: (school_id, class_id, date, session_label) with a normalized non-null label strategy; do not allow duplicate sessions for one class/date by accident.
- `attendance_records`: id, school_id, attendance_session_id, student_id, status (PRESENT/LATE/SICK/EXCUSED/ABSENT), note nullable, recorded_by_user_id, created_at, updated_at.
- Unique: (school_id, attendance_session_id, student_id).
- Composite FKs enforce session and student school alignment. Do not store medical diagnosis in attendance notes.

### 5. Teaching journal and assessments
- `teaching_journals`: id, school_id, teaching_assignment_id, journal_date, topic, learning_activity, reflection nullable, status (DRAFT/SUBMITTED), created_by_user_id, submitted_at nullable, created_at, updated_at.
- `assessments`: id, school_id, teaching_assignment_id, title, assessment_type, max_score numeric(7,2), weight numeric(5,2) nullable, due_date nullable, status (DRAFT/PUBLISHED/ARCHIVED), created_by_user_id, created_at, updated_at.
- `assessment_scores`: id, school_id, assessment_id, student_id, score numeric(7,2) nullable, feedback nullable, entered_by_user_id, entered_at, updated_at.
- Constraints: score >= 0 and score <= assessment max_score; weights must be within the documented scale. Application transactions should validate max_score/score together; database triggers may be considered only if they materially improve consistency.
- Unique: (school_id, assessment_id, student_id).
- Preserve change history for published scores; corrections should produce audit events, not silently overwrite history.

## RLS pattern

For each school-owned table:
- Enable and FORCE RLS.
- `USING` requires row `school_id` equals `NULLIF(current_setting('app.current_school_id', true), '')::uuid`.
- `WITH CHECK` requires the same school match.
- RLS is defense in depth, not a substitute for role-based authorization. The API must still check whether the actor is a school admin, leader, teacher, or operator and whether that role permits the requested action.
- Where row ownership or assignment matters, add role/assignment-aware policies or enforce it in a narrowly scoped service; do not grant teachers unrestricted access to all students' records by default.
- Add negative tests for no context, School A vs School B reads, cross-school inserts/updates, and mismatched composite foreign keys, using the exact non-owner runtime role.

## Recommended migration order

1. Academic years and terms.
2. Staff profiles, students, classes, and enrollments.
3. Subjects and teaching assignments.
4. Attendance sessions and records.
5. Teaching journals.
6. Assessments and scores.
7. API authorization and integration tests per module.

Each migration must be reversible where practical, reviewed on a disposable PostgreSQL 17 database, and accompanied by Prisma validation, type checking, RLS integration tests, and API tests. Do not run these migrations against YoHost, Firebase, or any production database as part of this branch work.

## Not included in the first academic slice

- Student medical records, diagnoses, disability information, family/guardian contact details, national identifiers.
- Payment, payroll, messaging, AI analysis, student risk scoring, or external integrations.
- Automatic import from legacy Firebase data.
- Production rollout, real student data, or role permissions inferred only from client-side UI.

These should be designed separately with explicit data minimization, access rules, retention, and audit requirements.
