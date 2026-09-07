import Link from 'next/link';
import { Clock, CalendarDays, BookOpen } from 'lucide-react';
import { overview } from '@/services/data';
import { PageHead, Empty, Badge, fmt } from '@/components/ui';
export default async function Page() {
  const d = await overview();
  return (
    <>
      <PageHead
        title="Kỳ thi"
        description="Từ đề thi PDF đến lời giải và kết quả."
        action={
          <Link className="button primary" href="/teacher/exams/new">
            + Tạo kỳ thi
          </Link>
        }
      />
      {d.exams.length ? (
        <div className="grid3">
          {d.exams.map((e) => (
            <Link href={'/teacher/exams/' + e.id} className="card exam-card" key={e.id}>
              <div className="row between">
                <Badge color={e.status === 'published' ? 'green' : ''}>
                  {e.status === 'draft'
                    ? 'Bản nháp'
                    : e.status === 'closed'
                      ? 'Đã đóng'
                      : 'Đã giao'}
                </Badge>
                <span className="small mono muted">{e.scoring_mode}</span>
              </div>
              <h3>{e.title}</h3>
              <div className="exam-meta">
                <span>
                  <BookOpen size={15} />
                  {d.classes.find((c) => c.id === e.class_id)?.name}
                </span>
                <span>
                  <CalendarDays size={15} />
                  {fmt(e.start_time)}
                </span>
                <span>
                  <Clock size={15} />
                  {e.duration} phút
                </span>
              </div>
              <span className="text-link small">Quản lý kỳ thi →</span>
            </Link>
          ))}
        </div>
      ) : (
        <Empty
          title="Chưa có kỳ thi"
          description="Tải một PDF chứa toàn bộ đề. Không cần nhập lại từng câu hỏi."
        />
      )}
    </>
  );
}
