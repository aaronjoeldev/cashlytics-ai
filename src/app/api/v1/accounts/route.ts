import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { accounts } from "@/lib/db/schema";
import { toBaseCurrency } from "@/lib/currency";
import { safeParseFloat } from "@/lib/safe-parse";
import { apiJson, money, parseQuery, withApiToken } from "@/lib/api/v1";
import { computeAccountForecast } from "@/lib/services/forecast";
import { accountsQuery } from "@/lib/validations/api";

/**
 * All accounts with their balance (account currency and base currency) and a cashflow
 * projection for the next `forecastMonths` months in the base currency.
 */
export const GET = withApiToken("accounts", async (request, context) => {
  const query = parseQuery(request, accountsQuery);
  if (query.response) return query.response;
  const { forecastMonths } = query.data;

  const rows = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, context.userId))
    .orderBy(accounts.name);

  const forecasts = await Promise.all(
    rows.map((account) => computeAccountForecast(context, account, forecastMonths))
  );

  return apiJson({
    currency: context.baseCurrency,
    accounts: rows.map((account, i) => {
      const balance = safeParseFloat(account.balance);
      const forecast = forecasts[i];
      const last = forecast?.projectedMonths.at(-1);
      return {
        id: account.id,
        name: account.name,
        type: account.type,
        currency: account.currency,
        balance: money(balance),
        balanceInBaseCurrency: money(
          toBaseCurrency(balance, account.currency, context.baseCurrency, context.rates)
        ),
        createdAt: account.createdAt.toISOString(),
        forecast: forecast && {
          months: forecastMonths,
          // Savings and ETF accounts carry their balance forward; checking accounts only have a
          // net per month, so there is no projected balance for them
          isCumulative: forecast.isCumulativeAccount,
          projectedBalance:
            forecast.isCumulativeAccount && last ? money(last.cumulativeBalance) : null,
          monthly: forecast.projectedMonths.map((month) => ({
            year: month.year,
            month: month.month,
            income: money(month.income),
            expenses: money(month.expenses),
            transfersIn: money(month.transfersIn),
            transfersOut: money(month.transfersOut),
            net: money(month.balance),
            balance: forecast.isCumulativeAccount ? money(month.cumulativeBalance) : null,
          })),
        },
      };
    }),
  });
});
