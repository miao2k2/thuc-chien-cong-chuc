import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import {
  FolderOutlined,
  BookOutlined,
  FileTextOutlined,
  TagsOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";

export default async function ManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "MANAGER" && user.role !== "ADMIN") redirect("/client");

  return (
    <AppShell
      user={user}
      navItems={[
        {
          key: "folders",
          label: "Quản lý thư mục",
          icon: <FolderOutlined />,
          href: "/manager/folders",
        },
        {
          key: "categories",
          label: "Danh mục",
          icon: <TagsOutlined />,
          href: "/manager/category-roles",
        },
        {
          key: "questions",
          label: "Ngân hàng câu hỏi",
          icon: <QuestionCircleOutlined />,
          href: "/manager/questions",
        },
        {
          key: "exams",
          label: "Quản lý bài thi",
          icon: <FileTextOutlined />,
          href: "/manager/exams",
        },
      ]}
    >
      {children}
    </AppShell>
  );
}
