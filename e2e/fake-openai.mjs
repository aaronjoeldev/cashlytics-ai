// Stand-in for the OpenAI Responses API as used by @ai-sdk/openai:
// - streaming requests (chat assistant) answer by keyword and can call tools
// - non-streaming requests serve the receipt scanner (JSON object) and the CSV reconciliation
// Control endpoints for the tests: POST /__state (JSON merged into state), GET /__log, POST /__reset
import http from "node:http";

const ACCOUNT = "a0000000-0000-0000-0000-000000000001";
const SAVINGS = "a0000000-0000-0000-0000-000000000002";
const GROCERIES = "c0000000-0000-0000-0000-000000000002";

let state = { reweId: null, receipt: null, reconcileFail: false };
let log = [];
let failNext = 0;
let seq = 0;
const callNames = new Map();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function textOfInput(item) {
  if (typeof item.content === "string") return item.content;
  if (Array.isArray(item.content)) return item.content.map((c) => c.text ?? "").join("");
  return "";
}

function chatPlan(body) {
  const input = body.input ?? [];
  const last = input[input.length - 1] ?? {};
  if (last.type === "function_call_output") {
    const output = typeof last.output === "string" ? last.output : JSON.stringify(last.output);
    if (callNames.get(last.call_id) === "getDailyExpenses") {
      const count = (output.match(/\\?"description\\?"/g) ?? []).length;
      return { text: `Gefunden: ${count}` };
    }
    return { text: " Erledigt." };
  }
  const users = input.filter((i) => i.role === "user");
  const userText = textOfInput(users[users.length - 1] ?? {});
  if (userText.includes("buche REWE")) {
    return {
      text: "Ich buche das:",
      call: {
        name: "createDailyExpense",
        args: {
          accountId: ACCOUNT,
          categoryId: GROCERIES,
          description: "REWE",
          amount: 45,
          date: new Date().toISOString().slice(0, 10),
        },
      },
    };
  }
  if (userText.includes("lösche Rewe"))
    return { call: { name: "deleteDailyExpense", args: { id: state.reweId } } };
  if (userText.includes("ändere Betrag"))
    return { call: { name: "updateDailyExpense", args: { id: state.reweId, amount: 70 } } };
  if (userText.includes("transfer")) {
    return {
      call: {
        name: "createTransfer",
        args: {
          sourceAccountId: ACCOUNT,
          targetAccountId: SAVINGS,
          amount: 200,
          recurrenceType: "once",
          startDate: "2026-10-20",
        },
      },
    };
  }
  if (userText.includes("über 70"))
    return { call: { name: "getDailyExpenses", args: { minAmount: 70 } } };
  if (userText.includes("langsam")) return { text: "Das dauert etwas länger …", slow: true };
  return { text: `Antwort auf: ${userText}` };
}

/** Reconciliation: match a CSV row to an existing entry with the same amount whose description
 * shares the first word but is not identical (exact duplicates are found without AI). */
function reconcile(prompt) {
  const rowsJson = prompt.split("CSV rows:")[1].split("Existing transactions:")[0].trim();
  const existingJson = prompt.split("Existing transactions:")[1].trim();
  const rows = JSON.parse(rowsJson);
  const existing = JSON.parse(existingJson);
  const used = new Set();
  const decisions = rows.map((row) => {
    const first = String(row.description).toLowerCase().split(/\s+/)[0];
    const match = existing.find(
      (e) =>
        !used.has(e.transactionId) &&
        Math.abs(Math.abs(e.amount) - Math.abs(row.amount)) < 0.005 &&
        String(e.description).toLowerCase().split(/\s+/)[0] === first &&
        String(e.description).toLowerCase() !== String(row.description).toLowerCase()
    );
    if (match) {
      used.add(match.transactionId);
      return {
        csvRowId: row.csvRowId,
        action: "match_existing",
        matchedTransactionId: match.transactionId,
        confidence: 0.9,
        reason: "Same amount and merchant",
      };
    }
    return {
      csvRowId: row.csvRowId,
      action: "create_new",
      matchedTransactionId: null,
      confidence: 0.8,
      reason: "No similar entry",
    };
  });
  const matched = decisions.filter((d) => d.action === "match_existing").length;
  return {
    decisions,
    summary: {
      matchedCount: matched,
      createCount: decisions.length - matched,
      skipCount: 0,
      reviewCount: 0,
    },
  };
}

