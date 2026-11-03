"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  Form,
  InputNumber,
  Select,
  Button,
  Space,
  Typography,
  Row,
  Col,
  Table,
  Input,
  Tag,
  Alert,
  Divider,
} from "antd";
import { PlusOutlined, DeleteOutlined, PlayCircleOutlined } from "@ant-design/icons";

const { Title, Text } = Typography;

type FolderNode = {
  id: string;
  name: string;
  children: FolderNode[];
  questionCount: number;
};

const TYPES = [
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

export default function CreateExamPage() {
  const router = useRouter();
  const [tree, setTree] = useState<FolderNode[]>([]);
  const [rules, setRules] = useState<Rule[]>([
    { key: "r0", type: "MCQ4", quantity: 10 },
    { key: "r1", type: "TRUE_FALSE", quantity: 10 },
    { key: "r2", type: "FILL_BLANK", quantity: 10 },
  ]);
  const [durationMin, setDurationMin] = useState<number>(30);
  const [title, setTitle] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/client/catalog")
      .then((r) => r.json())
      .then((d) => setTree(d.tree ?? []))
      .catch(() => {});
  }, []);

  const folderOptions = useMemo(() => {
    const out: { value: string; label: string }[] = [];
    const walk = (nodes: FolderNode[], depth: number) => {
      for (const n of nodes) {
        out.push({ value: n.id, label: `${"　".repeat(depth)}${n.name}` });
        if (n.children?.length) walk(n.children, depth + 1);
      }
    };
    walk(tree, 0);
    return out;
  }, [tree]);

  const totalQuestions = rules.reduce((s, r) => s + (r.quantity || 0), 0);

  const submit = async () => {
    setError(null);
    if (totalQuestions === 0) {
      setError("Vui lòng chọn ít nhất 1 câu hỏi");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/client/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || `Bài kiểm tra ${new Date().toLocaleString("vi-VN")}`,
          durationMin: durationMin || null,
          rules: rules.map((r) => ({
            folderId: r.folderId ?? null,
            type: r.type ?? null,
            quantity: r.quantity,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Không thể tạo bài thi");
        return;
      }
      router.push(`/client/attempt/${data.attemptId}`);
    } catch {
      setError("Không kết nối được máy chủ");
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      title: "Thư mục",
      key: "folder",
      render: (_: unknown, r: Rule) => (
        <Select
          placeholder="Tất cả thư mục"
          allowClear
          showSearch
          optionFilterProp="label"
          style={{ width: "100%" }}
          value={r.folderId}
          onChange={(v) =>
            setRules((prev) => prev.map((x) => (x.key === r.key ? { ...x, folderId: v } : x)))
          }
          options={folderOptions}
        />
      ),
    },
    {
      title: "Loại câu hỏi",
      key: "type",
      width: 200,
      render: (_: unknown, r: Rule) => (
        <Select
          style={{ width: "100%" }}
          value={r.type}
          onChange={(v) =>
            setRules((prev) => prev.map((x) => (x.key === r.key ? { ...x, type: v } : x)))
          }
          options={TYPES}
          allowClear
          placeholder="Tất cả loại"
        />
      ),
    },
    {
      title: "Số câu",
      key: "quantity",
      width: 120,
      render: (_: unknown, r: Rule) => (
        <InputNumber
          min={0}
          max={200}
          value={r.quantity}
          onChange={(v) =>
            setRules((prev) => prev.map((x) => (x.key === r.key ? { ...x, quantity: v ?? 0 } : x)))
          }
          style={{ width: "100%" }}
        />
      ),
    },
    {
      title: "",
      key: "action",
      width: 50,
      render: (_: unknown, r: Rule) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => setRules((prev) => prev.filter((x) => x.key !== r.key))}
        />
      ),
    },
  ];

  return (
    <div className="page-container">
      <Title level={3}>Tạo bài thi</Title>
      <Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
        Chọn số lượng câu hỏi theo từng loại và danh sách thư mục chứa câu hỏi. Hệ thống sẽ lấy ngẫu nhiên.
      </Text>

      {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card title="Cấu trúc đề thi">
            <Table
              rowKey="key"
              columns={columns}
              dataSource={rules}
              pagination={false}
              size="middle"
            />
            <Divider style={{ margin: "12px 0" }} />
            <Button
              icon={<PlusOutlined />}
              onClick={() =>
                setRules((prev) => [
                  ...prev,
                  { key: `r${Date.now()}`, type: "MCQ4", quantity: 10 },
                ])
              }
            >
              Thêm dòng
            </Button>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="Thiết lập bài thi">
            <Space direction="vertical" style={{ width: "100%" }} size={16}>
              <div>
                <Text strong>Tên bài thi</Text>
                <Input
                  style={{ marginTop: 6 }}
                  placeholder="VD: Kiểm tra giữa kỳ"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div>
                <Text strong>Thời gian (phút)</Text>
                <InputNumber
                  style={{ width: "100%", marginTop: 6 }}
                  min={1}
                  max={600}
                  value={durationMin}
                  onChange={(v) => setDurationMin(v ?? 0)}
                />
              </div>
              <Divider style={{ margin: 0 }} />
              <div>
                <Text type="secondary">Tổng số câu hỏi</Text>
                <div style={{ fontSize: 30, fontWeight: 700, color: "#1677ff" }}>
                  {totalQuestions}
                </div>
              </div>
              <Button
                type="primary"
                size="large"
                block
                icon={<PlayCircleOutlined />}
                loading={submitting}
                onClick={submit}
              >
                Bắt đầu làm bài
              </Button>
              <Tag color="blue" style={{ textAlign: "center", padding: "6px 0" }}>
                Câu hỏi được lấy ngẫu nhiên từ các thư mục đã chọn
              </Tag>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
