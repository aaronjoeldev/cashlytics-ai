import assert from "node:assert/strict";
import test from "node:test";
import { validateAdminServiceKey } from "../../../lib/admin/auth.ts";

const ADMIN_KEY = "svc_test_key";

function buildRequest(url, options = {}) {
  return new Request(url, options);
}

async function importRoute(relativePath) {
  return import(new URL(`${relativePath}?t=${Date.now()}-${Math.random()}`, import.meta.url).href);
}

test("validateAdminServiceKey enforces service key for authorized and unauthorized requests", () => {
  process.env.ADMIN_SERVICE_KEY = ADMIN_KEY;

  const unauthorized = validateAdminServiceKey(buildRequest("http://localhost/api/admin/users"));
  assert.deepEqual(unauthorized, { valid: false, status: 401, error: "Unauthorized" });

  const wrongKey = validateAdminServiceKey(
    buildRequest("http://localhost/api/admin/users", {
      headers: { "x-admin-service-key": "wrong" },
    })
  );
  assert.deepEqual(wrongKey, { valid: false, status: 401, error: "Unauthorized" });

  const authorized = validateAdminServiceKey(
    buildRequest("http://localhost/api/admin/users", {
      headers: { "x-admin-service-key": ADMIN_KEY },
    })
  );
  assert.deepEqual(authorized, { valid: true });
});

test("GET /api/admin/users returns stable payload contract for list endpoint", async (t) => {
  t.mock.module("@/lib/admin/auth", {
    namedExports: {
      validateAdminServiceKey: () => ({ valid: true }),
    },
  });

  t.mock.module("@/lib/admin/users", {
    namedExports: {
      parseAdminUsersListQuery: () => ({
        success: true,
        data: { plan: "all", status: "all", sort: "recent_activity", limit: 25 },
      }),
      listAdminUsers: async () => ({
        ok: true,
        data: {
          items: [
            {
              id: "d915d5f4-08ea-4319-b6ed-fd79f5f8bf20",
              email: "admin.contract@example.com",
              name: "Admin Contract",
              planCode: "pro",
              status: "active",
              trialEndsAt: null,
              aiCostUsedEur: 1.25,
              aiCostLimitEur: 10,
              lastActiveAt: "2026-03-01T12:00:00.000Z",
            },
          ],
          total: 1,
          nextCursor: null,
        },
      }),
    },
  });

  t.mock.module("@/lib/logger", {
    namedExports: {
      logger: { error: () => {} },
    },
  });

  const { GET } = await importRoute("./users/route.ts");
  const response = await GET(buildRequest("http://localhost/api/admin/users"));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.ok(Array.isArray(body.items));
  assert.equal(typeof body.total, "number");
  assert.ok(body.nextCursor === null || typeof body.nextCursor === "string");
  assert.equal(typeof body.items[0].id, "string");
  assert.equal(typeof body.items[0].email, "string");
  assert.equal(typeof body.items[0].planCode, "string");
  assert.equal(typeof body.items[0].status, "string");
  assert.equal(typeof body.items[0].aiCostUsedEur, "number");
  assert.equal(typeof body.items[0].lastActiveAt, "string");
});

