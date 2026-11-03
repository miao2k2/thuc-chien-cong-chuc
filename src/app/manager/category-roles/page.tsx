"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Typography,
  Modal,
  Form,
  Input,
  App,
  Popconfirm,
  ColorPicker,
} from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import BulkDeleteButton from "@/components/BulkDeleteButton";

const { Text } = Typography;

type CategoryRole = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  _count?: { folders: number };
};

export default function CategoryRolesPage() {
  const { message } = App.useApp();
  const [items, setItems] = useState<CategoryRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryRole | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/manager/category-roles");
      const d = await res.json();
      if (res.ok) setItems(d.categoryRoles ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ name: "", description: "", color: "#1677ff" });
    setOpen(true);
  };

  const openEdit = (row: CategoryRole) => {
    setEditing(row);
    form.setFieldsValue({
      name: row.name,
      description: row.description ?? "",
      color: row.color ?? "#1677ff",
    });
    setOpen(true);
  };

  const save = async () => {
    const values = await form.validateFields();
    const payload = editing ? { id: editing.id, ...values } : values;
    const res = await fetch("/api/manager/category-roles", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const d = await res.json();
    if (!res.ok) {
      message.error(d.error ?? "Lỗi");
      return;
    }
    message.success(editing ? "Cập nhật thành công" : "Tạo thành công");
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    const res = await fetch(`/api/manager/category-roles?id=${id}`, { method: "DELETE" });
    const d = await res.json();
    if (!res.ok) {
      message.error(d.error ?? "Không thể xóa");
      return;
    }
    message.success("Đã xóa");
    load();
  };

  return (
    <div className="page-container">
      <Card
        title="Quản lý Danh mục"
        extra={
          <Space wrap>
            <BulkDeleteButton
              selectedIds={selectedIds}
              endpoint="/api/manager/category-roles"
              label="danh mục"
              warning="Các thư mục đang gắn danh mục sẽ mất liên kết."
              onDone={() => {
                setSelectedIds([]);
                load();
              }}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Tạo danh mục
            </Button>
          </Space>
        }
      >
        <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
          Danh mục dùng để phân loại thư mục. Mỗi thư mục có thể gắn một hoặc nhiều danh mục.
          Thư mục con sẽ mặc định kế thừa các danh mục của thư mục cha.
        </Text>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={items}
          pagination={false}
          rowSelection={{
            selectedRowKeys: selectedIds,
            onChange: (keys) => setSelectedIds(keys as string[]),
          }}
          columns={[
            {
              title: "Tên",
              dataIndex: "name",
              key: "name",
              render: (v: string, row: CategoryRole) => (
                <Space>
                  <Tag color={row.color ?? "blue"}>{v}</Tag>
                </Space>
              ),
            },
            {
              title: "Mô tả",
              dataIndex: "description",
              key: "description",
              render: (v: string | null) => v || <Text type="secondary">—</Text>,
            },
            {
              title: "Số thư mục sử dụng",
              key: "count",
              width: 160,
              align: "center",
              render: (_: unknown, row: CategoryRole) => row._count?.folders ?? 0,
            },
            {
              title: "Thao tác",
              key: "action",
              width: 140,
              render: (_: unknown, row: CategoryRole) => (
                <Space>
                  <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)} />
                  <Popconfirm
                    title="Xóa danh mục này?"
                    description="Các thư mục đang gắn danh mục này sẽ mất liên kết."
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
        title={editing ? "Cập nhật danh mục" : "Tạo danh mục"}
        open={open}
        onOk={save}
        onCancel={() => setOpen(false)}
        okText="Lưu"
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="Tên"
            rules={[{ required: true, message: "Vui lòng nhập tên" }]}
          >
            <Input placeholder="VD: Pháp luật" />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item
            name="color"
            label="Màu hiển thị"
            getValueFromEvent={(e) => (typeof e === "string" ? e : e.toHexString())}
          >
            <ColorPicker showText />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
