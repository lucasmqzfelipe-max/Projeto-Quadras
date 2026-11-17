import { and, desc, eq, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  courts,
  InsertCourt,
  InsertStatusUpdate,
  InsertUser,
  statusUpdates,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

type CourtFilters = {
  city?: string;
  region?: string;
  status?: "open" | "closed" | "playing";
  sportType?: string;
};

export async function listCourts(filters: CourtFilters = {}) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  const locationConditions = [];
  if (filters.city?.trim()) locationConditions.push(like(courts.city, `%${filters.city.trim()}%`));
  if (filters.region?.trim()) locationConditions.push(like(courts.region, `%${filters.region.trim()}%`));
  if (locationConditions.length) conditions.push(or(...locationConditions));


  return db
    .select()
    .from(courts)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(courts.lastStatusUpdate));
}

export async function createCourt(input: InsertCourt) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  const result = await db.insert(courts).values(input);
  const created = await db.select().from(courts).where(eq(courts.id, result[0].insertId)).limit(1);
  return created[0];
}

export async function updateCourtStatus(
  courtId: number,
  userId: number,
  status: "open" | "closed" | "playing",
  note?: string,
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  const updatedAt = new Date();
  await db
    .update(courts)
    .set({ status, lastStatusUpdate: updatedAt, updatedAt })
    .where(eq(courts.id, courtId));

  const update: InsertStatusUpdate = {
    courtId,
    userId,
    status,
    note: note?.trim() || null,
    createdAt: updatedAt,
  };
  await db.insert(statusUpdates).values(update);

  const result = await db.select().from(courts).where(eq(courts.id, courtId)).limit(1);
  return result[0];
}

export async function getCourtStatusHistory(courtId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(statusUpdates)
    .where(eq(statusUpdates.courtId, courtId))
    .orderBy(statusUpdates.createdAt);
}
