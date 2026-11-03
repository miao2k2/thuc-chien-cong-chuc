"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Layout, Menu, Button, Space, Avatar, Dropdown, Tag, Grid } from "antd";
import {
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  HomeOutlined,
} from "@ant-design/icons";
import { ROLE_LABEL, type UserRole } from "@/types/auth";

const { Header, Sider, Content } = Layout;

export type NavItem = {
  key: string;
  label: string;
  icon?: React.ReactNode;
  href: string;
};

export default function AppShell({
  user,
  navItems,
  children,
}: {
  user: { email: string; fullName: string | null; role: UserRole };
  navItems: NavItem[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.lg;
  const [collapsed, setCollapsed] = useState(isMobile);

  useEffect(() => {
    setCollapsed(isMobile);
  }, [isMobile]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const selectedKey =
    navItems
      .slice()
      .reverse()
      .find((i) => pathname === i.href || pathname.startsWith(i.href + "/"))?.key ??
    navItems[0]?.key;

  const menuItems = navItems.map((item) => ({
    key: item.key,
    icon: item.icon,
    label: <Link href={item.href}>{item.label}</Link>,
  }));

  return (
    <Layout style={{ minHeight: "100vh" }}>
      {!isMobile && (
        <Sider collapsible collapsed={collapsed} trigger={null} width={230}>
          <div
            style={{
              height: 64,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontWeight: 700,
              fontSize: collapsed ? 14 : 16,
            }}
          >
            {collapsed ? "TCCC" : "Thi kiểm tra"}
          </div>
          <Menu theme="dark" mode="inline" selectedKeys={[selectedKey]} items={menuItems} />
        </Sider>
      )}

      <Layout>
        <Header className="site-header" style={{ padding: "0 16px" }}>
          <Space>
            {isMobile && (
              <Button
                type="text"
                icon={<MenuUnfoldOutlined />}
                style={{ color: "#fff" }}
                onClick={() => setCollapsed(!collapsed)}
              />
            )}
            {!isMobile && (
              <Button
                type="text"
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                style={{ color: "#fff" }}
                onClick={() => setCollapsed(!collapsed)}
              />
            )}
            <Link href="/" style={{ color: "#fff", fontWeight: 700 }}>
              <HomeOutlined /> Hệ thống Thi kiểm tra
            </Link>
          </Space>

          <Dropdown
            menu={{
              items: [
                {
                  key: "info",
                  label: (
                    <div style={{ padding: "4px 0" }}>
                      <div>
                        <b>{user.fullName || user.email}</b>
                      </div>
                      <div style={{ fontSize: 12, color: "#888" }}>{user.email}</div>
                    </div>
                  ),
                  disabled: true,
                },
                { type: "divider" },
                {
                  key: "logout",
                  icon: <LogoutOutlined />,
                  label: "Đăng xuất",
                  onClick: logout,
                },
              ],
            }}
          >
            <Space style={{ cursor: "pointer", color: "#fff" }}>
              <Avatar style={{ backgroundColor: "#1677ff" }} icon={<UserOutlined />} />
              <span>{user.fullName || user.email}</span>
              <Tag color="blue">{ROLE_LABEL[user.role]}</Tag>
            </Space>
          </Dropdown>
        </Header>

        {isMobile && collapsed && (
          <div style={{ background: "#001529", padding: "8px 0" }}>
            <Menu theme="dark" mode="inline" selectedKeys={[selectedKey]} items={menuItems} />
          </div>
        )}

        <Content>{children}</Content>
      </Layout>
    </Layout>
  );
}
