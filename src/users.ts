export async function upsertUser(db: D1Database, googleSub: string, email: string): Promise<number> {
  const row = await db
    .prepare(
      `INSERT INTO users (google_sub, email, created_at) VALUES (?, ?, ?)
       ON CONFLICT (google_sub) DO UPDATE SET email = excluded.email
       RETURNING id`,
    )
    .bind(googleSub, email, new Date().toISOString())
    .first<{ id: number }>();
  return row!.id;
}

/** The email a user signed in with, for showing on their profile. */
export async function getUserEmail(db: D1Database, userId: number): Promise<string | null> {
  const row = await db.prepare("SELECT email FROM users WHERE id = ?").bind(userId).first<{ email: string }>();
  return row?.email ?? null;
}
