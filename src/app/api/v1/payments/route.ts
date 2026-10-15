import { apiJson, calendarDay, money, parseQuery, withApiToken } from "@/lib/api/v1";
import { listScheduledPayments } from "@/lib/services/analytics";
import { paymentsQuery } from "@/lib/validations/api";

/**
 * Every due date of expenses, daily expenses and incomes between `start` and `end`
 * (YYYY-MM-DD, inclusive, at most 366 days). Feeds calendar views.
 */
export const GET = withApiToken("payments", async (request, context) => {
  const query = parseQuery(request, paymentsQuery);
  if (query.response) return query.response;
  const { start, end } = query.data;

  const payments = await listScheduledPayments(context, start, end);
  return apiJson({
    currency: context.baseCurrency,
    start: calendarDay(start),
    end: calendarDay(end),
    payments: payments.map((payment) => ({
      id: payment.id,
      type: payment.type,
      name: payment.name,
      date: calendarDay(payment.date),
      amount: money(payment.amount),
      originalAmount: money(payment.originalAmount),
      originalCurrency: payment.currency,
      accountId: payment.accountId,
      category: payment.category,
      isSubscription: payment.isSubscription,
    })),
  });
});
