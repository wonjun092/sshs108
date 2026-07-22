import { PostScreen } from "@/components/PostScreen";
export default async function Page({ params }: { params: Promise<{ id: string }> }) { return <PostScreen id={(await params).id} title="👻 익명 게시판" />; }
