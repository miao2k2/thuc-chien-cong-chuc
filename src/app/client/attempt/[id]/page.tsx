"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Card,
  Radio,
  Input,
  Button,
  Space,
  Tag,
  Typography,
  Alert,
  Progress,
  Modal,
  App,
  Badge,
  List,
  Divider,
} from "antd";
import {
  ClockCircleOutlined,
  SendOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";

const { Text, Title } = Typography;

type Question = {
  id: string;
  content: string;
  type: "MCQ4" | "TRUE_FALSE" | "FILL_BLANK";
  folderId: string;
  folderName: string;
  options: { id: string; label: string }[];
  blanks: { id: string; label: string }[];
};

type Answer = {
  questionId: string;
  selectedOptionId?: string | null;
  selectedBlankId?: string | null;
  textAnswer?: string | null;
};

const TYPE_LABEL: Record<string, string> = {
  MCQ4: "Trắc nghiệm 4 đáp án",
  TRUE_FALSE: "Trắc nghiệm đúng sai",
  FILL_BLANK: "Điền nội dung còn thiếu",
};

export default function AttemptPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { message, modal } = App.useApp();

  const [attempt, setAttempt] = useState<{
    id: string;
    title: string;
    durationMin: number | null;
    startedAt: string;
    expiredAt: string | null;
    submittedAt: string | null;
  } | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const submittedRef = useRef(false);

  // load attempt
  useEffect(() => {
    fetch(`/api/client/attempts/${params.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          message.error(d.error);
          router.push("/client/exams");
          return;
        }
        setAttempt(d.attempt);
        setQuestions(d.questions ?? []);
        const map: Record<string, Answer> = {};
        for (const a of d.answers ?? []) map[a.questionId] = a;
        setAnswers(map);
        setLoading(false);
      })
      .catch(() => {
        message.error("Không tải được bài thi");
        setLoading(false);
      });
  }, [params.id, router, message]);

  const submitExam = useCallback(
    async (force = false) => {
      if (submitting || submittedRef.current) return;
      if (!attempt) return;

      // đếm câu chưa trả lời
      const unanswered = questions.filter((q) => {
        const a = answers[q.id];
        if (!a) return true;
        if (q.type === "MCQ4") return !a.selectedOptionId;
        if (q.type === "TRUE_FALSE") return !a.selectedBlankId;
        return !a.textAnswer || !a.textAnswer.trim();
      });

      if (!force && unanswered.length > 0) {
        modal.confirm({
          title: "Còn câu hỏi chưa trả lời",
          icon: <ExclamationCircleOutlined style={{ color: "#faad14" }} />,
          content: (
            <div>
              <p>
                Bạn còn <b style={{ color: "#faad14" }}>{unanswered.length}</b> câu hỏi chưa được
                trả lời. Bạn vẫn muốn nộp bài?
              </p>
              <ul style={{ paddingLeft: 20, marginBottom: 0 }}>
                {unanswered.slice(0, 10).map((q, i) => (
                  <li key={q.id}>
                    Câu {questions.indexOf(q) + 1}: {q.content.slice(0, 70)}
                    {q.content.length > 70 ? "..." : ""}
                    {i === 9 && unanswered.length > 10 ? " ..." : ""}
                  </li>
                ))}
              </ul>
            </div>
          ),
          okText: `Vẫn nộp (${unanswered.length} câu chưa trả lời)`,
          okButtonProps: { danger: true },
          cancelText: "Tiếp tục làm bài",
          onOk: () => submitExam(true),
        });
        return;
      }

      setSubmitting(true);
      submittedRef.current = true;
      try {
        const res = await fetch("/api/client/attempts/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attemptId: attempt.id,
            answers: Object.values(answers),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          submittedRef.current = false;
          message.error(data.error ?? "Nộp bài thất bại");
          return;
        }
        message.success(`Đã nộp bài. Điểm: ${data.totalScore}%`);
        router.push(`/client/review/${attempt.id}`);
      } catch {
        submittedRef.current = false;
        message.error("Không kết nối được máy chủ");
      } finally {
        setSubmitting(false);
      }
    },
    [answers, attempt, questions, submitting, message, modal, router],
  );

  // timer
  useEffect(() => {
    if (!attempt?.expiredAt || submittedRef.current) return;
    const tick = () => {
      const diff = new Date(attempt.expiredAt!).getTime() - Date.now();
      if (diff <= 0) {
        setRemaining(0);
        submitExam(true);
        return;
      }
      setRemaining(Math.floor(diff / 1000));
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [attempt, submitExam]);

  const answeredCount = useMemo(() => {
    let n = 0;
    for (const q of questions) {
      const a = answers[q.id];
      if (!a) continue;
      if (q.type === "MCQ4" && a.selectedOptionId) n++;
      else if (q.type === "TRUE_FALSE" && a.selectedBlankId) n++;
      else if (q.type === "FILL_BLANK" && a.textAnswer?.trim()) n++;
    }
    return n;
  }, [questions, answers]);

  const setAnswer = (questionId: string, patch: Partial<Answer>) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], questionId, ...patch },
    }));
  };

  if (loading) {
    return (
      <div className="page-container">
        <Card loading />
      </div>
    );
  }

  if (!attempt) return null;

  const mm = remaining !== null ? String(Math.floor(remaining / 60)).padStart(2, "0") : "--";
  const ss = remaining !== null ? String(remaining % 60).padStart(2, "0") : "--";
  const urgent = remaining !== null && remaining < 300;

  return (
    <div className="page-container">
      <div className="exam-timer" style={{ marginBottom: 16 }}>
        <Card
          size="small"
          styles={{ body: { padding: "12px 16px" } }}
          style={{ background: urgent ? "#fff2f0" : undefined }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              <Title level={4} style={{ margin: 0 }}>
                {attempt.title}
              </Title>
              <Text type="secondary">
                {questions.length} câu hỏi • Đã trả lời {answeredCount}/{questions.length}
              </Text>
            </div>
            <Space size="large" wrap>
              <Progress
                type="circle"
                size={40}
                percent={questions.length ? Math.round((answeredCount / questions.length) * 100) : 0}
              />
              {attempt.durationMin && (
                <div style={{ textAlign: "center" }}>
                  <Text
                    type={urgent ? "danger" : undefined}
                    style={{ fontSize: 24, fontWeight: 700, fontFamily: "monospace" }}
                  >
                    {mm}:{ss}
                  </Text>
                  <div>
                    <ClockCircleOutlined /> <Text type="secondary">Thời gian còn lại</Text>
                  </div>
                </div>
              )}
              <Button
                type="primary"
                size="large"
                icon={<SendOutlined />}
                loading={submitting}
                onClick={() => submitExam(false)}
              >
                Nộp bài
              </Button>
            </Space>
          </div>
        </Card>
      </div>

      {urgent && (
        <Alert
          type="warning"
          showIcon
          message="Sắp hết thời gian! Hãy nộp bài sớm."
          style={{ marginBottom: 16 }}
        />
      )}

      {questions.map((q, index) => {
        const a = answers[q.id];
        const answered =
          q.type === "MCQ4"
            ? Boolean(a?.selectedOptionId)
            : q.type === "TRUE_FALSE"
              ? Boolean(a?.selectedBlankId)
              : Boolean(a?.textAnswer?.trim());

        return (
          <Card
            key={q.id}
            className="exam-question-card"
            title={
              <Space>
                <Badge
                  status={answered ? "success" : "warning"}
                  text={`Câu ${index + 1}`}
                />
                <Tag color="blue">{TYPE_LABEL[q.type]}</Tag>
                <Tag>{q.folderName}</Tag>
              </Space>
            }
          >
            <div style={{ fontSize: 15, marginBottom: 16, fontWeight: 500 }}>
              {q.content}
            </div>

            {q.type === "MCQ4" && (
              <Radio.Group
                style={{ width: "100%" }}
                value={a?.selectedOptionId}
                onChange={(e) => setAnswer(q.id, { selectedOptionId: e.target.value })}
              >
                <Space direction="vertical" style={{ width: "100%" }} size={8}>
                  {q.options.map((o) => (
                    <Radio key={o.id} value={o.id} style={{ width: "100%" }}>
                      {o.label}
                    </Radio>
                  ))}
                </Space>
              </Radio.Group>
            )}

            {q.type === "TRUE_FALSE" && (
              <Radio.Group
                style={{ width: "100%" }}
                value={a?.selectedBlankId}
                onChange={(e) => setAnswer(q.id, { selectedBlankId: e.target.value })}
              >
                <Space direction="vertical" style={{ width: "100%" }} size={8}>
                  {q.blanks.map((b) => (
                    <Radio key={b.id} value={b.id} style={{ width: "100%" }}>
                      {b.label}
                    </Radio>
                  ))}
                </Space>
              </Radio.Group>
            )}

            {q.type === "FILL_BLANK" && (
              <Input.TextArea
                rows={2}
                placeholder="Nhập đáp án của bạn"
                value={a?.textAnswer ?? ""}
                onChange={(e) => setAnswer(q.id, { textAnswer: e.target.value })}
              />
            )}
          </Card>
        );
      })}

      <Card style={{ marginTop: 8 }}>
        <Space direction="vertical" style={{ width: "100%" }}>
          <Divider style={{ margin: 0 }} />
          <Button
            type="primary"
            size="large"
            block
            icon={<SendOutlined />}
            loading={submitting}
            onClick={() => submitExam(false)}
          >
            Nộp bài thi ({answeredCount}/{questions.length} đã trả lời)
          </Button>
        </Space>
      </Card>
    </div>
  );
}
