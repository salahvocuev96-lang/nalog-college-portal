// Единственный экземпляр клиента и базы на процесс сервера
import "server-only";
import { getTursoClient, migrate } from "./turso";
import { insertAll, isEmpty, loadDB, type Ctx } from "./repo";
import { buildSeed } from "./seed";
import { seedAccounts } from "./auth";

const g = globalThis as unknown as { __nkCtx?: Promise<Ctx> };

export async function createContext(): Promise<Ctx> {
  const client = getTursoClient();
  await migrate(client);
  const db = await (async () => {
    if (await isEmpty(client)) {
      const seed = buildSeed();
      await insertAll(client, seed);
      await seedAccounts(client, seed);
    }
    return loadDB(client);
  })();
  return { client, db };
}

export function getContext(): Promise<Ctx> {
  if (!g.__nkCtx) g.__nkCtx = createContext();
  return g.__nkCtx;
}

/** Демо-режим: быстрый вход по ролям и сброс данных. В эксплуатации выключается DEMO_MODE=false */
export const isDemoMode = () => process.env.DEMO_MODE !== "false";
