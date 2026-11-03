/**
 * Parse danh sách id từ query string cho các API xóa hàng loạt.
 * Hỗ trợ:
 *   ?id=abc                 -> ["abc"]
 *   ?ids=abc                -> ["abc"]
 *   ?ids=abc,def            -> ["abc", "def"]
 *   ?ids=abc&ids=def        -> ["abc", "def"]
 */
export function parseIds(values: (string | null | undefined)[]): string[] {
  const out = values
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .flatMap((v) => v.split(","))
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
  return Array.from(new Set(out));
}

/** Lấy toàn bộ tham số `ids` (có thể lặp) cộng với `id` từ URL. */
export function collectIds(searchParams: URLSearchParams): string[] {
  return parseIds([...searchParams.getAll("ids"), searchParams.get("id")]);
}
