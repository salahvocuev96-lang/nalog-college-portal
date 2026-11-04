-- Начальная схема Education Portal.
-- SQL написан максимально переносимо: для PostgreSQL нужно заменить INTEGER PRIMARY KEY AUTOINCREMENT
-- на GENERATED ALWAYS AS IDENTITY и триггеры аудита на функции plpgsql (см. docs/ARCHITECTURE.md).

CREATE TABLE groups (
  id          TEXT PRIMARY KEY,
  code        TEXT NOT NULL UNIQUE,
  course      INTEGER NOT NULL CHECK (course BETWEEN 1 AND 6),
  specialty   TEXT NOT NULL,
  curator_id  TEXT REFERENCES teachers(id),
  is_demo     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE teachers (
  id    TEXT PRIMARY KEY,
  name  TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT ''
);

CREATE TABLE staff (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('college_admin', 'tech_admin'))
);

CREATE TABLE students (
  id       TEXT PRIMARY KEY,
  name     TEXT NOT NULL,
  group_id TEXT NOT NULL REFERENCES groups(id),
  email    TEXT NOT NULL DEFAULT '',
  phone    TEXT NOT NULL DEFAULT ''
);
CREATE INDEX students_group ON students(group_id);

CREATE TABLE parents (
  id    TEXT PRIMARY KEY,
  name  TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT ''
);

CREATE TABLE parent_children (
  parent_id  TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  PRIMARY KEY (parent_id, student_id)
);

CREATE TABLE subjects (
  id     TEXT PRIMARY KEY,
  name   TEXT NOT NULL UNIQUE,
  graded INTEGER NOT NULL DEFAULT 1
);

-- Назначения: какой преподаватель ведёт какой предмет в какой группе. Управляет администрация.
CREATE TABLE teaching_loads (
  teacher_id TEXT NOT NULL REFERENCES teachers(id),
  subject_id TEXT NOT NULL REFERENCES subjects(id),
  group_id   TEXT NOT NULL REFERENCES groups(id),
  PRIMARY KEY (teacher_id, subject_id, group_id)
);

CREATE TABLE schedule_slots (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id   TEXT NOT NULL REFERENCES groups(id),
  weekday    INTEGER NOT NULL CHECK (weekday BETWEEN 1 AND 6),
  slot       INTEGER NOT NULL CHECK (slot BETWEEN 1 AND 8),
  subject_id TEXT NOT NULL REFERENCES subjects(id),
  teacher_id TEXT NOT NULL REFERENCES teachers(id),
  room       TEXT NOT NULL DEFAULT '',
  UNIQUE (group_id, weekday, slot)
);
CREATE INDEX schedule_teacher ON schedule_slots(teacher_id);

-- Оценки и посещаемость хранятся раздельно
CREATE TABLE grades (
  student_id TEXT NOT NULL REFERENCES students(id),
  subject_id TEXT NOT NULL REFERENCES subjects(id),
  date       TEXT NOT NULL,
  value      INTEGER NOT NULL CHECK (value IN (2, 3, 4, 5)),
  teacher_id TEXT NOT NULL REFERENCES teachers(id),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (student_id, subject_id, date)
);

CREATE TABLE attendance (
  student_id TEXT NOT NULL REFERENCES students(id),
  subject_id TEXT NOT NULL REFERENCES subjects(id),
  date       TEXT NOT NULL,
  status     TEXT NOT NULL CHECK (status IN ('late', 'absent', 'sick')), -- «присутствовал» = записи нет
  PRIMARY KEY (student_id, subject_id, date)
);

CREATE TABLE homework (
  id          TEXT PRIMARY KEY,
  group_id    TEXT NOT NULL REFERENCES groups(id),
  subject_id  TEXT NOT NULL REFERENCES subjects(id),
  teacher_id  TEXT NOT NULL REFERENCES teachers(id),
  issued      TEXT NOT NULL,
  due         TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT ''
);
CREATE INDEX homework_group ON homework(group_id);

CREATE TABLE homework_progress (
  homework_id TEXT NOT NULL REFERENCES homework(id) ON DELETE CASCADE,
  student_id  TEXT NOT NULL REFERENCES students(id),
  status      TEXT NOT NULL CHECK (status IN ('in_progress', 'done')),
  PRIMARY KEY (homework_id, student_id)
);

CREATE TABLE messages (
  id      TEXT PRIMARY KEY,
  from_id TEXT NOT NULL,
  to_id   TEXT NOT NULL,
  text    TEXT NOT NULL,
  at      INTEGER NOT NULL,
  read    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX messages_to ON messages(to_id);
CREATE INDEX messages_from ON messages(from_id);

CREATE TABLE notifications (
  id      TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind    TEXT NOT NULL,
  title   TEXT NOT NULL,
  text    TEXT NOT NULL,
  at      INTEGER NOT NULL,
  read    INTEGER NOT NULL DEFAULT 0,
  href    TEXT NOT NULL DEFAULT '/notifications/'
);
CREATE INDEX notifications_user ON notifications(user_id);

-- Учётные записи. id совпадает с id человека (студент, преподаватель, родитель, сотрудник)
CREATE TABLE users (
  id                   TEXT PRIMARY KEY,
  login                TEXT NOT NULL UNIQUE,
  password_hash        TEXT NOT NULL,
  role                 TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'parent', 'college_admin', 'tech_admin')),
  must_change_password INTEGER NOT NULL DEFAULT 1,
  active               INTEGER NOT NULL DEFAULT 1,
  created_at           INTEGER NOT NULL
);

-- В cookie лежит случайный токен, в базе только его SHA-256
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE password_reset_requests (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  login  TEXT NOT NULL,
  at     INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done'))
);

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Журнал аудита: только добавление
CREATE TABLE audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  at         INTEGER NOT NULL,
  actor_id   TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  action     TEXT NOT NULL,
  entity     TEXT NOT NULL,
  entity_id  TEXT NOT NULL,
  before     TEXT,
  after      TEXT,
  reason     TEXT
);
CREATE INDEX audit_entity ON audit_log(entity, entity_id);

CREATE TRIGGER audit_log_no_update BEFORE UPDATE ON audit_log
BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;

CREATE TRIGGER audit_log_no_delete BEFORE DELETE ON audit_log
BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;
