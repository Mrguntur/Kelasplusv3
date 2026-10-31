ALTER TABLE "sessions"
  ADD CONSTRAINT "sessions_active_school_id_fkey"
  FOREIGN KEY ("active_school_id") REFERENCES "schools"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
