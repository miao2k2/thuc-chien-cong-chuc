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
  Input,
  InputNumber,
  App,
  Popconfirm,
  DatePicker,
  Select,
  Statistic,
  Row,
  Col,
  Tooltip,
  Alert,
  message as staticMessage,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  ReloadOutlined,
  CopyOutlined,
  StopOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import dayjs, { Dayjs } from "dayjs";
import BulkDeleteButton from "@/components/BulkDeleteButton";

const { Text, Title } = Typography;

type KeyRow = {
  id: string;
  code: string;
  note: string | null;
  status: "ACTIVE" | "EXPIRED" | "REVOKED" | "USED";
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
  usedBy: { id: string; email: string; fullName: string | null } | null;
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Đang hiệu lực",
  EXPIRED: "Đã hết hạn",
  REVOKED: "Đã thu hồi",
  USED: "Đã sử dụng",
};

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "green",
  EXPIRED: "default",
  REVOKED: "red",
  USED: "blue",
};

export default function PrivateKeysPage() {
  const { message } = App.useApp();
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const [created, setCreated] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/private-keys");
      const d = await res.json();
      if (res.ok) setKeys(d.keys ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    form.resetFields();
    form.setFieldsValue({
      quantity: 1,
      expiresAt: dayjs().add(90, "day"),
      note: "",
    });
    setCreated([]);
    setOpen(true);
  };

  const create = async () => {
    const values = await form.validateFields();
    const res = await fetch("/api/admin/private-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quantity: values.quantity,
        note: values.note,
        expiresAt: (values.expiresAt as Dayjs).toISOString(),
      }),
    });
    const d = await res.json();
    if (!res.ok) {
      message.error(d.error ?? "Lỗi");
      return;
    }
    setCreated(d.keys.map((k: KeyRow) => k.code));
    message.success(`Đã tạo ${d.count} private key`);
    load();
  };

  const patch = async (id: string, data: Record<string, unknown>) => {
    const res = await fetch("/api/admin/private-keys", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyId: id, ...data }),
    });
    const d = await res.json();
    if (!res.ok) {
      message.error(d.error ?? "Lỗi");
      return;
    }
    message.success("Cập nhật thành công");
    load();
  };

  const remove = async (id: string) => {
    const res = await fetch(`/api/admin/private-keys?id=${id}`, { method: "DELETE" });
    const d = await res.json();
    if (!res.ok) {
      message.error(d.error ?? "Lỗi");
      return;
    }
    message.success("Đã xóa");
    load();
  };

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      message.success("Đã sao chép mã");
    } catch {
      staticMessage.info(code);
    }
  };

  const now = Date.now();
  const activeCount = keys.filter(
    (k) => k.status === "ACTIVE" && new Date(k.expiresAt).getTime() > now,
  ).length;

  return (
    <div className="page-container">
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic title="Tổng số key" value={keys.length} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic
              title="Đang hiệu lực"
              value={activeCount}
              valueStyle={{ color: "#52c41a" }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic
              title="Đã sử dụng"
              value={keys.filter((k) => k.status === "USED").length}
              valueStyle={{ color: "#1677ff" }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic
              title="Đã hết hạn / thu hồi"
              value={
                keys.filter((k) => k.status === "EXPIRED" || k.status === "REVOKED").length
              }
              valueStyle={{ color: "#faad14" }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title="Quản lý Private key"
        extra={
          <Space wrap>
            <BulkDeleteButton
              selectedIds={selectedIds}
              endpoint="/api/admin/private-keys"
              label="private key"
              onDone={() => {
                setSelectedIds([]);
                load();
              }}
            />
            <Button icon={<ReloadOutlined />} onClick={load}>
              Làm mới
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Generate private key
            </Button>
          </Space>
        }
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Private key dùng để đăng ký tài khoản mới. Mỗi key chỉ dùng được 1 lần và có thời hạn hết hạn do bạn cài đặt."
        />

        <Table
          rowKey="id"
          loading={loading}
          dataSource={keys}
          rowSelection={{
            selectedRowKeys: selectedIds,
            onChange: (keys) => setSelectedIds(keys as string[]),
          }}
          pagination={{ pageSize: 15, showSizeChanger: false }}
          columns={[
            {
              title: "Mã private key",
              dataIndex: "code",
              key: "code",
              render: (v: string) => (
                <Space>
                  <Text code style={{ fontSize: 12 }}>
                    {v}
                  </Text>
                  <Tooltip title="Sao chép">
                    <Button
                      size="small"
                      type="text"
                      icon={<CopyOutlined />}
                      onClick={() => copy(v)}
                    />
                  </Tooltip>
                </Space>
              ),
            },
            {
              title: "Ghi chú",
              dataIndex: "note",
              key: "note",
              render: (v: string | null) => v || <Text type="secondary">—</Text>,
            },
            {
              title: "Trạng thái",
              dataIndex: "status",
              key: "status",
              width: 140,
              render: (v: string, row: KeyRow) => {
                const isExpired = new Date(row.expiresAt).getTime() < now;
                if (v === "ACTIVE" && isExpired) {
                  return <Tag color="default">Đã hết hạn</Tag>;
                }
                return <Tag color={STATUS_COLOR[v]}>{STATUS_LABEL[v]}</Tag>;
              },
            },
            {
              title: "Hết hạn lúc",
              dataIndex: "expiresAt",
              key: "expiresAt",
              width: 160,
              render: (v: string) => (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {new Date(v).toLocaleString("vi-VN")}
                </Text>
              ),
            },
            {
              title: "Người sử dụng",
              key: "usedBy",
              width: 200,
              render: (_: unknown, row: KeyRow) =>
                row.usedBy ? (
                  <Space direction="vertical" size={0}>
                    <Text style={{ fontSize: 12 }}>{row.usedBy.email}</Text>
                    {row.usedAt && (
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {new Date(row.usedAt).toLocaleString("vi-VN")}
                      </Text>
                    )}
                  </Space>
                ) : (
                  <Text type="secondary">—</Text>
                ),
            },
            {
              title: "Thao tác",
              key: "action",
              width: 150,
              render: (_: unknown, row: KeyRow) => (
                <Space size={4}>
                  {row.status === "ACTIVE" && (
                    <Tooltip title="Thu hồi key">
                      <Popconfirm
                        title="Thu hồi private key này?"
                        description="Key sẽ không thể dùng để đăng ký nữa."
                        okText="Thu hồi"
                        cancelText="Hủy"
                        okButtonProps={{ danger: true }}
                        onConfirm={() => patch(row.id, { status: "REVOKED" })}
                      >
                        <Button size="small" danger icon={<StopOutlined />} />
                      </Popconfirm>
                    </Tooltip>
                  )}
                  <Popconfirm
                    title="Xóa private key này?"
                    okText="Xóa"
                    cancelText="Hủy"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => remove(row.id)}
                  >
                    <Button size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title="Generate private key"
        open={open}
        onOk={create}
        onCancel={() => setOpen(false)}
        okText="Tạo"
        cancelText="Đóng"
        width={560}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="quantity"
            label="Số lượng key"
            rules={[{ required: true, message: "Vui lòng nhập số lượng" }]}
          >
            <InputNumber min={1} max={100} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item
            name="expiresAt"
            label="Thời gian hết hạn"
            rules={[{ required: true, message: "Vui lòng chọn thời hạn" }]}
          >
            <DatePicker showTime style={{ width: "100%" }} format="DD/MM/YYYY HH:mm" />
          </Form.Item>
          <Form.Item name="note" label="Ghi chú">
            <Input.TextArea rows={2} placeholder="VD: Gia hạn gói tháng 12 cho nhân viên X" />
          </Form.Item>
        </Form>

        {created.length > 0 && (
          <Alert
            type="success"
            showIcon
            message="Các private key đã được tạo — hãy sao chép gửi cho người dùng:"
            description={
              <div>
                {created.map((c) => (
                  <div key={c} style={{ marginBottom: 4 }}>
                    <Text code>{c}</Text>
                    <Button
                      type="text"
                      size="small"
                      icon={<CopyOutlined />}
                      onClick={() => copy(c)}
                    />
                  </div>
                ))}
              </div>
            }
          />
        )}
      </Modal>
    </div>
  );
}
