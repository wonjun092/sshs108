import { PostScreen } from "@/components/PostScreen";
export default async function Page({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  const { type, id } = await params;
  return (
    <PostScreen
      id={id}
      title={type === "owner" ? "🎒 주인을 찾습니다" : "🔍 물건을 찾습니다"}
    />
  );
}
