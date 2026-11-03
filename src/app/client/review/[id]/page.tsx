"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Card,
  Table,
  Tag,
  Typography,
  Space,
  Row,
  Col,
  Statistic,
  Progress,
  Empty,
  Spin,
  Alert,
  Divider,
  Tooltip,
  Button,
} from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ArrowLeftOutlined,
  TrophyOutlined,
  FolderOpenOutlined,
} from "@ant-design/icons";
import Link from "next/link";

const { Text, Title } = Typography;

type ReviewQuestion = {
  id: string;
  content: string;
  description: string | null;
  type: string;
  folderId: string;
  folderName: string;
  options: { id: string; label: string; isCorrect: boolean }[];
  blanks: { id: string; label: string; isCorrect: boolean }[];
  answer: {
    selectedOptionId: string | null;
    selectedBlankId: string | null;
    textAnswer: string | null;
    isCorrect: boolean;
  } | null;
};

type PerFolder = {
  folderId: string;
  folderName: string;
  total: number;
  wrong: number;
};

const TYPE_LABEL: Record<string, string> = {
  MCQ4: "Trắc nghiệm 4 đáp án",
  TRUE_FALSE: "Trắc nghiệm đúng sai",
  FILL_BLANK: "Điền nội dung còn thiếu",
};

export default function ReviewPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<{
    attempt: {
      id: string;
      title: string;
      totalScore: number;
      correctCount: number;
      wrongCount: number;
      submittedAt: string | null;
    };
    questions: ReviewQuestion[];
    perFolder: PerFolder[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/client/attempts/review?id=${params.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setData(null);
        } else {
          setData(d);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div className="page-container">
        <Card loading />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page-container">
        <Card>
          <Empty description="Không tìm thấy kết quả bài thi" />
        </Card>
      </div>
    );
  }

  const { attempt, questions, perFolder } = data;

  return (
    <div className="page-container">
      <Space style={{ marginBottom: 16 }}>
        <Link href="/client/history">
          <Button icon={<ArrowLeftOutlined />}>Quay lại lịch sử</Button>
        </Link>
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={8}>
            <Title level={3} style={{ marginTop: 0, marginBottom: 4 }}>
              {attempt.title}
            </Title>
            <Text type="secondary">
              Nộp bài lúc{" "}
              {attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString("vi-VN") : "—"}
            </Text>
          </Col>
          <Col xs={24} md={16}>
            <Row gutter={[12, 12]}>
              <Col xs={8}>
                <Card size="small" className="result-stat-card">
                  <Statistic
                    title="Điểm"
                    value={attempt.totalScore}
                    suffix="%"
                    valueStyle={{ color: attempt.totalScore >= 80 ? "#52c41a" : attempt.totalScore >= 50 ? "#faad14" : "#f5222d" }}
                    prefix={<TrophyOutlined />}
                  />
                </Card>
              </Col>
              <Col xs={8}>
                <Card size="small" className="result-stat-card">
                  <Statistic
                    title="Đúng"
                    value={attempt.correctCount}
                    valueStyle={{ color: "#52c41a" }}
                  />
                </Card>
              </Col>
              <Col xs={8}>
                <Card size="small" className="result-stat-card">
                  <Statistic
                    title="Sai"
                    value={attempt.wrongCount}
                    valueStyle={{ color: "#f5222d" }}
                  />
                </Card>
              </Col>
            </Row>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={9}>
          <Card
            title={
              <Space>
                <FolderOpenOutlined /> Đánh giá theo thư mục
              </Space>
            }
            extra={<Text type="secondary" style={{ fontSize: 12 }}>Sai nhiều nhất xếp trước</Text>}
          >
            {perFolder.length === 0 ? (
              <Empty description="Không có dữ liệu" />
            ) : (
              <Table
                rowKey="folderId"
                size="small"
                pagination={false}
                dataSource={perFolder}
                columns={[
                  {
                    title: "Thư mục",
                    dataIndex: "folderName",
                    key: "folderName",
                    render: (v: string, row: PerFolder) => (
                      <Tooltip title={`${row.wrong}/${row.total} câu sai`}>
                        <div>
                          <Text strong>{v}</Text>
                          <Progress
                            percent={row.total ? Math.round(((row.total - row.wrong) / row.total) * 100) : 0}
                            size="small"
                            status={row.wrong > 0 ? "exception" : "success"}
                            format={() => `${row.wrong} sai`}
                          />
                        </div>
                      </Tooltip>
                    ),
                  },
                  {
                    title: "Tổng",
                    dataIndex: "total",
                    key: "total",
                    width: 70,
                    align: "center",
                  },
                ]}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={15}>
          <Card title="Chi tiết từng câu hỏi">
            {questions.map((q, index) => (
              <div
                key={q.id}
                style={{
                  padding: "14px 0",
                  borderBottom: "1px solid #f0f0f0",
                }}
              >
                <Space style={{ marginBottom: 8 }} wrap>
                  <Tag
                    color={q.answer?.isCorrect ? "green" : "red"}
                    icon={q.answer?.isCorrect ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                  >
                    {q.answer?.isCorrect ? "Đúng" : "Sai"}
                  </Tag>
                  <Text strong>Câu {index + 1}</Text>
                  <Tag color="blue">{TYPE_LABEL[q.type]}</Tag>
                  <Tag>{q.folderName}</Tag>
                </Space>

                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 10 }}>
                  {q.content}
                </div>

                {q.options.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    {q.options.map((o) => {
                      const selected = q.answer?.selectedOptionId === o.id;
                      return (
                        <div
                          key={o.id}
                          style={{
                            padding: "4px 8px",
                            borderRadius: 6,
                            background: o.isCorrect
                              ? "#f6ffed"
                              : selected
                                ? "#fff1f0"
                                : undefined,
                            marginBottom: 4,
                            fontSize: 13,
                          }}
                        >
                          {o.isCorrect ? (
                            <CheckCircleOutlined style={{ color: "#52c41a", marginRight: 6 }} />
                          ) : selected ? (
                            <CloseCircleOutlined style={{ color: "#f5222d", marginRight: 6 }} />
                          ) : (
                            <span style={{ display: "inline-block", width: 14 }} />
                          )}
                          <Text style={{ color: o.isCorrect ? "#389e0d" : selected ? "#cf1322" : undefined }}>
                            {o.label}
                          </Text>
                          {selected && (
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              {" "}
                              (bạn đã chọn)
                            </Text>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {q.blanks.length > 0 && (
                  <div style={{ marginBottom: 8, fontSize: 13 }}>
                    {q.type === "TRUE_FALSE" ? (
                      q.blanks.map((b) => {
                        const selected = q.answer?.selectedBlankId === b.id;
                        return (
                          <div
                            key={b.id}
                            style={{
                              padding: "4px 8px",
                              borderRadius: 6,
                              background: b.isCorrect
                                ? "#f6ffed"
                                : selected
                                  ? "#fff1f0"
                                  : undefined,
                              marginBottom: 4,
                            }}
                          >
                            {b.isCorrect ? (
                              <CheckCircleOutlined style={{ color: "#52c41a", marginRight: 6 }} />
                            ) : selected ? (
                              <CloseCircleOutlined style={{ color: "#f5222d", marginRight: 6 }} />
                            ) : (
                              <span style={{ display: "inline-block", width: 14 }} />
                            )}
                            {b.label}
                            {selected && (
                              <Text type="secondary" style={{ fontSize: 11 }}>
                                {" "}
                                (bạn đã chọn)
                              </Text>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div>
                        <Text type="secondary">Đáp án đúng: </Text>
                        <Text strong style={{ color: "#389e0d" }}>
                          {q.blanks.filter((b) => b.isCorrect).map((b) => b.label).join(", ")}
                        </Text>
                        <br />
                        <Text type="secondary">Bạn trả lời: </Text>
                        <Text
                          strong
                          style={{
                            color: q.answer?.isCorrect ? "#389e0d" : "#cf1322",
                          }}
                        >
                          {q.answer?.textAnswer || "(không trả lời)"}
                        </Text>
                      </div>
                    )}
                  </div>
                )}

                {q.description && (
                  <Alert
                    type="info"
                    showIcon
                    message="Trích dẫn / giải thích"
                    description={q.description}
                    style={{ marginTop: 8 }}
                  />
                )}
              </div>
            ))}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
