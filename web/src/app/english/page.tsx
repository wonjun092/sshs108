import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { SharedSidebar } from "@/components/SharedSidebar";

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="standalone-quiz-page">
      <SharedSidebar
        role={session.role}
        triggerClassName="hamburger standalone-quiz-menu"
      />
      <iframe
        className="legacy-frame"
        title="영어 단어 시험"
        src="/legacy/english.html"
      />
    </div>
  );
}
