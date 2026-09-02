import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LegacyShell } from "@/components/LegacyShell";
import { BoardClient } from "@/components/BoardClient";

export async function BoardScreen({
  board,
  title,
  description,
}: {
  board: "notice" | "free" | "anonymous" | "lost-owner" | "lost-item";
  title: string;
  description?: string;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "teacher" && (board === "free" || board === "anonymous"))
    redirect("/notice");
  const canWrite =
    board === "notice"
      ? session.role === "admin" || session.role === "teacher"
      : session.role !== "teacher" || board.startsWith("lost-");
  return (
    <LegacyShell user={session.loginId} role={session.role} title={title}>
      <BoardClient
        board={board}
        title={title}
        description={description}
        canWrite={canWrite}
      />
    </LegacyShell>
  );
}
