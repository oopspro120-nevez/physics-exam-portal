import Link from 'next/link';
import { teacherExam, overview } from '@/services/data';
import { PageHead, Empty, Badge, fmt } from '@/components/ui';
import { ManagedForm } from '@/components/mutations';
import { AutoRefresh } from '@/components/auto-refresh';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await teacherExam(id, 'discussion');
  const o = await overview(['profiles', 'members'], d.exam.class_id);
  return (
    <>
      <PageHead title="Giải đáp & thông báo" description={d.exam.title} action={<AutoRefresh />} />
      <div className="tabs">
        <Link className="tab" href={`/teacher/exams/${id}`}>
          Đề & cấu hình
        </Link>
        <Link className="tab" href={`/teacher/exams/${id}/grading`}>
          Tiến độ & chấm bài
        </Link>
        <span className="tab active">Giải đáp & thông báo</span>
      </div>
      <div className="grid2">
        <section className="stack">
          <div className="row between">
            <h2 style={{ margin: 0 }}>Câu hỏi từ học sinh</h2>
            <Badge color="amber">
              {d.clarifications.filter((c) => !c.answer).length} chờ trả lời
            </Badge>
          </div>
          {!d.clarifications.length && (
            <Empty title="Chưa có câu hỏi" description="Yêu cầu giải đáp sẽ xuất hiện tại đây." />
          )}
          {d.clarifications.map((c) => (
            <article className="card" key={c.id}>
              <div className="row between">
                <strong>
                  {o.profiles.find((p) => p.id === c.student_id)?.full_name || 'Học sinh'}
                </strong>
                <Badge color={c.answer ? 'green' : 'amber'}>
                  {c.answer ? 'Đã trả lời' : 'Chờ trả lời'}
                </Badge>
              </div>
              <p className="small muted">
                Problem {d.problems.find((p) => p.id === c.problem_id)?.problem_number} ·{' '}
                {fmt(c.created_at)}
              </p>
              <p>{c.question}</p>
              <ManagedForm action="reply" payload={{ id: c.id }} label="Gửi trả lời">
                <label>
                  Nội dung trả lời
                  <textarea name="answer" required maxLength={4000} defaultValue={c.answer || ''} />
                </label>
                <label className="check">
                  <input type="checkbox" name="publish" />
                  Công bố câu trả lời thành thông báo cho cả lớp
                </label>
                <p className="small muted" style={{ margin: 0 }}>
                  Mặc định trả lời riêng. Khi công bố, chỉ nội dung trả lời được đưa lên thông báo.
                </p>
              </ManagedForm>
            </article>
          ))}
        </section>
        <section className="stack" style={{ alignContent: 'start' }}>
          <article className="card">
            <h2>Đăng thông báo</h2>
            <ManagedForm action="announce" payload={{ exam_id: id }} label="Đăng cho cả lớp" reset>
              <label>
                Nội dung
                <textarea
                  name="content"
                  required
                  maxLength={4000}
                  placeholder="Ví dụ: Problem 07 có thể bỏ qua lực cản không khí."
                />
              </label>
            </ManagedForm>
          </article>
          <article className="card">
            <h3>Thông báo đã đăng</h3>
            {d.announcements.length ? (
              d.announcements.map((a) => (
                <div className="question-thread" key={a.id}>
                  <p>{a.content}</p>
                  <span className="small muted">{fmt(a.created_at)}</span>
                </div>
              ))
            ) : (
              <p className="small muted">Chưa có thông báo.</p>
            )}
          </article>
        </section>
      </div>
    </>
  );
}
