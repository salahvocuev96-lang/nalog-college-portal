import { currentUser, json, sessionPayload } from "@/server/http";

export async function GET() {
  const user = await currentUser();
  if (!user) return json({ user: null, snapshot: null });
  return json(sessionPayload(user));
}
