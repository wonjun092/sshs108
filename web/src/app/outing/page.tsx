import { redirect } from "next/navigation";
import { OutingClient } from "@/components/OutingClient";
import { getSession } from "@/lib/auth";

export default async function OutingPage() {
  if (!(await getSession())) redirect("/login");
  return <OutingClient />;
}
