import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, AuthenticatedUser } from '../auth/current-user.decorator';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { AcademicService } from './academic.service';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { CreateTermDto } from './dto/create-term.dto';
import { CreateStudentDto } from './dto/create-student.dto';
import { CreateClassDto } from './dto/create-class.dto';
import { CreateStaffProfileDto } from './dto/create-staff-profile.dto';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { CreateTeachingAssignmentDto } from './dto/create-teaching-assignment.dto';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { CreateAttendanceSessionDto } from './dto/create-attendance-session.dto';
import { SubmitAttendanceDto } from './dto/submit-attendance.dto';
import { CreateTeachingJournalDto } from './dto/create-teaching-journal.dto';
import { UpdateTeachingJournalDto } from './dto/update-teaching-journal.dto';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { UpsertAssessmentScoresDto } from './dto/upsert-assessment-scores.dto';

@Controller('academic')
@UseGuards(SessionAuthGuard)
export class AcademicController {
  constructor(private readonly academic: AcademicService) {}

  @Get('years')
  listAcademicYears(@CurrentUser() user: AuthenticatedUser) {
    return this.academic.listAcademicYears(user);
  }

  @Post('years')
  @HttpCode(HttpStatus.CREATED)
  createAcademicYear(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateAcademicYearDto) {
    return this.academic.createAcademicYear(user, body);
  }

  @Get('years/:yearId/terms')
  listTerms(
    @CurrentUser() user: AuthenticatedUser,
    @Param('yearId', new ParseUUIDPipe()) yearId: string,
  ) {
    return this.academic.listTerms(user, yearId);
  }

  @Post('years/:yearId/terms')
  @HttpCode(HttpStatus.CREATED)
  createTerm(
    @CurrentUser() user: AuthenticatedUser,
    @Param('yearId', new ParseUUIDPipe()) yearId: string,
    @Body() body: CreateTermDto,
  ) {
    return this.academic.createTerm(user, yearId, body);
  }

  @Get('students')
  listStudents(@CurrentUser() user: AuthenticatedUser) {
    return this.academic.listStudents(user);
  }

  @Post('students')
  @HttpCode(HttpStatus.CREATED)
  createStudent(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateStudentDto) {
    return this.academic.createStudent(user, body);
  }

  @Get('classes')
  listClasses(@CurrentUser() user: AuthenticatedUser) {
    return this.academic.listClasses(user);
  }

  @Post('classes')
  @HttpCode(HttpStatus.CREATED)
  createClass(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateClassDto) {
    return this.academic.createClass(user, body);
  }


  @Get('staff')
  listStaffProfiles(@CurrentUser() user: AuthenticatedUser) {
    return this.academic.listStaffProfiles(user);
  }

  @Post('staff')
  @HttpCode(HttpStatus.CREATED)
  createStaffProfile(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateStaffProfileDto) {
    return this.academic.createStaffProfile(user, body);
  }

  @Get('subjects')
  listSubjects(@CurrentUser() user: AuthenticatedUser) {
    return this.academic.listSubjects(user);
  }

  @Post('subjects')
  @HttpCode(HttpStatus.CREATED)
  createSubject(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateSubjectDto) {
    return this.academic.createSubject(user, body);
  }



  @Get('teaching-assignments')
  listTeachingAssignments(@CurrentUser() user: AuthenticatedUser) {
    return this.academic.listTeachingAssignments(user);
  }

  @Post('teaching-assignments')
  @HttpCode(HttpStatus.CREATED)
  createTeachingAssignment(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateTeachingAssignmentDto) {
    return this.academic.createTeachingAssignment(user, body);
  }

  @Get('classes/:classId/enrollments')
  listClassEnrollments(
    @CurrentUser() user: AuthenticatedUser,
    @Param('classId', new ParseUUIDPipe()) classId: string,
  ) {
    return this.academic.listClassEnrollments(user, classId);
  }

  @Post('classes/:classId/enrollments')
  @HttpCode(HttpStatus.CREATED)
  enrollStudent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('classId', new ParseUUIDPipe()) classId: string,
    @Body() body: CreateEnrollmentDto,
  ) {
    return this.academic.enrollStudent(user, classId, body);
  }


  @Get('classes/:classId/attendance-sessions')
  listAttendanceSessions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('classId', new ParseUUIDPipe()) classId: string,
  ) {
    return this.academic.listAttendanceSessions(user, classId);
  }

  @Post('classes/:classId/attendance-sessions')
  @HttpCode(HttpStatus.CREATED)
  createAttendanceSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('classId', new ParseUUIDPipe()) classId: string,
    @Body() body: CreateAttendanceSessionDto,
  ) {
    return this.academic.createAttendanceSession(user, classId, body);
  }

  @Post('attendance-sessions/:sessionId/records')
  submitAttendance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Body() body: SubmitAttendanceDto,
  ) {
    return this.academic.submitAttendance(user, sessionId, body);
  }

  @Post('attendance-sessions/:sessionId/finalize')
  finalizeAttendance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
  ) {
    return this.academic.finalizeAttendance(user, sessionId);
  }


  @Get('journals')
  listTeachingJournals(@CurrentUser() user: AuthenticatedUser) {
    return this.academic.listTeachingJournals(user);
  }

  @Post('journals')
  @HttpCode(HttpStatus.CREATED)
  createTeachingJournal(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateTeachingJournalDto) {
    return this.academic.createTeachingJournal(user, body);
  }

  @Post('journals/:journalId/submit')
  submitTeachingJournal(
    @CurrentUser() user: AuthenticatedUser,
    @Param('journalId', new ParseUUIDPipe()) journalId: string,
  ) {
    return this.academic.submitTeachingJournal(user, journalId);
  }

  @Post('journals/:journalId/update')
  updateTeachingJournal(
    @CurrentUser() user: AuthenticatedUser,
    @Param('journalId', new ParseUUIDPipe()) journalId: string,
    @Body() body: UpdateTeachingJournalDto,
  ) {
    return this.academic.updateTeachingJournal(user, journalId, body);
  }


  @Get('assessments')
  listAssessments(@CurrentUser() user: AuthenticatedUser) {
    return this.academic.listAssessments(user);
  }

  @Post('assessments')
  @HttpCode(HttpStatus.CREATED)
  createAssessment(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateAssessmentDto) {
    return this.academic.createAssessment(user, body);
  }

  @Get('assessments/:assessmentId/scores')
  listAssessmentScores(
    @CurrentUser() user: AuthenticatedUser,
    @Param('assessmentId', new ParseUUIDPipe()) assessmentId: string,
  ) {
    return this.academic.listAssessmentScores(user, assessmentId);
  }

  @Post('assessments/:assessmentId/scores')
  upsertAssessmentScores(
    @CurrentUser() user: AuthenticatedUser,
    @Param('assessmentId', new ParseUUIDPipe()) assessmentId: string,
    @Body() body: UpsertAssessmentScoresDto,
  ) {
    return this.academic.upsertAssessmentScores(user, assessmentId, body);
  }

  @Post('assessments/:assessmentId/publish')
  publishAssessment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('assessmentId', new ParseUUIDPipe()) assessmentId: string,
  ) {
    return this.academic.publishAssessment(user, assessmentId);
  }


  @Get('reports/classes/:classId')
  getClassAcademicReport(
    @CurrentUser() user: AuthenticatedUser,
    @Param('classId', new ParseUUIDPipe()) classId: string,
  ) {
    return this.academic.getClassAcademicReport(user, classId);
  }

}
