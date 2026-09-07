export default function NotFound() {
  return (
    <main className="page">
      <section className="card">
        <p className="eyebrow">404</p>
        <h1>Không tìm thấy trang</h1>
        <p className="muted">Trang không tồn tại hoặc bạn không có quyền truy cập.</p>
        <a className="button primary" href="/login">
          Về trang đăng nhập
        </a>
      </section>
    </main>
  );
}
