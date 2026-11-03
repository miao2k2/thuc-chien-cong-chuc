"use client";

import { useState } from "react";
import { App, Button, Popconfirm } from "antd";
import { DeleteOutlined } from "@ant-design/icons";

type Props = {
  /** Danh sách id đang chọn. */
  selectedIds: string[];
  /** URL endpoint DELETE, ví dụ "/api/manager/exams". */
  endpoint: string;
  /** Tên hiển thị trong câu xác nhận, ví dụ "bài thi". */
  label: string;
  /** Cảnh báo bổ sung trong modal xác nhận. */
  warning?: string;
  /** Gọi lại sau khi xóa xong. */
  onDone?: () => void;
  disabled?: boolean;
};

/**
 * Nút xóa hàng loạt cho các bảng có chức năng chọn nhiều dòng.
 * Gửi `?ids=a,b,c` lên endpoint DELETE.
 */
export default function BulkDeleteButton({
  selectedIds,
  endpoint,
  label,
  warning,
  onDone,
  disabled,
}: Props) {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (selectedIds.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${endpoint}?ids=${encodeURIComponent(selectedIds.join(","))}`,
        { method: "DELETE" },
      );
      const d = await res.json();
      if (!res.ok) {
        message.error(d.error ?? "Không thể xóa");
        return;
      }
      message.success(`Đã xóa ${d.deleted ?? selectedIds.length} ${label}`);
      onDone?.();
    } catch {
      message.error("Lỗi hệ thống");
    } finally {
      setLoading(false);
    }
  };

  if (selectedIds.length === 0) return null;

  return (
    <Popconfirm
      title={`Xóa ${selectedIds.length} ${label}?`}
      description={
        warning ?? "Hành động này không thể hoàn tác. Toàn bộ dữ liệu liên quan sẽ bị xóa."
      }
      okText="Xóa"
      cancelText="Hủy"
      okButtonProps={{ danger: true }}
      onConfirm={handleDelete}
    >
      <Button danger icon={<DeleteOutlined />} loading={loading} disabled={disabled}>
        Xóa đã chọn ({selectedIds.length})
      </Button>
    </Popconfirm>
  );
}
