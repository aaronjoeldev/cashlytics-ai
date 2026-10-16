import { apiJson, withApiToken } from "@/lib/api/v1";
import { listActiveInsights } from "@/lib/services/insights";

function parseMetadata(metadata: string | null): unknown {
  if (!metadata) return null;
  try {
    return JSON.parse(metadata);
  } catch {
    return null;
  }
}

/** Unread, unexpired insights. Titles and messages are stored in German. */
export const GET = withApiToken("insights", async (_request, { userId }) => {
  const insights = await listActiveInsights(userId, 50);
  return apiJson({
    insights: insights.map((insight) => ({
      id: insight.id,
      type: insight.type,
      severity: insight.severity,
      title: insight.title,
      message: insight.message,
      metadata: parseMetadata(insight.metadata),
      createdAt: insight.createdAt.toISOString(),
      expiresAt: insight.expiresAt?.toISOString() ?? null,
    })),
  });
});
