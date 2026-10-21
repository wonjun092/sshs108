import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { activeBaepoUser, baepoError, readHtmlUpload } from "@/lib/baepo-server";
import { requireSameOrigin, validateSlug } from "@/lib/baepo-policy";
import { HtmlDeployment } from "@/models/HtmlDeployment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await activeBaepoUser();
    const after = new URL(request.url).searchParams.get("after");
    const entries = await HtmlDeployment.find({
      ...(user.role === "admin" ? {} : { ownerId: user.userId }),
      ...(after ? { _id: { $gt: validateSlug(after, true) } } : {}),
    }).select("_id filename size revision createdAt updatedAt").sort({ _id: 1 }).limit(51).lean();
    return NextResponse.json({ entries: entries.slice(0, 50), next: entries.length > 50 ? entries[49]._id : null },
      { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return baepoError(error); }
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await activeBaepoUser();
    const { form, ...file } = await readHtmlUpload(request);
    const slug = validateSlug(form.get("slug"));
    await HtmlDeployment.create({ _id: slug, ownerId: user.userId, ...file, revision: randomUUID() });
    return NextResponse.json({ url: `/${slug}` }, { status: 201 });
  } catch (error) { return baepoError(error); }
}
