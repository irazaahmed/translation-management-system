import { NextResponse } from "next/server";
import { buildOpenApiSpec } from "@/lib/api/openapi";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/openapi.json — machine-readable description of the whole API.
 * Public (no key): it holds only endpoint and field names, no data, the same
 * as API_DOCS.md in the repo.
 */
export function GET(request: Request) {
  return NextResponse.json(buildOpenApiSpec(new URL(request.url).origin), {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
