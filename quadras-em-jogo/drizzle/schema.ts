import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing the Manus OAuth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const courts = mysqlTable("courts", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 180 }).notNull(),
  city: varchar("city", { length: 120 }).notNull(),
  region: varchar("region", { length: 120 }).notNull(),
  address: text("address").notNull(),
  sportType: varchar("sportType", { length: 80 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", ["open", "closed", "playing"])
    .default("open")
    .notNull(),
  lastStatusUpdate: timestamp("lastStatusUpdate").defaultNow().notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const statusUpdates = mysqlTable("status_updates", {
  id: int("id").autoincrement().primaryKey(),
  courtId: int("courtId").notNull(),
  userId: int("userId").notNull(),
  status: mysqlEnum("status", ["open", "closed", "playing"]).notNull(),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Court = typeof courts.$inferSelect;
export type InsertCourt = typeof courts.$inferInsert;
export type StatusUpdate = typeof statusUpdates.$inferSelect;
export type InsertStatusUpdate = typeof statusUpdates.$inferInsert;
