// Единственный экземпляр базы на процесс сервера
import "server-only";
import path from "node:path";
import { openDatabase } from "./sqlite";
import { insertAll, isEmpty, loadDB, type Ctx } from "./repo";
import { buildSeed } from "./seed";
import { seedAccounts } from "./auth";

const g = globalThis as unknown as { __nkCtx?: Ctx };

export function createContext(file: string): Ctx {
  const sql = openDatabase(file);
  if (isEmpty(sql)) {
    const seed = buildSeed();
    insertAll(sql, seed);
    seedAccounts(sql, seed);
  }
  return { sql, db: loadDB(sql) };
}

export function getContext(): Ctx {
  if (!g.__nkCtx) g.__nkCtx = createContext(dbPath());
  return g.__nkCtx;
}

export const dbPath = () => process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "portal.db");

/** Демо-режим: быстрый вход по ролям и сброс данных. В эксплуатации выключается DEMO_MODE=false */
export const isDemoMode = () => process.env.DEMO_MODE !== "false";
