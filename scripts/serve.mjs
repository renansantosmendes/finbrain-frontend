/*
 * Local server for the front end (npm run serve). It serves the static files
 * and forwards /agent/* to the FinBrain agent, the same way the rewrite in
 * vercel.json does in production, so the browser never needs CORS for the
 * agent. Uses only Node built-in modules.
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const AGENT_ORIGIN = "https://finbrain-agent.vercel.app";
const AGENT_PREFIX = "/agent";
const PORT = Number(process.env.PORT || 5500);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

/**
 * Map a request path to a file inside the project, refusing any path that
 * escapes the project root.
 *
 * Parameters
 * ----------
 * urlPath : string
 *     Path of the request, without query string (for example "/app/").
 *
 * Returns
 * -------
 * string | null
 *     Absolute file path, or null when the path is outside the project.
 *
 * Example
 * -------
 * >>> resolveStaticPath("/app/").endsWith(join("app", "index.html"))
 * true
 */
export function resolveStaticPath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const candidate = resolve(ROOT, "." + decoded);
  if (candidate !== ROOT && !candidate.startsWith(ROOT + sep)) return null;
  return candidate;
}

async function serveStatic(request, response, urlPath) {
  let file = resolveStaticPath(urlPath);
  if (file === null) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  try {
    const info = await stat(file);
    if (info.isDirectory()) file = join(file, "index.html");
    const body = await readFile(file);
    response.writeHead(200, { "Content-Type": TYPES[extname(file).toLowerCase()] || "application/octet-stream" });
    response.end(request.method === "HEAD" ? undefined : body);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
  }
}

async function forwardToAgent(request, response, urlPath) {
  const target = AGENT_ORIGIN + (urlPath.slice(AGENT_PREFIX.length) || "/");
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const headers = {};
  for (const name of ["content-type", "accept", "authorization"]) {
    if (request.headers[name]) headers[name] = request.headers[name];
  }
  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: chunks.length && request.method !== "GET" ? Buffer.concat(chunks) : undefined,
    });
    response.writeHead(upstream.status, {
      "Content-Type": upstream.headers.get("content-type") || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    if (upstream.body) {
      for await (const piece of upstream.body) response.write(piece);
    }
    response.end();
  } catch (error) {
    response.writeHead(502, { "Content-Type": "application/json; charset=utf-8" })
      .end(JSON.stringify({ code: "agent_unreachable", message: "Não foi possível alcançar o agente: " + error.message }));
  }
}

export function createDevServer() {
  return createServer((request, response) => {
    const urlPath = request.url.split("?")[0];
    if (urlPath === AGENT_PREFIX || urlPath.startsWith(AGENT_PREFIX + "/")) {
      forwardToAgent(request, response, urlPath);
      return;
    }
    serveStatic(request, response, urlPath);
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createDevServer().listen(PORT, () => {
    console.log(`FinBrain em http://localhost:${PORT}/app/ (agente em /agent -> ${AGENT_ORIGIN})`);
  });
}