test("GET /api/admin/users/:id returns stable payload contract for detail endpoint", async (t) => {
  t.mock.module("@/lib/admin/auth", {
    namedExports: {
      validateAdminServiceKey: () => ({ valid: true }),
    },
  });

  t.mock.module("@/lib/admin/users", {
    namedExports: {
      userIdParamSchema: {
        safeParse: () => ({
          success: true,
          data: { id: "7d6004f0-6108-4548-9b4a-6e0d89f6d84f" },
        }),
      },
      getAdminUserDetail: async () => ({
        id: "7d6004f0-6108-4548-9b4a-6e0d89f6d84f",
        email: "detail.contract@example.com",
        name: "Detail Contract",
        createdAt: "2026-02-01T10:00:00.000Z",
        billing: {
          planCode: "pro",
          interval: "month",
          status: "active",
          trialEndsAt: null,
        },
        entitlement: {
          aiEnabled: true,
          aiCostUsedEur: 2.5,
          aiCostLimitEur: 25,
          reason: "none",
        },
        dbFootprint: {
          transactionsCount: 20,
          categoriesCount: 8,
          budgetsCount: 0,
          attachmentsCount: 5,
          estimatedStorageMb: 1.72,
        },
      }),
    },
  });

  t.mock.module("@/lib/logger", {
    namedExports: {
      logger: { error: () => {} },
    },
  });

  const { GET } = await importRoute("./users/[id]/route.ts");
  const response = await GET(buildRequest("http://localhost/api/admin/users/user-id"), {
    params: Promise.resolve({ id: "7d6004f0-6108-4548-9b4a-6e0d89f6d84f" }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(typeof body.id, "string");
  assert.equal(typeof body.email, "string");
  assert.equal(typeof body.createdAt, "string");
  assert.equal(typeof body.billing.planCode, "string");
  assert.equal(typeof body.billing.status, "string");
  assert.equal(typeof body.entitlement.aiEnabled, "boolean");
  assert.equal(typeof body.entitlement.aiCostUsedEur, "number");
  assert.equal(typeof body.dbFootprint.transactionsCount, "number");
  assert.equal(typeof body.dbFootprint.estimatedStorageMb, "number");
});

test("GET /api/admin/users/:id/usage returns stable payload contract for usage endpoint", async (t) => {
  t.mock.module("@/lib/admin/auth", {
    namedExports: {
      validateAdminServiceKey: () => ({ valid: true }),
    },
  });

  t.mock.module("@/lib/admin/users", {
    namedExports: {
      userIdParamSchema: {
        safeParse: () => ({
          success: true,
          data: { id: "6f7a9a03-a3f9-48d2-a9fc-98420b32cd7c" },
        }),
      },
      parseAdminUsageQuery: () => ({ success: true, data: {} }),
      getAdminUserUsage: async () => ({
        ok: true,
        data: {
          userId: "6f7a9a03-a3f9-48d2-a9fc-98420b32cd7c",
          from: "2026-02-01T00:00:00.000Z",
          to: "2026-03-01T23:59:59.999Z",
          totals: {
            prompts: 99,
            aiCostEur: 4.216,
          },
          timeline: [
            {
              day: "2026-03-01",
              prompts: 3,
              aiCostEur: 0.12,
            },
          ],
        },
      }),
    },
  });

  t.mock.module("@/lib/logger", {
    namedExports: {
      logger: { error: () => {} },
    },
  });

  const { GET } = await importRoute("./users/[id]/usage/route.ts");
  const response = await GET(buildRequest("http://localhost/api/admin/users/user-id/usage"), {
    params: Promise.resolve({ id: "6f7a9a03-a3f9-48d2-a9fc-98420b32cd7c" }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(typeof body.userId, "string");
  assert.equal(typeof body.from, "string");
  assert.equal(typeof body.to, "string");
  assert.equal(typeof body.totals.prompts, "number");
  assert.equal(typeof body.totals.aiCostEur, "number");
  assert.ok(Array.isArray(body.timeline));
  assert.equal(typeof body.timeline[0].day, "string");
  assert.equal(typeof body.timeline[0].prompts, "number");
  assert.equal(typeof body.timeline[0].aiCostEur, "number");
});

test("GET and POST /api/admin/users/:id/overrides enforce auth and stable payload contracts", async (t) => {
  const authState = { allow: false };

  t.mock.module("@/lib/admin/auth", {
    namedExports: {
      validateAdminServiceKey: () =>
        authState.allow ? { valid: true } : { valid: false, status: 401, error: "Unauthorized" },
      resolveAdminActor: () => "admin-test",
    },
  });

  t.mock.module("@/lib/admin/overrides", {
    namedExports: {
      userIdParamSchema: {
        safeParse: () => ({
          success: true,
          data: { id: "ecf75895-b451-4250-89d3-b3be5f7ec2a8" },
        }),
      },
      adminOverrideSchema: {
        safeParse: () => ({
          success: true,
          data: {
            action: "adjust_ai_cap",
            aiHardCapEur: 30,
            reason: "Increase cap for support investigation",
          },
        }),
      },
      ensureUserExists: async () => true,
      getAdminOverrideTimeline: async () => [
        {
          id: "1f3cc5cc-85f5-45aa-b86d-31725f49708b",
          actor: "admin-test",
          reason: "Increase cap for support investigation",
          actionType: "adjust_ai_cap",
          beforeSnapshot: { entitlement: { aiHardCapEur: "10.00" } },
          afterSnapshot: { entitlement: { aiHardCapEur: "30.00" } },
          createdAt: "2026-03-01T10:00:00.000Z",
        },
      ],
      applyAdminOverride: async () => ({
        ok: true,
        data: {
          userId: "ecf75895-b451-4250-89d3-b3be5f7ec2a8",
          action: "adjust_ai_cap",
          entitlement: {
            planCode: "pro",
            status: "active",
            aiEnabled: true,
            aiHardCapEur: "30.00",
            trialEndsAt: null,
            aiBlockedReason: null,
            updatedAt: "2026-03-01T10:00:00.000Z",
          },
        },
      }),
    },
  });

  t.mock.module("@/lib/logger", {
    namedExports: {
      logger: { error: () => {} },
    },
  });

  const { GET, POST } = await importRoute("./users/[id]/overrides/route.ts");

  const unauthorizedGet = await GET(
    buildRequest("http://localhost/api/admin/users/ecf75895-b451-4250-89d3-b3be5f7ec2a8/overrides"),
    { params: Promise.resolve({ id: "ecf75895-b451-4250-89d3-b3be5f7ec2a8" }) }
  );
  assert.equal(unauthorizedGet.status, 401);

  authState.allow = true;

  const authorizedGet = await GET(
    buildRequest("http://localhost/api/admin/users/ecf75895-b451-4250-89d3-b3be5f7ec2a8/overrides"),
    { params: Promise.resolve({ id: "ecf75895-b451-4250-89d3-b3be5f7ec2a8" }) }
  );
  const getBody = await authorizedGet.json();

  assert.equal(authorizedGet.status, 200);
  assert.equal(typeof getBody.userId, "string");
  assert.ok(Array.isArray(getBody.entries));
  assert.equal(typeof getBody.entries[0].id, "string");
  assert.equal(typeof getBody.entries[0].actionType, "string");
  assert.equal(typeof getBody.entries[0].createdAt, "string");

  const authorizedPost = await POST(
    buildRequest(
      "http://localhost/api/admin/users/ecf75895-b451-4250-89d3-b3be5f7ec2a8/overrides",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "adjust_ai_cap",
          aiHardCapEur: 30,
          reason: "Increase cap for support investigation",
        }),
      }
    ),
    { params: Promise.resolve({ id: "ecf75895-b451-4250-89d3-b3be5f7ec2a8" }) }
  );
  const postBody = await authorizedPost.json();

  assert.equal(authorizedPost.status, 200);
  assert.equal(typeof postBody.userId, "string");
  assert.equal(typeof postBody.action, "string");
  assert.equal(typeof postBody.entitlement.aiEnabled, "boolean");
  assert.equal(typeof postBody.entitlement.aiHardCapEur, "string");
});
