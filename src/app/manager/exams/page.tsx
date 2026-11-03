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
  Select,
  InputNumber,
  App,
  Popconfirm,
  Radio,
  Row,
  Col,
  Switch,
  Empty,
  Alert,
  Divider,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import BulkDeleteButton from "@/components/BulkDeleteButton";

const { Text, Title } = Typography;

const TYPE_OPTIONS = [
  { value: "MCQ4", label: "Trắc nghiệm 4 đáp án" },
  { value: "TRUE_FALSE", label: "Trắc nghiệm đúng sai" },
  { value: "FILL_BLANK", label: "Điền nội dung còn thiếu" },
];

type Rule = {
  key: string;
  folderId?: string;
  type?: string;
  quantity: number;
};

type Exam = {
  id: string;
  name: string;
  description: string | null;
  durationMin: number | null;
  isPublished: boolean;
  mode: string;
  rules: {
    id: string;
    quantity: number;
    type: string | null;
    folder: { id: string; name: string } | null;
  }[];
  folders: { folder: { id: string; name: string } }[];
  items: { question: { id: string; content: string; type: string } }[];
  _count: { items: number };
};

type FolderNode = { id: string; name: string; children: FolderNode[] };

export default function ManagerExamsPage() {
  const { message } = App.useApp();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [tree, setTree] = useState<FolderNode[]>([]);
  const [questions, setQuestions] = useState<
    { id: string; content: string; type: string; folder: { name: string } }[]
  >([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Exam | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [form] = Form.useForm();
  const [mode, setMode] = useState<"RANDOM" | "FIXED">("RANDOM");
  const [rules, setRules] = useState<Rule[]>([
    { key: "r0", type: "MCQ4", quantity: 10 },
    { key: "r1", type: "TRUE_FALSE", quantity: 10 },
    { key: "r2", type: "FILL_BLANK", quantity: 10 },
  ]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/manager/exams");
      const d = await res.json();
      if (res.ok) setExams(d.exams ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    fetch("/api/manager/folders")
      .then((r) => r.json())
      .then((d) => setTree(d.tree ?? []))
      .catch(() => {});
    fetch("/api/manager/questions?pageSize=500")
      .then((r) => r.json())
      .then((d) => setQuestions(d.items ?? []))
      .catch(() => {});
  }, [load]);

  const flatFolders = (nodes: FolderNode[], depth = 0): { value: string; label: string }[] => {
    const out: { value: string; label: string }[] = [];
    for (const n of nodes) {
      out.push({ value: n.id, label: `${"— ".repeat(depth)}${n.name}` });
      if (n.children?.length) out.push(...flatFolders(n.children, depth + 1));
    }
    return out;
  };
  const folderOptions = flatFolders(tree);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      name: "",
      description: "",
      durationMin: 30,
      isPublished: true,
    });
    setMode("RANDOM");
    setRules([
      { key: "r0", type: "MCQ4", quantity: 10 },
      { key: "r1", type: "TRUE_FALSE", quantity: 10 },
      { key: "r2", type: "FILL_BLANK", quantity: 10 },
    ]);
    setOpen(true);
  };

  const openEdit = (row: Exam) => {
    setEditing(row);
    setMode(row.mode as "RANDOM" | "FIXED");
    form.setFieldsValue({
      name: row.name,
      description: row.description ?? "",
      durationMin: row.durationMin,
      isPublished: row.isPublished,
      folderIds: row.folders.map((f) => f.folder.id),
      questionIds: row.items.map((i) => i.question.id),
    });
    setRules(
      row.rules.map((r, i) => ({
        key: `e${i}`,
        folderId: r.folder?.id,
        type: r.type ?? undefined,
        quantity: r.quantity,
      })),
    );
    setOpen(true);
  };

  const save = async () => {
    const values = await form.validateFields();
    const payload = {
      ...(editing ? { id: editing.id } : {}),
      name: values.name,
      description: values.description,
      durationMin: values.durationMin ?? null,
      isPublished: values.isPublished ?? true,
      mode,
      folderIds: values.folderIds ?? [],
      questionIds: values.questionIds ?? [],
      rules: rules.map((r) => ({
        folderId: r.folderId ?? null,
        type: r.type ?? null,
        quantity: r.quantity,
      })),
    };
    const res = await fetch("/api/manager/exams", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const d = await res.json();
    if (!res.ok) {
      message.error(d.error ?? "Lỗi");
      return;
    }
    message.success(editing ? "Cập nhật bài thi thành công" : "Tạo bài thi thành công");
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    const res = await fetch(`/api/manager/exams?id=${id}`, { method: "DELETE" });
    const d = await res.json();
    if (!res.ok) {
      message.error(d.error ?? "Không thể xóa");
      return;
    }
    message.success("Đã xóa bài thi");
    load();
  };

  return (
    <div className="page-container">
      <Card
        title="Quản lý bài thi"
        extra={
          <Space wrap>
            <BulkDeleteButton
              selectedIds={selectedIds}
              endpoint="/api/manager/exams"
              label="bài thi"
              onDone={() => {
                setSelectedIds([]);
                load();
              }}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Tạo bài thi
            </Button>
          </Space>
        }
      >
        <Table
          rowKey="id"
          loading={loading}
          dataSource={exams}
          pagination={false}
          rowSelection={{
            selectedRowKeys: selectedIds,
            onChange: (keys) => setSelectedIds(keys as string[]),
          }}
          locale={{ emptyText: <Empty description="Chưa có bài thi nào" /> }}
          columns={[
            {
              title: "Tên bài thi",
              dataIndex: "name",
              key: "name",
              render: (v: string, row: Exam) => (
                <Space direction="vertical" size={0}>
                  <Space>
                    <FileTextOutlined />
                    <Text strong>{v}</Text>
                  </Space>
                  {row.description && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {row.description}
                    </Text>
                  )}
                </Space>
              ),
            },
            {
              title: "Chế độ",
              dataIndex: "mode",
              key: "mode",
              width: 150,
              render: (v: string) =>
                v === "FIXED" ? (
                  <Tag color="cyan">Chỉ định câu hỏi</Tag>
                ) : (
                  <Tag color="purple">Ngẫu nhiên theo quy tắc</Tag>
                ),
            },
            {
              title: "Cấu trúc",
              key: "structure",
              render: (_: unknown, row: Exam) => {
                if (row.mode === "FIXED") {
                  return <Text>{row._count.items} câu được chỉ định</Text>;
                }
                return (
                  <Space wrap size={4}>
                    {row.rules.map((r) => (
                      <Tag key={r.id}>
                        {r.folder?.name ?? "Tất cả"}: {r.quantity} câu
                        {r.type ? ` ${shortType(r.type)}` : ""}
                      </Tag>
                    ))}
                  </Space>
                );
              },
            },
            {
              title: "Thời gian",
              dataIndex: "durationMin",
              key: "duration",
              width: 110,
              render: (v: number | null) => (v ? `${v} phút` : "—"),
            },
            {
              title: "Trạng thái",
              dataIndex: "isPublished",
              key: "published",
              width: 110,
              render: (v: boolean) =>
                v ? <Tag color="green">Đang công bố</Tag> : <Tag>Đang ẩn</Tag>,
            },
            {
              title: "Thao tác",
              key: "action",
              width: 110,
              render: (_: unknown, row: Exam) => (
                <Space>
                  <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)} />
                  <Popconfirm
                    title="Xóa bài thi này?"
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
        title={editing ? "Cập nhật bài thi" : "Tạo bài thi"}
        open={open}
        onOk={save}
        onCancel={() => setOpen(false)}
        okText="Lưu"
        cancelText="Hủy"
        width={760}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="Tên bài thi"
            rules={[{ required: true, message: "Vui lòng nhập tên bài thi" }]}
          >
            <Input placeholder="VD: Kiểm tra giữa kỳ Pháp luật" />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={2} />
          </Form.Item>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="durationMin"
                label="Thời gian (phút)"
                extra="Để trống nếu không giới hạn"
              >
                <InputNumber min={1} max={600} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="isPublished" label="Công bố cho người dùng" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" plain>
            Cách chọn câu hỏi
          </Divider>

          <Form.Item label="Chế độ">
            <Radio.Group
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              options={[
                { value: "RANDOM", label: "Ngẫu nhiên theo số lượng theo mục / loại" },
                { value: "FIXED", label: "Chỉ định từng câu hỏi" },
              ]}
              optionType="button"
              buttonStyle="solid"
            />
          </Form.Item>

          {mode === "RANDOM" ? (
            <>
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 12 }}
                message="Khi người dùng bắt đầu bài thi, hệ thống sẽ lấy ngẫu nhiên số câu theo từng quy tắc bên dưới."
              />
              <Table
                rowKey="key"
                size="small"
                pagination={false}
                dataSource={rules}
                columns={[
                  {
                    title: "Thư mục / mục",
                    key: "folder",
                    render: (_: unknown, r: Rule) => (
                      <Select
                        style={{ width: "100%" }}
                        placeholder="Tất cả thư mục"
                        allowClear
                        showSearch
                        optionFilterProp="label"
                        value={r.folderId}
                        onChange={(v) =>
                          setRules((p) => p.map((x) => (x.key === r.key ? { ...x, folderId: v } : x)))
                        }
                        options={folderOptions}
                      />
                    ),
                  },
                  {
                    title: "Loại",
                    key: "type",
                    width: 190,
                    render: (_: unknown, r: Rule) => (
                      <Select
                        style={{ width: "100%" }}
                        placeholder="Tất cả loại"
                        allowClear
                        value={r.type}
                        onChange={(v) =>
                          setRules((p) => p.map((x) => (x.key === r.key ? { ...x, type: v } : x)))
                        }
                        options={TYPE_OPTIONS}
                      />
                    ),
                  },
                  {
                    title: "Số câu",
                    key: "quantity",
                    width: 110,
                    render: (_: unknown, r: Rule) => (
                      <InputNumber
                        min={0}
                        max={200}
                        style={{ width: "100%" }}
                        value={r.quantity}
                        onChange={(v) =>
                          setRules((p) =>
                            p.map((x) => (x.key === r.key ? { ...x, quantity: v ?? 0 } : x)),
                          )
                        }
                      />
                    ),
                  },
                  {
                    title: "",
                    key: "del",
                    width: 45,
                    render: (_: unknown, r: Rule) => (
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => setRules((p) => p.filter((x) => x.key !== r.key))}
                      />
                    ),
                  },
                ]}
              />
              <Button
                type="dashed"
                block
                style={{ marginTop: 12 }}
                icon={<PlusOutlined />}
                onClick={() => setRules((p) => [...p, { key: `r${Date.now()}`, quantity: 10 }])}
              >
                Thêm quy tắc
              </Button>
            </>
          ) : (
            <Form.Item
              name="questionIds"
              label="Chọn câu hỏi"
              extra="Có thể chọn nhiều câu hỏi cho bài thi"
            >
              <Select
                mode="multiple"
                showSearch
                optionFilterProp="label"
                placeholder="Chọn câu hỏi"
                style={{ width: "100%" }}
                maxTagCount="responsive"
                options={questions.map((q) => ({
                  value: q.id,
                  label: `[${q.folder?.name}] ${q.content.slice(0, 80)}`,
                }))}
              />
            </Form.Item>
          )}

          <Form.Item name="folderIds" label="Thư mục chứa câu hỏi của bài thi" style={{ marginTop: 12 }}>
            <Select
              mode="multiple"
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Chọn thư mục"
              options={folderOptions}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

function shortType(t: string) {
  if (t === "MCQ4") return "trắc nghiệm";
  if (t === "TRUE_FALSE") return "đúng sai";
  return "điền trống";
}
