import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { activeBaepoUser, baepoError, readHtmlUpload, revisionFrom } from "@/lib/baepo-server";
import { BaepoError, requireSameOrigin, validateSlug } from "@/lib/baepo-policy";
import { HtmlDeployment } from "@/models/HtmlDeployment";

export const runtime = "nodejs";
type Context = { params: Promise<{ slug: string }> };

async function mutate(request: Request, context: Context, remove: boolean) {
  try {
    requireSameOrigin(request);
    const user = await activeBaepoUser();
    const slug = (await context.params).slug;
    // Deletion remains possible if a later app release reserves this slug.
    validateSlug(slug, remove);
    const revision = revisionFrom(request);
    const ownership = user.role === "admin" ? {} : { ownerId: user.userId };
    const current = await HtmlDeployment.findOne({ _id: slug, ...ownership }).select("_id").lean();
    if (!current) throw new BaepoError(404, "페이지가 없거나 관리 권한이 없습니다.");
    const filter = { _id: slug, ...ownership, revision };
    if (remove) {
      const result = await HtmlDeployment.deleteOne(filter);
      if (!result.deletedCount) throw new BaepoError(409, "페이지가 변경되었습니다. 목록을 새로고침해주세요.");
    } else {
      const { html, filename, size } = await readHtmlUpload(request);
      const result = await HtmlDeployment.updateOne(filter, { $set: { html, filename, size, revision: randomUUID() } }, { runValidators: true });
      if (!result.matchedCount) throw new BaepoError(409, "페이지가 변경되었습니다. 목록을 새로고침해주세요.");
    }
    return NextResponse.json({ ok: true });
  } catch (error) { return baepoError(error); }
}

export function PUT(request: Request, context: Context) { return mutate(request, context, false); }
export function DELETE(request: Request, context: Context) { return mutate(request, context, true); }