function nonStreamText(body) {
  const system =
    (body.input ?? [])
      .filter((i) => i.role === "system" || i.role === "developer")
      .map(textOfInput)
      .join("\n") + (body.instructions ?? "");
  const all = (body.input ?? []).map(textOfInput).join("\n");
  if (system.includes("Kassenbons") || all.includes("Kassenbon")) {
    return JSON.stringify(
      state.receipt ?? {
        merchant: "Bäckerei Krume",
        amount: 12.5,
        date: new Date().toISOString().slice(0, 10),
        currency: "EUR",
        description: "Brötchen und Kaffee",
        suggestedCategoryName: "Lebensmittel",
        confidence: "high",
      }
    );
  }
  if (all.includes("reconciliation engine")) {
    if (state.reconcileFail) throw new Error("reconcile disabled");
    return JSON.stringify(reconcile(all));
  }
  return "{}";
}

const server = http.createServer(async (req, res) => {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  if (req.url === "/__state") {
    state = { ...state, ...JSON.parse(raw || "{}") };
    res.end(JSON.stringify(state));
    return;
  }
  if (req.url === "/__log") {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(log));
    return;
  }
  if (req.url === "/__reset") {
    log = [];
    failNext = 0;
    state = { reweId: null, receipt: null, reconcileFail: false };
    res.end("ok");
    return;
  }

  const body = raw ? JSON.parse(raw) : {};
  log.push({ url: req.url, headers: req.headers, body });

  const users = (body.input ?? []).filter((i) => i.role === "user");
  const userText = textOfInput(users[users.length - 1] ?? {});
  if (userText.includes("fehler") && failNext < 3) {
    failNext += 1;
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: { message: "simulated failure", type: "server_error" } }));
    return;
  }

  const id = `resp_${++seq}`;
  const usage = {
    input_tokens: 10,
    output_tokens: 5,
    input_tokens_details: { cached_tokens: 0 },
    output_tokens_details: { reasoning_tokens: 0 },
  };

  if (!body.stream) {
    let text;
    try {
      text = nonStreamText(body);
    } catch (error) {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: { message: String(error), type: "server_error" } }));
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        id,
        object: "response",
        created_at: Math.floor(Date.now() / 1000),
        model: body.model ?? "gpt-4o",
        status: "completed",
        incomplete_details: null,
        output: [
          {
            type: "message",
            id: `msg_${seq}`,
            role: "assistant",
            status: "completed",
            content: [{ type: "output_text", text, annotations: [] }],
          },
        ],
        usage,
      })
    );
    return;
  }

  res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
  const send = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);
  send({
    type: "response.created",
    response: { id, created_at: Math.floor(Date.now() / 1000), model: "gpt-4o" },
  });

  const p = chatPlan(body);
  let index = 0;
  if (p.text) {
    const itemId = `msg_${seq}`;
    send({
      type: "response.output_item.added",
      output_index: index,
      item: { type: "message", id: itemId },
    });
    const pieces = p.slow ? p.text.split(" ") : [p.text];
    for (const piece of pieces) {
      send({
        type: "response.output_text.delta",
        item_id: itemId,
        output_index: index,
        delta: p.slow ? piece + " " : piece,
      });
      if (p.slow) await sleep(1500);
    }
    send({
      type: "response.output_item.done",
      output_index: index,
      item: { type: "message", id: itemId },
    });
    index += 1;
  }
  if (p.call) {
    const itemId = `fc_${seq}`;
    const callId = `call_${seq}`;
    callNames.set(callId, p.call.name);
    const args = JSON.stringify(p.call.args);
    send({
      type: "response.output_item.added",
      output_index: index,
      item: {
        type: "function_call",
        id: itemId,
        call_id: callId,
        name: p.call.name,
        arguments: "",
      },
    });
    send({
      type: "response.function_call_arguments.delta",
      item_id: itemId,
      output_index: index,
      delta: args,
    });
    send({
      type: "response.output_item.done",
      output_index: index,
      item: {
        type: "function_call",
        id: itemId,
        call_id: callId,
        name: p.call.name,
        arguments: args,
        status: "completed",
      },
    });
  }
  send({ type: "response.completed", response: { incomplete_details: null, usage } });
  res.end();
});

server.listen(4011, () => console.log("fake openai on 4011"));
