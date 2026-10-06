import { NextResponse } from "next/server";
import { apiError, requireApiKey } from "@/lib/api/auth";
import { UUID_RE, itemDetail } from "@/lib/api/items";
import { getCachedEtItem, getCachedEtReturns } from "@/lib/etData";

export const dynamic = "force-dynamic";

/** GET /api/v1/items/:id — full item detail, pipeline and tracking history. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiKey(request, "items:read");
  if (auth.response) return auth.response;

  const { id } = await params;
  if (!UUID_RE.test(id)) return apiError(400, "Item id must be a UUID.");

  try {
    const [item, returns] = await Promise.all([getCachedEtItem(id), getCachedEtReturns(id)]);
    if (!item) return apiError(404, "Item not found.");
    return NextResponse.json(itemDetail(item, returns));
  } catch (err) {
    console.error("GET /api/v1/items/[id] failed:", err);
    return apiError(500, "Failed to load item.");
  }
}
