import { NextResponse } from "next/server";
import { SCOPE, corsPreflight, issuer, mcpUrl, withCors } from "@/lib/oauth";

// RFC 9728: tells MCP clients which authorization server protects the MCP
// endpoint. Also answers the path-suffixed variant (…/oauth-protected-resource/api/mcp).
export async function GET() {
  return withCors(
    NextResponse.json({
      resource: mcpUrl(),
      authorization_servers: [issuer()],
      bearer_methods_supported: ["header"],
      scopes_supported: [SCOPE],
      resource_name: "Report Hub",
    }),
  );
}

export function OPTIONS() {
  return corsPreflight();
}
