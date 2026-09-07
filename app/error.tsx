'use client';
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="card" style={{ margin: 30 }}>
      <h2>Chưa thể tải dữ liệu</h2>
      <p>Vui lòng kiểm tra kết nối và thử lại. Nếu lỗi tiếp diễn, hãy liên hệ quản trị viên.</p>
      <button className="button primary" onClick={reset}>
        Thử lại
      </button>
      <a className="button" style={{ marginLeft: 12 }} href="/login">
        Về đăng nhập
      </a>
    </div>
  );
}
