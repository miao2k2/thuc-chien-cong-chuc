"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, Table, Tag, Typography, Space, Button, Empty, Spin } from "antd";
import { EyeOutlined } from "@ant-design/icons";

const { Text } = Typography;

type Attempt = {
  id: string;
  title: string;
  durationMin: number | null;
  startedAt: string;
  submittedAt: string | null;
  totalScore: number;
  correctCount: number;
  wrongCount: number;
};

export default function HistoryPage() {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/client/history")
      .then((r) => r.json())
      .then((d) => setAttempts(d.attempts ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page-container">
      <Card title="Lịch sử làm bài">
        {loading ? (
          <div style={{ textAlign: "center", padding: 30 }}>
            <Spin />
          </div>
        ) : attempts.length === 0 ? (
          <Empty description="Bạn chưa làm bài thi nào" />
        ) : (
          <Table
            rowKey="id"
            dataSource={attempts}
            pagination={{ pageSize: 20, showSizeChanger: false }}
            columns={[
              {
                title: "Bài thi",
                dataIndex: "title",
                key: "title",
                render: (v: string, row: Attempt) => (
                  <Space direction="vertical" size={0}>
                    <Text strong>{v}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Bắt đầu: {new Date(row.startedAt).toLocaleString("vi-VN")}
                      {row.submittedAt &&
                        ` • Nộp: ${new Date(row.submittedAt).toLocaleString("vi-VN")}`}
                    </Text>
                  </Space>
                ),
              },
              {
                title: "Thời gian",
                dataIndex: "durationMin",
                key: "duration",
                width: 110,
                render: (v: number | null) => (v ? `${v} phút` : "—"),
              },
              {
                title: "Kết quả",
                key: "result",
                width: 240,
                render: (_: unknown, row: Attempt) =>
                  row.submittedAt ? (
                    <Space>
                      <Tag
                        color={
                          row.totalScore >= 80 ? "green" : row.totalScore >= 50 ? "orange" : "red"
                        }
                      >
                        {row.totalScore}%
                      </Tag>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {row.correctCount} đúng / {row.wrongCount} sai
                      </Text>
                    </Space>
                  ) : (
                    <Tag color="processing">Đang làm</Tag>
                  ),
              },
              {
                title: "",
                key: "action",
                width: 130,
                render: (_: unknown, row: Attempt) =>
                  row.submittedAt ? (
                    <Link href={`/client/review/${row.id}`}>
                      <Button size="small" icon={<EyeOutlined />}>
                        Review
                      </Button>
                    </Link>
                  ) : (
                    <Link href={`/client/attempt/${row.id}`}>
                      <Button size="small" type="primary">
                        Tiếp tục
                      </Button>
                    </Link>
                  ),
              },
            ]}
          />
        )}
      </Card>
    </div>
  );
}
