"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Card,
  Tree,
  Row,
  Col,
  Button,
  Space,
  Tag,
  Typography,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Popconfirm,
  App,
  Tooltip,
  Badge,
  Spin,
  Empty,
  Descriptions,
  Alert,
} from "antd";
import type { DataNode } from "antd/es/tree";
import {
  FolderOutlined,
  FolderOpenOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  TagsOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";
import BulkDeleteButton from "@/components/BulkDeleteButton";

const { Text, Title } = Typography;

type CategoryRole = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
};

type FolderNode = {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  inheritCategoryRoles: boolean;
  categoryRoleIds: string[];
  effectiveCategoryRoleIds: string[];
  questionCount: number;
  children: FolderNode[];
};

export default function FoldersPage() {
  const { message, modal } = App.useApp();
  const [tree, setTree] = useState<FolderNode[]>([]);
  const [categories, setCategories] = useState<CategoryRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<FolderNode | null>(null);
  const [checkedKeys, setCheckedKeys] = useState<string[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [editing, setEditing] = useState<FolderNode | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/manager/folders");
      const data = await res.json();
      if (res.ok) {
        setTree(data.tree ?? []);
        setCategories(data.categoryRoles ?? []);
        const ids: string[] = [];
        const walk = (nodes: FolderNode[]) => {
          for (const n of nodes) {
            ids.push(n.id);
            if (n.children?.length) walk(n.children);
          }
        };
        walk(data.tree ?? []);
        setExpandedKeys(ids);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const catMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const toTreeData = (nodes: FolderNode[]): DataNode[] =>
    nodes.map((n) => ({
      key: n.id,
      title: (
        <span>
          <FolderOpenOutlined style={{ color: "#faad14", marginRight: 6 }} />
          <Text>{n.name}</Text>
          {n.questionCount > 0 && (
            <Badge
              count={n.questionCount}
              style={{ marginLeft: 8, backgroundColor: "#1677ff" }}
              overflowCount={9999}
            />
          )}
          <Tooltip title="Danh mục hiệu lực (đã kế thừa)">
            <span style={{ marginLeft: 8 }}>
              {n.effectiveCategoryRoleIds.map((id) => (
                <Tag
                  key={id}
                  color={catMap.get(id)?.color ?? "blue"}
                  style={{ marginLeft: 4, fontSize: 11 }}
                >
                  {catMap.get(id)?.name ?? id}
                </Tag>
              ))}
            </span>
          </Tooltip>
        </span>
      ),
      children: n.children?.length ? toTreeData(n.children) : undefined,
    }));

  const findNode = (nodes: FolderNode[], id: string): FolderNode | null => {
    for (const n of nodes) {
      if (n.id === id) return n;
      const found = n.children?.length ? findNode(n.children, id) : null;
      if (found) return found;
    }
    return null;
  };

  const openCreate = (parentId: string | null) => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      name: "",
      description: "",
      parentId,
      categoryRoleIds: [],
      inheritCategoryRoles: true,
    });
    setModalOpen(true);
  };

  const openEdit = (node: FolderNode) => {
    setEditing(node);
    form.setFieldsValue({
      name: node.name,
      description: node.description ?? "",
      parentId: node.parentId,
      categoryRoleIds: node.categoryRoleIds,
      inheritCategoryRoles: node.inheritCategoryRoles,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    const payload = {
      ...(editing ? { folderId: editing.id } : {}),
      name: values.name,
      description: values.description,
      parentId: values.parentId ?? null,
      categoryRoleIds: values.categoryRoleIds ?? [],
      inheritCategoryRoles: values.inheritCategoryRoles ?? true,
    };
    const res = await fetch("/api/manager/folders", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      message.error(data.error ?? "Lỗi");
      return;
    }
    message.success(editing ? "Cập nhật thư mục thành công" : "Tạo thư mục thành công");
    setModalOpen(false);
    load();
  };

  const handleDelete = async (node: FolderNode) => {
    const res = await fetch(`/api/manager/folders?id=${node.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      message.error(data.error ?? "Không thể xóa");
      return;
    }
    message.success("Đã xóa thư mục");
    setSelected(null);
    load();
  };

  const allFoldersFlat = useMemo(() => {
    const out: { id: string; name: string; parentId: string | null }[] = [];
    const walk = (nodes: FolderNode[], depth: number) => {
      for (const n of nodes) {
        out.push({ id: n.id, name: `${"— ".repeat(depth)}${n.name}`, parentId: n.parentId });
        if (n.children?.length) walk(n.children, depth + 1);
      }
    };
    walk(tree, 0);
    return out;
  }, [tree]);

  return (
    <div className="page-container">
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <Card
            title="Cây thư mục"
            extra={
              <Space wrap>
                <BulkDeleteButton
                  selectedIds={checkedKeys}
                  endpoint="/api/manager/folders"
                  label="thư mục"
                  warning="Toàn bộ thư mục con và câu hỏi bên trong sẽ bị xóa."
                  onDone={() => {
                    setCheckedKeys([]);
                    setSelected(null);
                    load();
                  }}
                />
                <Button
                  type="primary"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => openCreate(null)}
                >
                  Thư mục gốc
                </Button>
              </Space>
            }
          >
            {loading ? (
              <div style={{ textAlign: "center", padding: 30 }}>
                <Spin />
              </div>
            ) : tree.length === 0 ? (
              <Empty description="Chưa có thư mục nào">
                <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreate(null)}>
                  Tạo thư mục đầu tiên
                </Button>
              </Empty>
            ) : (
              <Tree
                showIcon
                blockNode
                checkable
                treeData={toTreeData(tree)}
                expandedKeys={expandedKeys}
                onExpand={(keys) => setExpandedKeys(keys as string[])}
                checkedKeys={checkedKeys}
                onCheck={(keys) => setCheckedKeys((keys as string[]) ?? [])}
                selectedKeys={selected ? [selected.id] : []}
                onSelect={(keys) => {
                  if (keys.length === 0) return;
                  const node = findNode(tree, String(keys[0]));
                  setSelected(node);
                }}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={14}>
          {selected ? (
            <Card
              title={`Thông tin thư mục: ${selected.name}`}
              extra={
                <Space>
                  <Button
                    size="small"
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => openCreate(selected.id)}
                  >
                    Thư mục con
                  </Button>
                  <Button
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => openEdit(selected)}
                  >
                    Sửa
                  </Button>
                  <Popconfirm
                    title="Xóa thư mục này?"
                    description="Toàn bộ thư mục con và câu hỏi bên trong sẽ bị xóa."
                    okText="Xóa"
                    cancelText="Hủy"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => handleDelete(selected)}
                  >
                    <Button size="small" danger icon={<DeleteOutlined />}>
                      Xóa
                    </Button>
                  </Popconfirm>
                </Space>
              }
            >
              <Descriptions column={1} bordered size="small">
                <Descriptions.Item label="Tên">{selected.name}</Descriptions.Item>
                <Descriptions.Item label="Mô tả">
                  {selected.description || <Text type="secondary">—</Text>}
                </Descriptions.Item>
                <Descriptions.Item label="Số câu hỏi">
                  <Badge count={selected.questionCount} color="#1677ff" overflowCount={9999} />
                </Descriptions.Item>
                <Descriptions.Item label="Danh mục gắn trực tiếp">
                  {selected.categoryRoleIds.length === 0 ? (
                    <Text type="secondary">—</Text>
                  ) : (
                    <Space wrap>
                      {selected.categoryRoleIds.map((id) => (
                        <Tag key={id} color={catMap.get(id)?.color ?? "blue"}>
                          {catMap.get(id)?.name ?? id}
                        </Tag>
                      ))}
                    </Space>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Kế thừa từ thư mục cha">
                  {selected.inheritCategoryRoles ? (
                    <Tag color="green">Có</Tag>
                  ) : (
                    <Tag color="orange">Không — chỉ dùng role gắn trực tiếp</Tag>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Danh mục hiệu lực (sau kế thừa)">
                  {selected.effectiveCategoryRoleIds.length === 0 ? (
                    <Text type="secondary">—</Text>
                  ) : (
                    <Space wrap>
                      {selected.effectiveCategoryRoleIds.map((id) => (
                        <Tag key={id} color={catMap.get(id)?.color ?? "blue"}>
                          {catMap.get(id)?.name ?? id}
                        </Tag>
                      ))}
                    </Space>
                  )}
                </Descriptions.Item>
              </Descriptions>

              <Alert
                style={{ marginTop: 16 }}
                type="info"
                showIcon
                message="Về kế thừa danh mục"
                description="Nếu một thư mục con không chỉ định riêng, nó mặc định kế thừa toàn bộ danh mục của thư mục cha. Tắt 'Kế thừa' nếu muốn thư mục chỉ dùng các danh mục gắn trực tiếp."
              />
            </Card>
          ) : (
            <Card>
              <Empty description="Chọn một thư mục trong cây để xem chi tiết" />
            </Card>
          )}
        </Col>
      </Row>

      <Modal
        title={editing ? "Cập nhật thư mục" : "Tạo thư mục mới"}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        okText="Lưu"
        cancelText="Hủy"
        width={560}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="Tên thư mục"
            rules={[{ required: true, message: "Vui lòng nhập tên thư mục" }]}
          >
            <Input placeholder="VD: Luật Dân sự" />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={2} placeholder="Mô tả ngắn về thư mục" />
          </Form.Item>
          <Form.Item name="parentId" label="Thư mục cha">
            <Select
              allowClear
              placeholder="Thư mục gốc (không có cha)"
              options={allFoldersFlat
                .filter((f) => f.id !== editing?.id)
                .map((f) => ({ value: f.id, label: f.name }))}
            />
          </Form.Item>
          <Form.Item
            name="categoryRoleIds"
            label="Danh mục gắn trực tiếp"
            extra="Có thể gắn một hoặc nhiều danh mục cho thư mục này"
          >
            <Select
              mode="multiple"
              placeholder="Chọn danh mục"
              options={categories.map((c) => ({
                value: c.id,
                label: c.name,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="inheritCategoryRoles"
            label="Kế thừa danh mục từ thư mục cha"
            valuePropName="checked"
            extra="Bật (mặc định): thư mục con dùng danh mục của cha. Tắt: chỉ dùng danh mục gắn trực tiếp."
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}