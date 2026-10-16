"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const api = require("../app/core/api.js");

function streamOf(chunks) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
      controller.close();
    },
  });
}

function withFetch(stub, action) {
  const original = globalThis.fetch;
  globalThis.fetch = stub;
  return Promise.resolve()
    .then(action)
    .finally(() => {
      globalThis.fetch = original;
    });
}

test("parseSse reads complete frames and keeps a partial frame for later", () => {
  const first = api.parseSse('event: token\ndata: {"text": "Ol"}\n\nevent: tok');
  assert.deepEqual(first.events, [{ event: "token", data: { text: "Ol" } }]);
  assert.equal(first.rest, "event: tok");
  const second = api.parseSse(first.rest + 'en\ndata: {"text": "á"}\n\n');
  assert.deepEqual(second.events, [{ event: "token", data: { text: "á" } }]);
  assert.equal(second.rest, "");
});

test("agentStream hands every event to the callback and resolves with the done data", async () => {
  const seen = [];
  const chunks = [
    'event: tool\ndata: {"name": "get_quote", "status": "start"}\n\nevent: token\ndata: {"text": "Olá"',
    '}\n\nevent: token\ndata: {"text": ", PETR4"}\n\n',
    'event: done\ndata: {"session_id": "s1", "reply": "Olá, PETR4"}\n\n',
  ];
  const answer = await withFetch(
    (url, options) => {
      assert.equal(url, "/agent/chat/stream");
      assert.equal(JSON.parse(options.body).message, "oi");
      return Promise.resolve({ ok: true, status: 200, body: streamOf(chunks) });
    },
    () => api.agentStream("oi", "s1", (name, data) => seen.push([name, data]))
  );
  assert.deepEqual(answer, { session_id: "s1", reply: "Olá, PETR4" });
  assert.deepEqual(seen.map((item) => item[0]), ["tool", "token", "token", "done"]);
});

test("agentStream rejects with the server's error when the stream ends with an error event", async () => {
  const chunks = ['event: error\ndata: {"code": "agent_failed", "message": "falhou"}\n\n'];
  const failure = await withFetch(
    () => Promise.resolve({ ok: true, status: 200, body: streamOf(chunks) }),
    () => api.agentStream("oi", "s1", () => {}).then(() => null, (error) => error)
  );
  assert.equal(failure.code, "agent_failed");
  assert.equal(failure.message, "falhou");
});

test("agentStream rejects when the stream stops before a done event", async () => {
  const failure = await withFetch(
    () => Promise.resolve({ ok: true, status: 200, body: streamOf(['event: token\ndata: {"text": "x"}\n\n']) }),
    () => api.agentStream("oi", "s1", () => {}).then(() => null, (error) => error)
  );
  assert.equal(failure.code, "stream_incomplete");
});

test("agentStream rejects an HTTP error before reading anything", async () => {
  const failure = await withFetch(
    () => Promise.resolve({ ok: false, status: 503, body: null }),
    () => api.agentStream("oi", "s1", () => {}).then(() => null, (error) => error)
  );
  assert.equal(failure.status, 503);
});
