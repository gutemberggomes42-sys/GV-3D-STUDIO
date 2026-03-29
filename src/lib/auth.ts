import { UserRole } from "@prisma/client";
import { addDays } from "date-fns";
import { compare, hash } from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import type { DbUser } from "@/lib/db-types";
import { createId, readDb, updateDb } from "@/lib/store";

const SESSION_COOKIE = "printflow_session";

export type SessionUser = Omit<DbUser, "passwordHash">;

export async function hashPassword(password: string) {
  return hash(password, 10);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return compare(password, passwordHash);
}

export async function createUserSession(userId: string) {
  const token = randomUUID();
  const expiresAt = addDays(new Date(), 7);
  const cookieStore = await cookies();
  const currentToken = cookieStore.get(SESSION_COOKIE)?.value;
  await updateDb((db) => {
    db.sessions = db.sessions.filter((session) => session.token !== currentToken);
    db.sessions.push({
      id: createId("ses"),
      token,
      userId,
      expiresAt: expiresAt.toISOString(),
      createdAt: new Date().toISOString(),
    });
  });

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  await updateDb((db) => {
    db.sessions = db.sessions.filter((session) => session.token !== token);
  });

  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const db = await readDb();
  const session = db.sessions.find((item) => item.token === token);

  if (!session || new Date(session.expiresAt) < new Date()) {
    return null;
  }

  const user = db.users.find((item) => item.id === session.userId);

  if (!user) {
    return null;
  }

  const { passwordHash, ...sessionUser } = user;
  void passwordHash;
  return sessionUser;
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/acesso");
  }

  return user;
}

export async function requireRoles(roles: UserRole[]) {
  const user = await requireUser();

  if (!roles.includes(user.role)) {
    redirect(user.role === UserRole.CLIENT ? "/portal" : "/");
  }

  return user;
}
