import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LegacyShell } from "@/components/LegacyShell";
import { PostDetailClient } from "@/components/PostDetailClient";

export async function PostScreen({ id, title }: { id: string; title: string }) {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <LegacyShell user={session.loginId} role={session.role} title={title}>
      <PostDetailClient id={id} />
    </LegacyShell>
  );
}
