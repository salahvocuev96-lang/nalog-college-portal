import { getContext } from "@/server/context";
import { currentUser, json, sessionPayload } from "@/server/http";

export async function GET() {
  const user = await currentUser();
  if (!user) return json({ user: null, snapshot: null });
  const c = await getContext();
  return json(sessionPayload(c, user));
}
