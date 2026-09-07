export default function Loading() {
  return (
    <div role="status" className="stack">
      <p>Đang tải dữ liệu…</p>
      <div aria-hidden="true" className="loading-bars">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
