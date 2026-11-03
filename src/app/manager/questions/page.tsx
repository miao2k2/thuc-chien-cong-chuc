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
  Radio,
  Select,
  App,
  Popconfirm,
  InputNumber,
  Row,
  Col,
  Divider,
  Empty,
  Checkbox,
  Alert,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  DownloadOutlined,
  UploadOutlined,
  FileExcelOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import BulkDeleteButton from "@/components/BulkDeleteButton";
import type { QuestionType } from "@prisma/client";

const { Text, Title } = Typography;

const TYPE_LABEL: Record<string, string> = {
  MCQ4: "Trắc nghiệm 4 đáp án",
  TRUE_FALSE: "Trắc nghiệm đúng sai",
  FILL_BLANK: "Điền nội dung còn thiếu",
};

const TYPE_COLOR: Record<string, string> = {
  MCQ4: "blue",
  TRUE_FALSE: "green",
  FILL_BLANK: "orange",
};

type QRow = {
  id: string;
  content: string;
  description: string | null;
  type: QuestionType;
  folder: { id: string; name: string };
  options: { id: string; label: string; isCorrect: boolean }[];
  blanks: { id: string; label: string; isCorrect: boolean }[];
};

type FolderNode = { id: string; name: string; children: FolderNode[]; questionCount: number };

