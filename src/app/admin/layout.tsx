import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import { TeamOutlined, KeyOutlined } from "@ant-design/icons";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/client");

  return (
    <AppShell
      user={user}
      navItems={[
        { key: "users", label: "Quản lý người dùng", icon: <TeamOutlined />, href: "/admin/users" },
        { key: "keys", label: "Quản lý Private key", icon: <KeyOutlined />, href: "/admin/private-keys" },
      ]}
    >
      {children}
    </AppShell>
  );
}
