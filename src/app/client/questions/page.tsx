"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, Table, Tag, Input, Select, Space, Typography, Empty } from "antd";
import {
  SearchOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from "@ant-design/icons";

const { Text } = Typography;

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
  type: string;
  folder: { id: string; name: string };
  options: { id: string; label: string; isCorrect: boolean }[];
  blanks: { id: string; label: string; isCorrect: boolean }[];
};

export default function ClientQuestionsPage() {
  const [data, setData] = useState<QRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [type, setType] = useState<string | undefined>();
  const [folderId, setFolderId] = useState<string | undefined>();
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetch("/api/client/catalog")
      .then((r) => r.json())
      .then((d) => {
        const flat: { id: string; name: string }[] = [];
        const walk = (nodes: any[]) => {
          for (const n of nodes) {
            flat.push({ id: n.id, name: n.name });
            if (n.children?.length) walk(n.children);
          }
        };
        walk(d.tree ?? []);
        setFolders(flat);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const params = new URLSearchParams();
      if (keyword) params.set("keyword", keyword);
      if (type) params.set("type", type);
      if (folderId) params.set("folderId", folderId);
      params.set("pageSize", "200");
      try {
        const res = await fetch(`/api/client/questions?${params.toString()}`);
        const d = await res.json();
        if (res.ok) setData(d.items ?? []);
      } finally {
        setLoading(false);
      }
    };
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [keyword, type, folderId]);

  const columns = useMemo(
    () => [
      {
        title: "#",
        key: "idx",
        width: 50,
        render: (_: unknown, __: unknown, index: number) => index + 1,
      },
      {
        title: "Nội dung",
        dataIndex: "content",
        key: "content",
        render: (v: string, row: QRow) => (
          <div>
            <Text strong>{v}</Text>
            {row.description && (
              <div style={{ marginTop: 6 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  <i>Trích dẫn/giải thích: {row.description}</i>
                </Text>
              </div>
            )}
            {row.options.length > 0 && (
              <div style={{ marginTop: 8 }}>
                {row.options.map((o) => (
                  <div key={o.id} style={{ fontSize: 13 }}>
                    {o.isCorrect ? (
                      <CheckCircleOutlined style={{ color: "#52c41a", marginRight: 6 }} />
                    ) : (
                      <CloseCircleOutlined style={{ color: "#d9d9d9", marginRight: 6 }} />
                    )}
                    <Text
                      style={{
                        color: o.isCorrect ? "#52c41a" : undefined,
                        fontWeight: o.isCorrect ? 600 : 400,
                      }}
                    >
                      {o.label}
                    </Text>
                  </div>
                ))}
              </div>
            )}
            {row.blanks.length > 0 && (
              <div style={{ marginTop: 8, fontSize: 13 }}>
                {row.blanks.map((b) => (
                  <Tag
                    key={b.id}
                    color={b.isCorrect ? "green" : "default"}
                    style={{ marginBottom: 4 }}
                  >
                    {b.label}
                  </Tag>
                ))}
              </div>
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
    ],
    [],
  );

  return (
    <div className="page-container">
      <Card
        title="Danh sách câu hỏi"
        extra={
          <Space wrap>
            <Input
              placeholder="Tìm kiếm nội dung..."
              prefix={<SearchOutlined />}
              allowClear
              style={{ width: 220 }}
              onChange={(e) => setKeyword(e.target.value)}
            />
            <Select
              placeholder="Loại câu hỏi"
              allowClear
              style={{ width: 190 }}
              value={type}
              onChange={setType}
              options={Object.entries(TYPE_LABEL).map(([value, label]) => ({
                value,
                label,
              }))}
            />
            <Select
              placeholder="Thư mục"
              allowClear
              showSearch
              optionFilterProp="label"
              style={{ width: 190 }}
              value={folderId}
              onChange={setFolderId}
              options={folders.map((f) => ({ value: f.id, label: f.name }))}
            />
          </Space>
        }
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={{ pageSize: 20, showSizeChanger: false }}
          locale={{ emptyText: <Empty description="Không có câu hỏi nào" /> }}
        />
      </Card>
    </div>
  );
}
