import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const selectMock = vi.fn();
const deleteMock = vi.fn();
const loggerErrorMock = vi.fn();

const documentsMock = {
  id: "documents.id",
  userId: "documents.userId",
};

vi.mock("@/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: loggerErrorMock,
  },
}));

vi.mock("@/lib/db/schema", () => ({
  documents: documentsMock,
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...parts: unknown[]) => ({ kind: "and", parts })),
  eq: vi.fn((left: unknown, right: unknown) => ({ kind: "eq", left, right })),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: selectMock,
    delete: deleteMock,
  },
}));

describe("documents [id] api authorization", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 when GET is unauthenticated", async () => {
    authMock.mockResolvedValue(null);

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/documents/doc-1"), {
      params: Promise.resolve({ id: "doc-1" }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(selectMock).not.toHaveBeenCalled();
  });

  it("returns 404 when GET document is not found for the authenticated user", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });

    const limitMock = vi.fn().mockResolvedValue([]);
    const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    selectMock.mockReturnValue({ from: fromMock });

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/documents/doc-missing"), {
      params: Promise.resolve({ id: "doc-missing" }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Dokument nicht gefunden" });
    expect(selectMock).toHaveBeenCalledTimes(1);
    expect(limitMock).toHaveBeenCalledWith(1);
  });

  it("returns the document payload for an authenticated owner", async () => {
    authMock.mockResolvedValue({ user: { id: "owner-1" } });

    const docContent = "owner document";
    const limitMock = vi.fn().mockResolvedValue([
      {
        data: Buffer.from(docContent).toString("base64"),
        mimeType: "text/plain",
        fileName: "owner.txt",
      },
    ]);
    const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    selectMock.mockReturnValue({ from: fromMock });

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/documents/doc-owner"), {
      params: Promise.resolve({ id: "doc-owner" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/plain");
    expect(response.headers.get("Content-Disposition")).toContain("owner.txt");
    const payload = Buffer.from(await response.arrayBuffer()).toString("utf8");
    expect(payload).toBe(docContent);
  });

  it("DELETE removes only owner-scoped document and returns 404 when not owned", async () => {
    authMock.mockResolvedValue({ user: { id: "owner-1" } });

    const returningMissingMock = vi.fn().mockResolvedValue([]);
    const whereMissingMock = vi.fn().mockReturnValue({ returning: returningMissingMock });
    deleteMock.mockReturnValueOnce({ where: whereMissingMock });

    const { DELETE } = await import("./route");
    const notOwnedResponse = await DELETE(
      new Request("http://localhost/api/documents/not-owned", { method: "DELETE" }),
      {
        params: Promise.resolve({ id: "not-owned" }),
      }
    );

    expect(notOwnedResponse.status).toBe(404);
    expect(await notOwnedResponse.json()).toEqual({ error: "Dokument nicht gefunden" });

    const returningDeletedMock = vi.fn().mockResolvedValue([{ id: "doc-owner" }]);
    const whereDeletedMock = vi.fn().mockReturnValue({ returning: returningDeletedMock });
    deleteMock.mockReturnValueOnce({ where: whereDeletedMock });

    const ownedResponse = await DELETE(
      new Request("http://localhost/api/documents/doc-owner", { method: "DELETE" }),
      {
        params: Promise.resolve({ id: "doc-owner" }),
      }
    );

    expect(ownedResponse.status).toBe(200);
    expect(await ownedResponse.json()).toEqual({ success: true });
    expect(deleteMock).toHaveBeenCalledTimes(2);
  });
});
