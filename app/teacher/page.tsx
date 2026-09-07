import Link from 'next/link';
import { overview } from '@/services/data';
import { PageHead, Stat, Empty, Badge, fmt } from '@/components/ui';
export default async function Page() {
  const d = await overview();
  const opened = d.exams.filter(
    (e) =>
      e.status === 'published' &&
      Date.parse(e.start_time) <= Date.now() &&
      (Date.parse(e.end_time) > Date.now() || e.allow_late_submission),
  );
  return (
    <>
      <PageHead
        title="Không gian giáo viên"
        description="Theo dõi lớp học và các kỳ thi đang diễn ra."
        action={
          <Link className="button primary" href="/teacher/exams/new">
            + Tạo kỳ thi
          </Link>
        }
      />
      <div className="stats">
        <Stat label="Lớp phụ trách" value={d.classes.length} />
        <Stat label="Học sinh" value={new Set(d.members.map((m) => m.student_id)).size} />
        <Stat label="Kỳ thi đang mở" value={opened.length} />
        <Stat label="Tổng số kỳ thi" value={d.exams.length} />
      </div>
      <section className="card">
        <div className="card-header">
          <h2>Kỳ thi gần đây</h2>
          <Link className="text-link small" href="/teacher/exams">
            Tất cả kỳ thi
          </Link>
        </div>
        {d.exams.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Kỳ thi</th>
                  <th>Lớp</th>
                  <th>Bắt đầu</th>
                  <th>Trạng thái</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {d.exams.slice(0, 8).map((e) => (
                  <tr key={e.id}>
                    <td>
                      <strong>{e.title}</strong>
                    </td>
                    <td>{d.classes.find((c) => c.id === e.class_id)?.name}</td>
                    <td>{fmt(e.start_time)}</td>
                    <td>
                      <Badge color={e.status === 'published' ? 'green' : ''}>
                        {e.status === 'draft'
                          ? 'Bản nháp'
                          : e.status === 'closed'
                            ? 'Đã đóng'
                            : 'Đã giao'}
                      </Badge>
                    </td>
                    <td>
                      <Link className="text-link" href={'/teacher/exams/' + e.id}>
                        Quản lý →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Chưa có kỳ thi"
            description="Chọn lớp, tải đề PDF và khai báo các Problem để bắt đầu."
          />
        )}
      </section>
    </>
  );
}
