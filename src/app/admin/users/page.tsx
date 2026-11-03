"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Typography,
  Modal,
  Form,
  Select,
  App,
  Switch,
  Input,
  Descriptions,
  Popconfirm,
  Tooltip,
  Statistic,
  Row,
  Col,
} from "antd";
import {
  LockOutlined,
  UnlockOutlined,
  UserSwitchOutlined,
  KeyOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import BulkDeleteButton from "@/components/BulkDeleteButton";
import { ROLE_LABEL } from "@/types/auth";

const { Text } = Typography;

type UserRow = {
  id: string;
  email: string;
  fullName: string | null;
  role: "GUEST" | "MANAGER" | "ADMIN";
  isLocked: boolean;
  createdAt: string;
  privateKeys: { id: string; code: string; expiresAt: string }[];
};

export default function AdminUsersPage() {
  const { message } = App.useApp();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [form] = Form.useForm();
  const [detail, setDetail] = useState<UserRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      const d = await res.json();
      if (res.ok) setUsers(d.users ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleLock = async (user: UserRow) => {
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, isLocked: !user.isLocked }),
    });
    const d = await res.json();
    if (!res.ok) {
      message.error(d.error ?? "Lỗi");
      return;
    }
    message.success(user.isLocked ? "Đã mở khóa tài khoản" : "Đã khóa tài khoản");
    load();
  };

  const openEdit = (user: UserRow) => {
    setEditing(user);
    form.resetFields();
    form.setFieldsValue({ role: user.role, newPassword: "" });
    setOpen(true);
  };

  const save = async () => {
    const values = await form.validateFields();
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: editing!.id,
        role: values.role,
        newPassword: values.newPassword || undefined,
      }),
    });
    const d = await res.json();
    if (!res.ok) {
      message.error(d.error ?? "Lỗi");
      return;
    }
    message.success("Cập nhật thành công");
    setOpen(false);
    load();
  };

  const total = users.length;
  const locked = users.filter((u) => u.isLocked).length;
  const byRole = {
    ADMIN: users.filter((u) => u.role === "ADMIN").length,
    MANAGER: users.filter((u) => u.role === "MANAGER").length,
    GUEST: users.filter((u) => u.role === "GUEST").length,
  };

  return (
    <div className="page-container">
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic title="Tổng tài khoản" value={total} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic title="Admin" value={byRole.ADMIN} valueStyle={{ color: "#f5222d" }} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic title="Manager" value={byRole.MANAGER} valueStyle={{ color: "#1677ff" }} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic title="Đang bị khóa" value={locked} valueStyle={{ color: "#faad14" }} />
          </Card>
        </Col>
      </Row>

      <Card
        title="Danh sách tài khoản"
        extra={
          <Space wrap>
            <BulkDeleteButton
              selectedIds={selectedIds}
              endpoint="/api/admin/users"
              label="tài khoản"
              warning="Lịch sử làm bài của các tài khoản này cũng sẽ bị xóa. Private key đã dùng sẽ được trả về trạng thái còn hiệu lực."
              onDone={() => {
                setSelectedIds([]);
                load();
              }}
            />
            <Button icon={<ReloadOutlined />} onClick={load}>
              Làm mới
            </Button>
          </Space>
        }
      >
        <Table
          rowKey="id"
          loading={loading}
          dataSource={users}
          rowSelection={{
            selectedRowKeys: selectedIds,
            onChange: (keys) => setSelectedIds(keys as string[]),
          }}
          pagination={{ pageSize: 15, showSizeChanger: false }}
          columns={[
            {
              title: "Email",
              dataIndex: "email",
              key: "email",
              render: (v: string, row: UserRow) => (
                <Space direction="vertical" size={0}>
                  <Text strong>{v}</Text>
                  {row.fullName && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {row.fullName}
                    </Text>
                  )}
                </Space>
              ),
            },
            {
              title: "Role",
              dataIndex: "role",
              key: "role",
              width: 120,
              render: (v: string) => (
                <Tag color={v === "ADMIN" ? "red" : v === "MANAGER" ? "blue" : "default"}>
                  {ROLE_LABEL[v as "GUEST" | "MANAGER" | "ADMIN"]}
                </Tag>
              ),
            },
            {
              title: "Private key",
              key: "key",
              width: 240,
              render: (_: unknown, row: UserRow) => {
                const k = row.privateKeys[0];
                if (!k) return <Text type="secondary">Chưa gán</Text>;
                const expired = new Date(k.expiresAt).getTime() < Date.now();
                return (
                  <Space direction="vertical" size={0}>
                    <Text code style={{ fontSize: 12 }}>
                      {k.code}
                    </Text>
                    <Text type={expired ? "danger" : "secondary"} style={{ fontSize: 12 }}>
                      Hết hạn: {new Date(k.expiresAt).toLocaleDateString("vi-VN")}
                      {expired ? " (đã hết hạn)" : ""}
                    </Text>
                  </Space>
                );
              },
            },
            {
              title: "Trạng thái",
              dataIndex: "isLocked",
              key: "locked",
              width: 110,
              render: (v: boolean) =>
                v ? <Tag color="orange">Đã khóa</Tag> : <Tag color="green">Hoạt động</Tag>,
            },
            {
              title: "Ngày tạo",
              dataIndex: "createdAt",
              key: "createdAt",
              width: 130,
              render: (v: string) => (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {new Date(v).toLocaleDateString("vi-VN")}
                </Text>
              ),
            },
            {
              title: "Thao tác",
              key: "action",
              width: 200,
              render: (_: unknown, row: UserRow) => (
                <Space size={4} wrap>
                  <Button
                    size="small"
                    icon={<UserSwitchOutlined />}
                    onClick={() => openEdit(row)}
                  >
                    Role / MK
                  </Button>
                  <Popconfirm
                    title={row.isLocked ? "Mở khóa tài khoản?" : "Khóa tài khoản?"}
                    description={
                      row.isLocked
                        ? "Người dùng sẽ đăng nhập lại được."
                        : "Người dùng sẽ không thể đăng nhập."
                    }
                    okText={row.isLocked ? "Mở khóa" : "Khóa"}
                    cancelText="Hủy"
                    onConfirm={() => toggleLock(row)}
                  >
                    <Button
                      size="small"
                      danger={!row.isLocked}
                      icon={row.isLocked ? <UnlockOutlined /> : <LockOutlined />}
                    />
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={`Cập nhật tài khoản: ${editing?.email ?? ""}`}
        open={open}
        onOk={save}
        onCancel={() => setOpen(false)}
        okText="Lưu"
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="role" label="Vai trò">
            <Select
              options={[
                { value: "GUEST", label: "Guest — người dùng mặc định" },
                { value: "MANAGER", label: "Manager — quản lý nội dung" },
                { value: "ADMIN", label: "Admin — quản trị hệ thống" },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label="Đặt lại mật khẩu"
            extra="Để trống nếu không thay đổi. Dùng khi cấp lại private key cho người dùng."
          >
            <Input.Password placeholder="Mật khẩu mới (tối thiểu 6 ký tự)" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
