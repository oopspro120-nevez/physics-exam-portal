import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
export const messages: Record<string, string> = {
  SETUP_REQUIRED: 'Hệ thống chưa được kết nối. Vui lòng liên hệ quản trị viên.',
  UNAUTHORIZED: 'Vui lòng đăng nhập lại.',
  SESSION_EXPIRED:
    'Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại; bản nháp đã lưu vẫn được giữ.',
  FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
  DEVICE_DENIED:
    'Tài khoản đang được dùng trên thiết bị khác. Hãy đăng xuất ở thiết bị đó; nếu không thể truy cập, liên hệ giáo viên để đặt lại thiết bị.',
  EXAM_LOCKED: 'Chỉ có thể sửa đề thi ở trạng thái bản nháp.',
  EXAM_SCHEDULE_PAST: 'Hạn cuối đã qua. Hãy sửa lịch trước khi giao đề.',
  EXAM_INCOMPLETE: 'Cần tải PDF và thêm ít nhất một Problem trước khi mở đề.',
  EXAM_NOT_OPEN: 'Kỳ thi chưa mở hoặc đã đóng.',
  TIME_EXPIRED: 'Đã hết thời gian làm bài.',
  ATTEMPTS_EXHAUSTED: 'Đã hết lượt nộp cho bài này.',
  INVALID_NUMBER: 'Nhập số hợp lệ, ví dụ 3,5 hoặc 3.5e-4.',
  SOLUTION_REQUIRED: 'Hãy tải lời giải trước khi nộp.',
  INVALID_FILES: 'Tệp không hợp lệ hoặc chưa tải lên hoàn tất.',
  RESULTS_REQUIRE_EXAM_END: 'Chỉ công bố kết quả sau khi kết thúc kỳ thi.',
  CLOSE_EXAM_BEFORE_RESULTS: 'Hãy đóng kỳ thi trước khi công bố kết quả.',
  INVALID_SCORE: 'Điểm tự luận vượt phần điểm được cấu hình.',
  ANSWER_KEY_REQUIRED: 'Hãy nhập đáp án chuẩn cho các bài chấm tự động.',
  INVALID_TEACHER: 'Hãy chọn giáo viên đang hoạt động.',
  ALREADY_FINISHED: 'Bạn đã kết thúc bài thi.',
  INVALID_ANSWER: 'Hãy nhập đáp án trước khi nộp.',
  PAYLOAD_TOO_LARGE: 'Dữ liệu gửi lên vượt giới hạn.',
  CLARIFICATION_RATE_LIMIT: 'Bạn đang gửi câu hỏi quá nhanh. Hãy đợi một phút.',
  FILE_UPLOAD_LIMIT: 'Đã đạt giới hạn tải tệp trong giờ này. Vui lòng liên hệ giáo viên.',
};
export function fail(error: unknown) {
  if (error instanceof ZodError)
    return NextResponse.json(
      { error: error.issues.map((i) => i.message).join('. ') },
      { status: 400 },
    );
  const key = error instanceof Error ? error.message : '';
  const known = Object.keys(messages).find((k) => key.includes(k));
  if (!known) console.error('Portal request failed', key);
  return NextResponse.json(
    {
      error: known
        ? messages[known]
        : 'Không thể thực hiện. Vui lòng thử lại hoặc liên hệ quản trị viên.',
    },
    {
      headers: { 'Cache-Control': 'private, no-store' },
      status:
        known === 'UNAUTHORIZED' || known === 'SESSION_EXPIRED'
          ? 401
          : known === 'FORBIDDEN' || known === 'DEVICE_DENIED'
            ? 403
            : known === 'SETUP_REQUIRED'
              ? 503
              : 400,
    },
  );
}
export function checkOrigin(req: Request) {
  const origin = req.headers.get('origin');
  const allowed = process.env.APP_URL || new URL(req.url).origin;
  if (!origin || origin !== new URL(allowed).origin) throw new Error('FORBIDDEN');
}
export async function readJson(req: Request) {
  const limit = 1024 * 1024;
  if (Number(req.headers.get('content-length') || 0) > limit || !req.body)
    throw new Error('PAYLOAD_TOO_LARGE');
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new Error('PAYLOAD_TOO_LARGE');
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const merged = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(new TextDecoder().decode(merged));
}
export function checked<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
