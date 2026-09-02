import { BoardScreen } from "@/components/BoardScreen";
export default function Page() {
  return (
    <BoardScreen
      board="anonymous"
      title="👻 익명 게시판"
      description="글과 댓글을 작성해도 다른 사용자에게는 익명으로 표시됩니다."
    />
  );
}
