import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LegacyShell } from "@/components/LegacyShell";

export async function QuizScreen({ title, src }: { title: string; src: string }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <LegacyShell user={session.loginId} role={session.role} title={title}>
      <iframe className="legacy-frame embedded-quiz-frame" title={title} src={src} />
    </LegacyShell>
  );
}
