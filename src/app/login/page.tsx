"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Form, Input, Button, Card, Tabs, App, Divider, Alert } from "antd";
import { UserOutlined, LockOutlined, KeyOutlined, MailOutlined } from "@ant-design/icons";

export default function AuthPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("login");

  const handleLogin = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        message.error(data.error ?? "Đăng nhập thất bại");
        return;
      }
      message.success("Đăng nhập thành công");
      const role = data.user.role;
      router.push(role === "ADMIN" ? "/admin" : role === "MANAGER" ? "/manager" : "/client");
      router.refresh();
    } catch {
      message.error("Không kết nối được máy chủ");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (values: {
    email: string;
    password: string;
    fullName?: string;
    privateKey: string;
  }) => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        message.error(data.error ?? "Đăng ký thất bại");
        return;
      }
      message.success("Đăng ký thành công");
      router.push("/client");
      router.refresh();
    } catch {
      message.error("Không kết nối được máy chủ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #1677ff 0%, #001529 100%)",
        padding: 24,
      }}
    >
      <Card style={{ width: 460, boxShadow: "0 8px 32px rgba(0,0,0,0.25)" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <h2 style={{ margin: 0 }}>Hệ thống Thi kiểm tra</h2>
          <p style={{ color: "#888", marginTop: 4 }}>
            Thực chiến công chức — Trung tâm đào tạo
          </p>
        </div>

        <Tabs
          activeKey={tab}
          onChange={setTab}
          centered
          items={[
            {
              key: "login",
              label: "Đăng nhập",
              children: (
                <Form
                  layout="vertical"
                  onFinish={handleLogin}
                  requiredMark={false}
                  initialValues={{ email: "", password: "" }}
                >
                  <Form.Item
                    name="email"
                    label="Email"
                    rules={[
                      { required: true, message: "Vui lòng nhập email" },
                      { type: "email", message: "Email không hợp lệ" },
                    ]}
                  >
                    <Input
                      prefix={<MailOutlined />}
                      placeholder="email@example.com"
                      size="large"
                      autoComplete="username"
                    />
                  </Form.Item>
                  <Form.Item
                    name="password"
                    label="Mật khẩu"
                    rules={[{ required: true, message: "Vui lòng nhập mật khẩu" }]}
                  >
                    <Input.Password
                      prefix={<LockOutlined />}
                      placeholder="Mật khẩu"
                      size="large"
                      autoComplete="current-password"
                    />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" block size="large" loading={loading}>
                    Đăng nhập
                  </Button>
                </Form>
              ),
            },
            {
              key: "register",
              label: "Đăng ký",
              children: (
                <>
                  <Alert
                    type="info"
                    showIcon
                    message="Tài khoản mới cần private key do quản trị viên cung cấp để đăng ký."
                    style={{ marginBottom: 16 }}
                  />
                  <Form
                    layout="vertical"
                    onFinish={handleRegister}
                    requiredMark={false}
                    initialValues={{ email: "", password: "", fullName: "", privateKey: "" }}
                  >
                    <Form.Item
                      name="email"
                      label="Email"
                      rules={[
                        { required: true, message: "Vui lòng nhập email" },
                        { type: "email", message: "Email không hợp lệ" },
                      ]}
                    >
                      <Input prefix={<UserOutlined />} placeholder="email@example.com" size="large" />
                    </Form.Item>
                    <Form.Item name="fullName" label="Họ và tên">
                      <Input placeholder="Nguyễn Văn A" size="large" />
                    </Form.Item>
                    <Form.Item
                      name="privateKey"
                      label="Private key"
                      rules={[{ required: true, message: "Vui lòng nhập private key" }]}
                    >
                      <Input prefix={<KeyOutlined />} placeholder="TCCC-XXXXXXXXXXXX" size="large" />
                    </Form.Item>
                    <Form.Item
                      name="password"
                      label="Mật khẩu"
                      rules={[
                        { required: true, message: "Vui lòng nhập mật khẩu" },
                        { min: 6, message: "Mật khẩu tối thiểu 6 ký tự" },
                      ]}
                    >
                      <Input.Password prefix={<LockOutlined />} placeholder="Mật khẩu" size="large" />
                    </Form.Item>
                    <Button type="primary" htmlType="submit" block size="large" loading={loading}>
                      Đăng ký tài khoản
                    </Button>
                  </Form>
                </>
              ),
            },
          ]}
        />

        <Divider plain style={{ margin: "16px 0" }}>
          <span style={{ fontSize: 12, color: "#999" }}>Tài khoản dùng thử</span>
        </Divider>
        <div style={{ fontSize: 12, color: "#666", lineHeight: 1.8, textAlign: "center" }}>
          <div>Admin: <b>seoao24@gmail.com</b> / <b>Abcd@1234</b></div>
          <div>Manager: <b>manager@tccc.local</b> / <b>Abcd@1234</b></div>
          <div>Guest: <b>guest@tccc.local</b> / <b>Abcd@1234</b></div>
        </div>
        <div style={{ textAlign: "center", marginTop: 12, fontSize: 12 }}>
          <Link href="/login">Quên mật khẩu? Liên hệ quản trị viên</Link>
        </div>
      </Card>
    </div>
  );
}
