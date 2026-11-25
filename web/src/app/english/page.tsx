import { SharedSidebar } from "@/components/SharedSidebar";
import { getSession } from "@/lib/auth";
import EnglishQuiz from "./EnglishQuiz";

export default async function Page() {
  const session = await getSession();

  return (
    <EnglishQuiz
      isAuthenticated={session !== null}
      sidebar={<SharedSidebar role={session?.role ?? null} />}
    />
  );
}
