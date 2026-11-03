"use client";

import { Card, Row, Col, Button, Typography, Space, Tag } from "antd";
import Link from "next/link";
import {
  FileTextOutlined,
  PlusCircleOutlined,
  BookOutlined,
  HistoryOutlined,
  RightOutlined,
} from "@ant-design/icons";

const { Title, Paragraph, Text } = Typography;

export type RecentAttempt = {
  id: string;
  title: string;
  totalScore: number;
  correctCount: number;
  wrongCount: number;
};

export type ClientHomeStats = {
  examCount: number;
  questionCount: number;
  attemptCount: number;
  role: string;
};

export function ClientHomeView({
  userName,
  stats,
  history,
}: {
  userName: string;
  stats: ClientHomeStats;
  history: RecentAttempt[];
}) {
  return (
    <div className="page-container">
      <Card style={{ marginBottom: 24 }}>
        <Row align="middle" gutter={[24, 16]}>
          <Col flex="auto">
            <Title level={3} style={{ marginTop: 0, marginBottom: 4 }}>
              Xin chào, {userName}
            </Title>
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              Chào mừng bạn đến với hệ thống làm bài kiểm tra trực tuyến. Chọn bài thi có sẵn
              hoặc tự tạo bài theo nhu cầu của bạn.
            </Paragraph>
          </Col>
          <Col>
            <Space>
              <Link href="/client/exams">
                <Button type="primary" icon={<FileTextOutlined />} size="large">
                  Làm bài thi có sẵn
                </Button>
              </Link>
              <Link href="/client/create">
                <Button icon={<PlusCircleOutlined />} size="large">
                  Tạo bài thi
                </Button>
              </Link>
            </Space>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} md={6}>
          <Card>
            <StatisticBlock
              title="Bài thi có sẵn"
              value={stats.examCount}
              icon={<FileTextOutlined />}
              color="#1677ff"
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <StatisticBlock
              title="Tổng câu hỏi"
              value={stats.questionCount}
              icon={<BookOutlined />}
              color="#52c41a"
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <StatisticBlock
              title="Bài đã nộp"
              value={stats.attemptCount}
              icon={<HistoryOutlined />}
              color="#faad14"
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <StatisticBlock
              title="Vai trò"
              value={stats.role}
              icon={<RightOutlined />}
              color="#722ed1"
            />
          </Card>
        </Col>
      </Row>

      <Card title="Bài thi gần đây" extra={<Link href="/client/history">Xem tất cả</Link>}>
        {history.length === 0 ? (
          <Text type="secondary">Bạn chưa nộp bài thi nào.</Text>
        ) : (
          history.map((h) => (
            <div
              key={h.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 0",
                borderBottom: "1px solid #f0f0f0",
              }}
            >
              <Space>
                <Text strong>{h.title}</Text>
                <Tag color={h.totalScore >= 80 ? "green" : h.totalScore >= 50 ? "orange" : "red"}>
                  {h.totalScore}%
                </Tag>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {h.correctCount} đúng / {h.wrongCount} sai
                </Text>
              </Space>
              <Link href={`/client/review/${h.id}`}>
                <Button size="small" type="link">
                  Xem lại <RightOutlined />
                </Button>
              </Link>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}

function StatisticBlock({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          background: `${color}1a`,
          color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {title}
        </Text>
      </div>
    </div>
  );
}
