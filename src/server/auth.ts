// Пароли, сессии и учётные записи
import "server-only";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { DB } from "@/lib/db-types";
import type { Account, ID, PasswordResetRequest, Role, SessionUser } from "@/lib/types";
import { DEMO_PASSWORD, DEMO_TEMP_PASSWORD, demoAccounts } from "./seed";
import { transaction } from "./sqlite";

export const SESSION_COOKIE = "nk_session";
export const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 часов

// ---------- Пароли (scrypt со случайной солью) ----------

const SCRYPT = { N: 16384, r: 8, p: 1 };

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32, SCRYPT);
  return ["scrypt", salt.toString("base64"), hash.toString("base64")].join("$");
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltB64, hashB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = scryptSync(password, Buffer.from(saltB64, "base64"), expected.length, SCRYPT);
  return timingSafeEqual(expected, actual);
}

/** Требования к новому паролю */
export function passwordProblem(p: string): string | null {
  if (p.length < 8) return "Пароль должен быть не короче 8 символов";
  if (!/[a-zа-яё]/i.test(p) || !/\d/.test(p)) return "Пароль должен содержать буквы и цифры";
  return null;
}

/** Временный пароль, который выдаёт администратор */
export function generateTempPassword(): string {
  const abc = "abcdefghjkmnpqrstuvwxyz23456789";
  const s = Array.from(randomBytes(10), (x) => abc[x % abc.length]).join("");
  return `${s.slice(0, 5)}-${s.slice(5)}`;
}

// ---------- Учётные записи ----------

interface UserRow {
  id: string;
  login: string;
  password_hash: string;
  role: Role;
  must_change_password: number;
  active: number;
  created_at: number;
}

export function seedAccounts(sql: DatabaseSync, db: DB) {
  const ins = sql.prepare("INSERT INTO users (id, login, password_hash, role, must_change_password, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)");
  transaction(sql, () => {
    for (const a of demoAccounts(db)) ins.run(a.id, a.login, hashPassword(a.temp ? DEMO_TEMP_PASSWORD : DEMO_PASSWORD), a.role, a.temp ? 1 : 0, Date.now());
  });
}

export function personName(db: DB, id: ID): string {
  return (
    db.students.find((x) => x.id === id)?.name ??
    db.teachers.find((x) => x.id === id)?.name ??
    db.parents.find((x) => x.id === id)?.name ??
    db.staff.find((x) => x.id === id)?.name ??
    id
  );
}

export function findUserByLogin(sql: DatabaseSync, login: string): UserRow | undefined {
  return sql.prepare("SELECT * FROM users WHERE login = ?").get(login.trim().toLowerCase()) as UserRow | undefined;
}

export function findUserById(sql: DatabaseSync, id: ID): UserRow | undefined {
  return sql.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
}

export function listAccounts(sql: DatabaseSync, db: DB): Account[] {
  return (sql.prepare("SELECT * FROM users ORDER BY created_at DESC").all() as unknown as UserRow[]).map((u) => ({
    id: u.id, login: u.login, role: u.role, name: personName(db, u.id), mustChangePassword: u.must_change_password === 1, active: u.active === 1, createdAt: u.created_at,
  }));
}

export function createAccount(sql: DatabaseSync, id: ID, login: string, role: Role): string {
  const temp = generateTempPassword();
  sql.prepare("INSERT INTO users (id, login, password_hash, role, must_change_password, active, created_at) VALUES (?, ?, ?, ?, 1, 1, ?)").run(id, login.trim().toLowerCase(), hashPassword(temp), role, Date.now());
  return temp;
}

export function resetPassword(sql: DatabaseSync, id: ID): string {
  const temp = generateTempPassword();
  sql.prepare("UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?").run(hashPassword(temp), id);
  sql.prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
  return temp;
}

export function setPassword(sql: DatabaseSync, id: ID, password: string) {
  sql.prepare("UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?").run(hashPassword(password), id);
}

export function setActive(sql: DatabaseSync, id: ID, active: boolean) {
  sql.prepare("UPDATE users SET active = ? WHERE id = ?").run(active ? 1 : 0, id);
  if (!active) sql.prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
}

// ---------- Сессии: в cookie случайный токен, в базе только его SHA-256 ----------

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export function createSession(sql: DatabaseSync, userId: ID): string {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  sql.prepare("DELETE FROM sessions WHERE expires_at < ?").run(now);
  sql.prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)").run(sha(token), userId, now, now + SESSION_TTL_MS);
  return token;
}

export function destroySession(sql: DatabaseSync, token: string) {
  sql.prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha(token));
}

export function userFromToken(sql: DatabaseSync, db: DB, token: string | undefined): SessionUser | null {
  if (!token) return null;
  const row = sql
    .prepare("SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1")
    .get(sha(token), Date.now()) as UserRow | undefined;
  if (!row) return null;
  const photo = (row as UserRow & { photo?: string | null }).photo ?? undefined;
  return { id: row.id, role: row.role, login: row.login, name: personName(db, row.id), mustChangePassword: row.must_change_password === 1, ...(photo ? { photo } : {}) };
}

// ---------- Защита от подбора пароля (в памяти процесса) ----------

const attempts = new Map<string, { n: number; until: number }>();
export function loginBlocked(login: string): number {
  const a = attempts.get(login);
  return a && a.until > Date.now() ? Math.ceil((a.until - Date.now()) / 1000) : 0;
}
export function registerFailure(login: string) {
  const a = attempts.get(login) ?? { n: 0, until: 0 };
  a.n++;
  if (a.n >= 5) {
    a.until = Date.now() + 60_000;
    a.n = 0;
  }
  attempts.set(login, a);
}
export const clearFailures = (login: string) => attempts.delete(login);

// ---------- Восстановление пароля: заявка уходит администрации ----------

export function createResetRequest(sql: DatabaseSync, login: string) {
  sql.prepare("INSERT INTO password_reset_requests (login, at) VALUES (?, ?)").run(login.trim().toLowerCase().slice(0, 64), Date.now());
}

export function listResetRequests(sql: DatabaseSync): PasswordResetRequest[] {
  return (sql.prepare("SELECT * FROM password_reset_requests ORDER BY id DESC LIMIT 50").all() as Record<string, unknown>[]).map((r) => ({
    id: Number(r.id), login: String(r.login), at: Number(r.at), status: String(r.status) as "open" | "done",
  }));
}

export function closeResetRequest(sql: DatabaseSync, id: number) {
  sql.prepare("UPDATE password_reset_requests SET status = 'done' WHERE id = ?").run(id);
}
