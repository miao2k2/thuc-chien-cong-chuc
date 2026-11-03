import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import {
  FileTextOutlined,
  HomeOutlined,
  HistoryOutlined,
  BookOutlined,
  PlusCircleOutlined,
} from "@ant-design/icons";

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <AppShell
      user={user}
      navItems={[
        { key: "home", label: "Trang chủ", icon: <HomeOutlined />, href: "/client" },
        { key: "questions", label: "Danh sách câu hỏi", icon: <BookOutlined />, href: "/client/questions" },
        { key: "exams", label: "Bài thi có sẵn", icon: <FileTextOutlined />, href: "/client/exams" },
        { key: "create", label: "Tạo bài thi", icon: <PlusCircleOutlined />, href: "/client/create" },
        { key: "history", label: "Lịch sử làm bài", icon: <HistoryOutlined />, href: "/client/history" },
      ]}
    >
      {children}
    </AppShell>
  );
}
