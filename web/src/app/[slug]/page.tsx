import Link from "next/link";
import { notFound } from "next/navigation";
import { connectDatabase } from "@/lib/db";
import { validateSlug } from "@/lib/baepo-policy";
import { HtmlDeployment } from "@/models/HtmlDeployment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = { title: "친구가 만든 HTML 페이지", robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try { validateSlug(slug); } catch { notFound(); }
  await connectDatabase();
  if (!await HtmlDeployment.exists({ _id: slug })) notFound();
  return <main className="baepo-viewer">
    <header><span>친구가 올린 페이지 · /{slug}</span><Link href="/baepo">업로드 관리</Link></header>
    <iframe title={`/${slug} HTML 페이지`} src={`/api/baepo/${slug}/content`}
      sandbox="allow-scripts" referrerPolicy="no-referrer" />
  </main>;
}
