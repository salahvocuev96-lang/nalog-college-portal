// Пароли, сессии и учётные записи
import "server-only";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { Client } from "./turso";
import type { DB } from "@/lib/db-types";
import type { Account, ID, PasswordResetRequest, Role, SessionUser } from "@/lib/types";
import { DEMO_PASSWORD, DEMO_TEMP_PASSWORD, demoAccounts } from "./seed";

export const SESSION_COOKIE = "nk_session";
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 дней

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
  photo?: string | null;
}

function rowToUser(r: Record<string, unknown>): UserRow {
  return {
    id: String(r.id ?? ""),
    login: String(r.login ?? ""),
    password_hash: String(r.password_hash ?? ""),
    role: String(r.role ?? "") as Role,
    must_change_password: Number(r.must_change_password ?? 0),
    active: Number(r.active ?? 0),
    created_at: Number(r.created_at ?? 0),
    photo: r.photo != null ? String(r.photo) : null,
  };
}

export async function seedAccounts(client: Client, db: DB) {
  const stmts = demoAccounts(db).map((a) => ({
    sql: "INSERT INTO users (id, login, password_hash, role, must_change_password, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)",
    args: [a.id, a.login, hashPassword(a.temp ? DEMO_TEMP_PASSWORD : DEMO_PASSWORD), a.role, a.temp ? 1 : 0, Date.now()],
  }));
  for (const s of stmts) await client.execute(s);
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

export async function findUserByLogin(client: Client, login: string): Promise<UserRow | undefined> {
  const r = await client.execute({ sql: "SELECT * FROM users WHERE login = ?", args: [login.trim().toLowerCase()] });
  return r.rows[0] ? rowToUser(r.rows[0] as unknown as Record<string, unknown>) : undefined;
}

export async function findUserById(client: Client, id: ID): Promise<UserRow | undefined> {
  const r = await client.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [id] });
  return r.rows[0] ? rowToUser(r.rows[0] as unknown as Record<string, unknown>) : undefined;
}

export async function listAccounts(client: Client, db: DB): Promise<Account[]> {
  const r = await client.execute("SELECT * FROM users ORDER BY created_at DESC");
  return (r.rows as unknown as Record<string, unknown>[]).map((u) => {
    const row = rowToUser(u);
    return { id: row.id, login: row.login, role: row.role, name: personName(db, row.id), mustChangePassword: row.must_change_password === 1, active: row.active === 1, createdAt: row.created_at };
  });
}

export async function createAccount(client: Client, id: ID, login: string, role: Role): Promise<string> {
  const temp = generateTempPassword();
  await client.execute({ sql: "INSERT INTO users (id, login, password_hash, role, must_change_password, active, created_at) VALUES (?, ?, ?, ?, 1, 1, ?)", args: [id, login.trim().toLowerCase(), hashPassword(temp), role, Date.now()] });
  return temp;
}

export async function resetPassword(client: Client, id: ID): Promise<string> {
  const temp = generateTempPassword();
  await client.batch([
    { sql: "UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?", args: [hashPassword(temp), id] },
    { sql: "DELETE FROM sessions WHERE user_id = ?", args: [id] },
  ], "write");
  return temp;
}

export async function setPassword(client: Client, id: ID, password: string) {
  await client.execute({ sql: "UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?", args: [hashPassword(password), id] });
}

export async function setActive(client: Client, id: ID, active: boolean) {
  const stmts: { sql: string; args: unknown[] }[] = [
    { sql: "UPDATE users SET active = ? WHERE id = ?", args: [active ? 1 : 0, id] },
  ];
  if (!active) stmts.push({ sql: "DELETE FROM sessions WHERE user_id = ?", args: [id] });
  await client.batch(stmts as Parameters<typeof client.batch>[0], "write");
}

// ---------- Сессии ----------

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export async function createSession(client: Client, userId: ID): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  await client.batch([
    { sql: "DELETE FROM sessions WHERE expires_at < ?", args: [now] },
    { sql: "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)", args: [sha(token), userId, now, now + SESSION_TTL_MS] },
  ], "write");
  return token;
}

export async function destroySession(client: Client, token: string) {
  await client.execute({ sql: "DELETE FROM sessions WHERE token_hash = ?", args: [sha(token)] });
}

export async function userFromToken(client: Client, db: DB, token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const r = await client.execute({
    sql: "SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1",
    args: [sha(token), Date.now()],
  });
  if (!r.rows[0]) return null;
  const row = rowToUser(r.rows[0] as unknown as Record<string, unknown>);
  const photo = row.photo ?? undefined;
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
  if (a.n >= 5) { a.until = Date.now() + 60_000; a.n = 0; }
  attempts.set(login, a);
}
export const clearFailures = (login: string) => attempts.delete(login);

// ---------- Восстановление пароля ----------

export async function createResetRequest(client: Client, login: string) {
  await client.execute({ sql: "INSERT INTO password_reset_requests (login, at) VALUES (?, ?)", args: [login.trim().toLowerCase().slice(0, 64), Date.now()] });
}

export async function listResetRequests(client: Client): Promise<PasswordResetRequest[]> {
  const r = await client.execute("SELECT * FROM password_reset_requests ORDER BY id DESC LIMIT 50");
  return (r.rows as unknown as Record<string, unknown>[]).map((row) => ({
    id: Number(row.id), login: String(row.login), at: Number(row.at), status: String(row.status) as "open" | "done",
  }));
}

export async function closeResetRequest(client: Client, id: number) {
  await client.execute({ sql: "UPDATE password_reset_requests SET status = 'done' WHERE id = ?", args: [id] });
}