export default function ManagerQuestionsPage() {
  const { message, modal } = App.useApp();
  const [data, setData] = useState<QRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [type, setType] = useState<string | undefined>();
  const [folderId, setFolderId] = useState<string | undefined>();
  const [tree, setTree] = useState<FolderNode[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<QRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [form] = Form.useForm();
  const [watchType, setWatchType] = useState<QuestionType>("MCQ4");
  const [importOpen, setImportOpen] = useState(false);
  const [importType, setImportType] = useState<QuestionType>("MCQ4");
  const [importFolder, setImportFolder] = useState<string | undefined>();
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (keyword) params.set("keyword", keyword);
    if (type) params.set("type", type);
    if (folderId) params.set("folderId", folderId);
    params.set("page", String(page));
    params.set("pageSize", "20");
    try {
      const res = await fetch(`/api/manager/questions?${params.toString()}`);
      const d = await res.json();
      if (res.ok) {
        setData(d.items ?? []);
        setTotal(d.total ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [keyword, type, folderId, page]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    fetch("/api/manager/folders")
      .then((r) => r.json())
      .then((d) => setTree(d.tree ?? []))
      .catch(() => {});
  }, []);

  const folderOptions = (nodes: FolderNode[], depth = 0): { value: string; label: string }[] => {
    const out: { value: string; label: string }[] = [];
    for (const n of nodes) {
      out.push({ value: n.id, label: `${"— ".repeat(depth)}${n.name}` });
      if (n.children?.length) out.push(...folderOptions(n.children, depth + 1));
    }
    return out;
  };
  const flatFolders = folderOptions(tree);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      type: "MCQ4",
      content: "",
      description: "",
      folderId: folderId ?? flatFolders[0]?.value,
      options: [
        { label: "", isCorrect: true },
        { label: "", isCorrect: false },
        { label: "", isCorrect: false },
        { label: "", isCorrect: false },
      ],
      blanks: [
        { label: "", isCorrect: true },
        { label: "", isCorrect: false },
      ],
    });
    setWatchType("MCQ4");
    setOpen(true);
  };

  const openEdit = (row: QRow) => {
    setEditing(row);
    setWatchType(row.type);
    form.setFieldsValue({
      type: row.type,
      content: row.content,
      description: row.description ?? "",
      folderId: row.folder.id,
      options:
        row.options.length > 0
          ? row.options.map((o) => ({ label: o.label, isCorrect: o.isCorrect }))
          : undefined,
      blanks:
        row.blanks.length > 0
          ? row.blanks.map((b) => ({ label: b.label, isCorrect: b.isCorrect }))
          : undefined,
    });
    setOpen(true);
  };

  const save = async () => {
    const values = await form.validateFields();
    const payload = {
      ...(editing ? { id: editing.id } : {}),
      folderId: values.folderId,
      content: values.content,
      description: values.description,
      type: values.type,
      options: values.options,
      blanks: values.blanks,
    };
    const res = await fetch("/api/manager/questions", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const d = await res.json();
    if (!res.ok) {
      message.error(d.error ?? "Lỗi");
      return;
    }
    message.success(editing ? "Cập nhật câu hỏi thành công" : "Thêm câu hỏi thành công");
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    const res = await fetch(`/api/manager/questions?id=${id}`, { method: "DELETE" });
    const d = await res.json();
    if (!res.ok) {
      message.error(d.error ?? "Không thể xóa");
      return;
    }
    message.success("Đã xóa câu hỏi");
    load();
  };

  const downloadTemplate = async (t: QuestionType) => {
    const res = await fetch(`/api/manager/questions/template?type=${t}`);
    if (!res.ok) {
      message.error("Không tải được file mẫu");
      return;
    }
    const blob = await res.blob();
    const cd = res.headers.get("Content-Disposition") ?? "";
    const match = cd.match(/filename="(.+?)"/);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = match?.[1] ?? `mau-${t}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    message.success("Đã tải file mẫu");
  };

  const doImport = async () => {
    if (!file) {
      message.warning("Vui lòng chọn file cần import");
      return;
    }
    if (!importFolder) {
      message.warning("Vui lòng chọn thư mục để import");
      return;
    }
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folderId", importFolder);
      fd.append("type", importType);
      const res = await fetch("/api/manager/questions/import", { method: "POST", body: fd });
      const d = await res.json();
      if (!res.ok) {
        message.error(d.error ?? "Import thất bại");
        return;
      }
      if (d.errors?.length) {
        modal.warning({
          title: `Đã import ${d.created} câu hỏi, ${d.errors.length} dòng lỗi`,
          width: 600,
          content: (
            <ul style={{ maxHeight: 300, overflow: "auto", paddingLeft: 18 }}>
              {d.errors.map((e: { row: number; message: string }, i: number) => (
                <li key={i}>
                  Dòng {e.row}: {e.message}
                </li>
              ))}
            </ul>
          ),
        });
      } else {
        message.success(`Đã import ${d.created} câu hỏi thành công`);
      }
      setImportOpen(false);
      setFile(null);
      load();
    } finally {
      setImporting(false);
    }
  };

  const columns = [
    {
      title: "#",
      key: "idx",
      width: 50,
      render: (_: unknown, __: unknown, index: number) => (page - 1) * 20 + index + 1,
    },
    {
      title: "Nội dung",
      dataIndex: "content",
      key: "content",
      render: (v: string, row: QRow) => (
        <div>
          <Text>{v}</Text>
          {row.description && (
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                <i>{row.description}</i>
              </Text>
            </div>
          )}
          {row.options.length > 0 && (
            <Space wrap size={4} style={{ marginTop: 6 }}>
              {row.options.map((o) => (
                <Tag key={o.id} color={o.isCorrect ? "green" : "default"}>
                  {o.label}
                </Tag>
              ))}
            </Space>
          )}
          {row.blanks.length > 0 && (
            <Space wrap size={4} style={{ marginTop: 6 }}>
              {row.blanks.map((b) => (
                <Tag key={b.id} color={b.isCorrect ? "green" : "default"}>
                  {b.label}
                </Tag>
              ))}
            </Space>
          )}
        </div>
      ),
    },
    {
      title: "Loại",
      dataIndex: "type",
      key: "type",
      width: 170,
      render: (v: string) => <Tag color={TYPE_COLOR[v]}>{TYPE_LABEL[v]}</Tag>,
    },
    {
      title: "Thư mục",
      dataIndex: ["folder", "name"],
      key: "folder",
      width: 160,
    },
    {
      title: "Thao tác",
      key: "action",
      width: 110,
      render: (_: unknown, row: QRow) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)} />
          <Popconfirm
            title="Xóa câu hỏi này?"
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
  ];

  return (
    <div className="page-container">
      <Card
        title="Ngân hàng câu hỏi"
        extra={
          <Space wrap>
            <BulkDeleteButton
              selectedIds={selectedIds}
              endpoint="/api/manager/questions"
              label="câu hỏi"
              onDone={() => {
                setSelectedIds([]);
                load();
              }}
            />
            <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>
              Import từ file
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Thêm câu hỏi
            </Button>
          </Space>
        }
      >
        <Space wrap style={{ marginBottom: 16 }}>
          <Input
            placeholder="Tìm kiếm nội dung..."
            prefix={<SearchOutlined />}
            allowClear
            style={{ width: 240 }}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <Select
            placeholder="Loại câu hỏi"
            allowClear
            style={{ width: 200 }}
            value={type}
            onChange={setType}
            options={Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }))}
          />
          <Select
            placeholder="Thư mục"
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ width: 220 }}
            value={folderId}
            onChange={setFolderId}
            options={flatFolders}
          />
        </Space>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          rowSelection={{
            selectedRowKeys: selectedIds,
            onChange: (keys) => setSelectedIds(keys as string[]),
          }}
          pagination={{
            current: page,
            total,
            pageSize: 20,
            showSizeChanger: false,
            onChange: setPage,
          }}
          locale={{ emptyText: <Empty description="Chưa có câu hỏi nào" /> }}
        />
      </Card>

      {/* Modal thêm/sửa câu hỏi */}
      <Modal
        title={editing ? "Cập nhật câu hỏi" : "Thêm câu hỏi"}
        open={open}
        onOk={save}
        onCancel={() => setOpen(false)}
        okText="Lưu"
        cancelText="Hủy"
        width={720}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="folderId"
                label="Thư mục"
                rules={[{ required: true, message: "Vui lòng chọn thư mục" }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={flatFolders}
                  placeholder="Chọn thư mục"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="type" label="Loại câu hỏi" rules={[{ required: true }]}>
                <Select
                  options={Object.entries(TYPE_LABEL).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                  onChange={(v) => {
                    setWatchType(v);
                    form.setFieldsValue({
                      options:
                        v === "MCQ4"
                          ? [
                              { label: "", isCorrect: true },
                              { label: "", isCorrect: false },
                              { label: "", isCorrect: false },
                              { label: "", isCorrect: false },
                            ]
                          : undefined,
                      blanks:
                        v === "TRUE_FALSE"
                          ? [
                              { label: "", isCorrect: true },
                              { label: "", isCorrect: false },
                            ]
                          : v === "FILL_BLANK"
                            ? [{ label: "", isCorrect: true }]
                            : undefined,
                    });
                  }}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="content"
            label="Nội dung câu hỏi"
            rules={[{ required: true, message: "Vui lòng nhập nội dung" }]}
          >
            <Input.TextArea rows={3} placeholder="Nhập nội dung câu hỏi" />
          </Form.Item>

          {watchType === "MCQ4" && (
            <Form.Item
              name="options"
              label="4 đáp án (chọn 1 đáp án đúng)"
              rules={[
                {
                  validator: (_, v) => {
                    if (!v || v.length !== 4) return Promise.reject("Phải có đúng 4 đáp án");
                    if (v.some((o: { label: string }) => !o.label?.trim()))
                      return Promise.reject("Đáp án không được để trống");
                    if (v.filter((o: { isCorrect: boolean }) => o.isCorrect).length !== 1)
                      return Promise.reject("Phải có đúng 1 đáp án đúng");
                    return Promise.resolve();
                  },
                },
              ]}
            >
              <OptionEditor />
            </Form.Item>
          )}

          {watchType === "TRUE_FALSE" && (
            <Form.Item
              name="blanks"
              label="2 ý (mỗi ý đánh dấu Đúng hoặc Sai)"
              rules={[
                {
                  validator: (_, v) => {
                    if (!v || v.length !== 2) return Promise.reject("Phải có đúng 2 ý");
                    if (v.some((b: { label: string }) => !b.label?.trim()))
                      return Promise.reject("Nội dung ý không được để trống");
                    return Promise.resolve();
                  },
                },
              ]}
            >
              <BlankEditor trueFalse />
            </Form.Item>
          )}

          {watchType === "FILL_BLANK" && (
            <Form.Item
              name="blanks"
              label="Đáp án điền nội dung còn thiếu"
              rules={[
                {
                  validator: (_, v) => {
                    if (!v || v.length < 1) return Promise.reject("Cần ít nhất 1 đáp án");
                    if (v.some((b: { label: string }) => !b.label?.trim()))
                      return Promise.reject("Đáp án không được để trống");
                    return Promise.resolve();
                  },
                },
              ]}
            >
              <BlankEditor />
            </Form.Item>
          )}

          <Form.Item
            name="description"
            label="Trích dẫn / giải thích cho đáp án đúng"
            extra="Nội dung này sẽ được ẩn khi làm bài và chỉ hiển thị khi review lại bài thi."
          >
            <Input.TextArea rows={3} placeholder="VD: Theo Luật Khiếu nại vụ việc hành chính..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal import */}
      <Modal
        title="Import câu hỏi từ file"
        open={importOpen}
        onOk={doImport}
        onCancel={() => setImportOpen(false)}
        okText="Import"
        cancelText="Hủy"
        okButtonProps={{ loading: importing }}
        width={640}
      >
        <Alert
          type="info"
          showIcon
          style={{ margin: "16px 0" }}
          message="Mỗi loại câu hỏi có 1 file template riêng. Hãy tải file mẫu, điền theo đúng định dạng rồi import lên."
        />

        <Form layout="vertical">
          <Form.Item label="Loại câu hỏi">
            <Select
              value={importType}
              onChange={setImportType}
              options={Object.entries(TYPE_LABEL).map(([value, label]) => ({
                value,
                label,
              }))}
              style={{ width: "100%" }}
            />
          </Form.Item>

          <Form.Item label="Thư mục đích">
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Chọn thư mục nhận câu hỏi"
              value={importFolder}
              onChange={setImportFolder}
              options={flatFolders}
              style={{ width: "100%" }}
            />
          </Form.Item>

          <Form.Item label="File mẫu">
            <Button icon={<DownloadOutlined />} onClick={() => downloadTemplate(importType)}>
              Tải file mẫu - {TYPE_LABEL[importType]}
            </Button>
          </Form.Item>

          <Form.Item label="File cần import">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              style={{ width: "100%" }}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

/** Editor cho 4 đáp án trắc nghiệm: chỉ 1 đáp án đúng. */
function OptionEditor() {
  return (
    <div>
      <Form.List name="options">
        {(fields, { add, remove }) => (
          <>
            {fields.map((field, index) => (
              <Row gutter={8} key={field.key} align="middle" style={{ marginBottom: 8 }}>
                <Col span={2}>
                  <Text strong>{String.fromCharCode(65 + index)}.</Text>
                </Col>
                <Col span={16}>
                  <Form.Item
                    {...field}
                    name={[field.name, "label"]}
                    noStyle
                    rules={[{ required: true, message: "Nhập đáp án" }]}
                  >
                    <Input placeholder={`Đáp án ${String.fromCharCode(65 + index)}`} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item
                    {...field}
                    name={[field.name, "isCorrect"]}
                    valuePropName="checked"
                    noStyle
                  >
                    <Checkbox>Đáp án đúng</Checkbox>
                  </Form.Item>
                </Col>
              </Row>
            ))}
            {fields.length < 4 && (
              <Button size="small" onClick={() => add({ label: "", isCorrect: false })}>
                Thêm đáp án
              </Button>
            )}
          </>
        )}
      </Form.List>
    </div>
  );
}

/** Editor cho các ý (đúng/sai hoặc điền trống). */
function BlankEditor({ trueFalse = false }: { trueFalse?: boolean }) {
  return (
    <div>
      <Form.List name="blanks">
        {(fields, { add, remove }) => (
          <>
            {fields.map((field, index) => (
              <Row gutter={8} key={field.key} align="middle" style={{ marginBottom: 8 }}>
                <Col span={2}>
                  <Text strong>Ý {index + 1}:</Text>
                </Col>
                <Col span={16}>
                  <Form.Item
                    {...field}
                    name={[field.name, "label"]}
                    noStyle
                    rules={[{ required: true, message: "Nhập nội dung" }]}
                  >
                    <Input
                      placeholder={
                        trueFalse ? "Nội dung ý (đánh dấu Đúng/Sai)" : "Đáp án đúng"
                      }
                    />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  {trueFalse ? (
                    <Form.Item
                      {...field}
                      name={[field.name, "isCorrect"]}
                      valuePropName="checked"
                      noStyle
                    >
                      <Checkbox>Ý này Đúng</Checkbox>
                    </Form.Item>
                  ) : (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      đáp án đúng
                    </Text>
                  )}
                </Col>
                {fields.length > (trueFalse ? 2 : 1) && (
                  <Col span={1}>
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => remove(field.name)}
                    />
                  </Col>
                )}
              </Row>
            ))}
            <Button size="small" onClick={() => add({ label: "", isCorrect: true })}>
              Thêm ý
            </Button>
          </>
        )}
      </Form.List>
    </div>
  );
}
