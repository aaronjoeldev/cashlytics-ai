import { getAllRates } from "@/lib/exchange-rates";
import { logger } from "@/lib/logger";

// GET /api/exchange-rates — returns current rates (base = EUR), refreshes when cache is stale
export async function GET() {
  try {
    const rates = await getAllRates();
    return Response.json(rates);
  } catch (error) {
    logger.error("GET /api/exchange-rates failed", "GET /api/exchange-rates", error);
    return Response.json({ error: "Failed to fetch exchange rates" }, { status: 500 });
  }
}
