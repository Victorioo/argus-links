import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { buildMcpServer } from "@/lib/mcp-reports";
import { authenticateBearer, corsPreflight, unauthorized, withCors } from "@/lib/oauth";

export const maxDuration = 60;

// Remote MCP endpoint (Streamable HTTP, stateless, JSON responses). Every
// request is authenticated with an OAuth access token and gets its own server
// bound to that person, so nothing is shared between users.
export async function POST(req: Request) {
  const user = await authenticateBearer(req);
  if (!user) return unauthorized();

  const server = buildMcpServer(user);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return withCors(await transport.handleRequest(req));
}

// No server-initiated stream or sessions: tell clients so (after the auth
// check, so an unauthenticated probe still discovers how to sign in).
async function notSupported(req: Request) {
  if (!(await authenticateBearer(req))) return unauthorized();
  return withCors(
    new Response(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed" }, id: null }), {
      status: 405,
      headers: { Allow: "POST, OPTIONS", "Content-Type": "application/json" },
    }),
  );
}

export const GET = notSupported;
export const DELETE = notSupported;

export function OPTIONS() {
  return corsPreflight();
}
