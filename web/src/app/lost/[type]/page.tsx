import { notFound } from "next/navigation";
import { BoardScreen } from "@/components/BoardScreen";
export default async function Page({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  if (type === "owner") return <BoardScreen board="lost-owner" title="🎒 주인을 찾습니다" description="습득한 물건의 주인을 찾는 게시판입니다. 습득 장소를 함께 선택해주세요." />;
  if (type === "item") return <BoardScreen board="lost-item" title="🔍 물건을 찾습니다" description="잃어버린 물건을 찾는 게시판입니다. 분실 장소를 함께 선택해주세요." />;
  notFound();
}
