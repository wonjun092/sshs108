import { connectDatabase } from "@/lib/db";
import { BaepoError, HTML_HEADERS, validateSlug } from "@/lib/baepo-policy";
import { HtmlDeployment } from "@/models/HtmlDeployment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const slug = validateSlug((await params).slug);
    await connectDatabase();
    const entry = await HtmlDeployment.findById(slug).select("+html").lean();
    if (!entry) return new Response("페이지를 찾을 수 없습니다.", { status: 404, headers: HTML_HEADERS });
    return new Response(entry.html, { headers: HTML_HEADERS });
  } catch (error) {
    if (!(error instanceof BaepoError)) console.error("HTML page could not be loaded");
    return new Response("페이지를 불러올 수 없습니다.", { status: error instanceof BaepoError ? 404 : 503, headers: HTML_HEADERS });
  }
}
