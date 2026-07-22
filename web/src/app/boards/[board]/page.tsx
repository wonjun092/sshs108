import { redirect } from "next/navigation";

export default async function Page({ params }: { params: Promise<{ board: string }> }) {
  const { board } = await params;
  const paths: Record<string, string> = {
    notice: "/notice",
    free: "/free",
    anonymous: "/anonymous",
    "lost-owner": "/lost/owner",
    "lost-item": "/lost/item",
  };
  redirect(paths[board] ?? "/notice");
}
