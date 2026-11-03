"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, List, Button, Tag, Space, Typography, Empty, Alert, Spin } from "antd";
import { PlayCircleOutlined, ClockCircleOutlined, FileTextOutlined } from "@ant-design/icons";

const { Text, Title } = Typography;

type Exam = {
  id: string;
  name: string;
  description: string | null;
  durationMin: number | null;
  mode: string;
  rules: { quantity: number; type: string | null; folder: { name: string } | null }[];
  _count: { items: number };
};

export default function ClientExamsPage() {
  const router = useRouter();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/client/catalog")
      .then((r) => r.json())
      .then((d) => setExams(d.exams ?? []))
      .finally(() => setLoading(false));
  }, []);

  const startExam = async (exam: Exam) => {
    setStarting(exam.id);
    try {
      const res = await fetch("/api/client/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examTemplateId: exam.id, title: exam.name }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Không thể bắt đầu bài thi");
        return;
      }
      router.push(`/client/attempt/${data.attemptId}`);
    } finally {
      setStarting(null);
    }
  };

  return (
    <div className="page-container">
      <Title level={3}>Bài thi có sẵn</Title>
      <Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
        Chọn một bài thi để bắt đầu. Thời gian tính từ khi bạn mở bài thi.
      </Text>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40 }}>
          <Spin size="large" />
        </div>
      ) : exams.length === 0 ? (
        <Card>
          <Empty description="Chưa có bài thi nào được công bố" />
        </Card>
      ) : (
        <List<Exam>
          dataSource={exams}
          grid={{ gutter: 16, xs: 1, sm: 1, md: 2, lg: 2, xl: 3 }}
          renderItem={(exam) => (
            <List.Item>
              <Card
                style={{ width: "100%", height: "100%" }}
                title={
                  <Space>
                    <FileTextOutlined />
                    {exam.name}
                  </Space>
                }
                actions={[
                  <Button
                    key="start"
                    type="primary"
                    icon={<PlayCircleOutlined />}
                    loading={starting === exam.id}
                    onClick={() => startExam(exam)}
                  >
                    Bắt đầu làm bài
                  </Button>,
                ]}
              >
                {exam.description && (
                  <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
                    {exam.description}
                  </Text>
                )}
                <Space direction="vertical" size={6} style={{ width: "100%" }}>
                  <div>
                    <Tag color="blue">
                      <ClockCircleOutlined />{" "}
                      {exam.durationMin ? `${exam.durationMin} phút` : "Không giới hạn"}
                    </Tag>
                    <Tag color="cyan">
                      {exam.mode === "FIXED" ? "Chỉ định câu hỏi" : "Ngẫu nhiên"}
                    </Tag>
                  </div>
                  {exam.rules.length > 0 && (
                    <div style={{ fontSize: 12 }}>
                      <Text type="secondary">Cấu trúc đề: </Text>
                      {exam.rules.map((r, i) => (
                        <Tag key={i} style={{ marginBottom: 4 }}>
                          {r.folder?.name ?? "Tất cả"}: {r.quantity} câu
                          {r.type ? ` ${shortType(r.type)}` : ""}
                        </Tag>
                      ))}
                    </div>
                  )}
                  {exam.mode === "FIXED" && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Tổng {exam._count.items} câu hỏi được chỉ định
                    </Text>
                  )}
                </Space>
              </Card>
            </List.Item>
          )}
        />
      )}
    </div>
  );
}

function shortType(t: string) {
  if (t === "MCQ4") return "trắc nghiệm";
  if (t === "TRUE_FALSE") return "đúng sai";
  return "điền trống";
}
