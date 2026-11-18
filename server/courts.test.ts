import { describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({
  listCourts: vi.fn(async () => []),
  getCourtStatusHistory: vi.fn(async () => []),
  createCourt: vi.fn(async (input: Record<string, unknown>) => ({ id: 101, ...input })),
  updateCourtStatus: vi.fn(async (courtId: number, _userId: number, status: string, note?: string) => ({
    id: courtId,
    status,
    note,
  })),
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createContext(user: TrpcContext["user"] = null): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const authenticatedUser: NonNullable<TrpcContext["user"]> = {
  id: 42,
  openId: "test-user",
  name: "Jogador Teste",
  email: "jogador@example.com",
  loginMethod: "manus",
  role: "user",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

describe("courts router", () => {
  it("returns a public list without requiring authentication", async () => {
    const caller = appRouter.createCaller(createContext());
    const result = await caller.courts.list({ city: "São Paulo", status: "open" });

    expect(Array.isArray(result)).toBe(true);
  });

  it("blocks court creation for unauthenticated visitors", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(
      caller.courts.create({
        name: "Quadra de teste",
        city: "São Paulo",
        region: "SP",
        address: "Rua de teste, 100",
        sportType: "Futebol",
        status: "open",
      }),
    ).rejects.toThrow("Please login");
  });

  it("creates a court after an authenticated submission", async () => {
    const caller = appRouter.createCaller(createContext(authenticatedUser));
    const result = await caller.courts.create({
      name: "Quadra do Parque",
      city: "São Paulo",
      region: "SP",
      address: "Rua das Flores, 100",
      sportType: "Futebol",
      status: "open",
    });

    expect(result).toMatchObject({ id: 101, name: "Quadra do Parque", createdBy: 42, status: "open" });
  });

  it("updates the status and preserves the collaboration note", async () => {
    const caller = appRouter.createCaller(createContext(authenticatedUser));
    const result = await caller.courts.updateStatus({
      courtId: 101,
      status: "playing",
      note: "Jogo começando às 19h",
    });

    expect(result).toEqual({ id: 101, status: "playing", note: "Jogo começando às 19h" });
  });

  it("validates authenticated court submissions before persistence", async () => {
    const caller = appRouter.createCaller(createContext(authenticatedUser));

    await expect(
      caller.courts.create({
        name: "x",
        city: "",
        region: "SP",
        address: "Rua",
        sportType: "Futebol",
        status: "open",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("blocks status updates for unauthenticated visitors", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(
      caller.courts.updateStatus({ courtId: 101, status: "closed" }),
    ).rejects.toThrow("Please login");
  });
});
