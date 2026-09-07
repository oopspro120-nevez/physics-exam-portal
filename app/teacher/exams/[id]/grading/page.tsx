import Link from 'next/link';
import { teacherExam, overview } from '@/services/data';
import { PageHead, Stat, Empty, fmt, Badge } from '@/components/ui';
import { ActionButton, ManagedForm } from '@/components/mutations';
import { AssetViewer } from '@/components/asset-viewer';
import { AutoRefresh } from '@/components/auto-refresh';
import { bestSubmission, totalScore, formatScore } from '@/utils/scoring';
import { MathText } from '@/components/math';
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ student?: string; problem?: string }>;
}) {
  const { id } = await params,
    q = await searchParams;
  const [d, o] = await Promise.all([teacherExam(id), overview()]);
  const members = new Set(
    o.members.filter((m) => m.class_id === d.exam.class_id).map((m) => m.student_id),
  );
  const students = o.profiles.filter((p) => members.has(p.id));
  const selected = students.find((p) => p.id === q.student);
  const rows = d.submissions.filter(
    (s) => s.student_id === selected?.id && (!q.problem || s.problem_id === q.problem),
  );
  const total = d.problems.reduce((s, p) => s + Number(p.points), 0);
  return (
    <>
      <PageHead
        title="Tiến độ & chấm bài"
        description={d.exam.title}
        action={
          <ActionButton
            action="publish_result"
            payload={{ id, publish: !d.exam.publish_result }}
            confirmation={
              d.exam.publish_result
                ? 'Ẩn kết quả đối với học sinh?'
                : 'Công bố điểm, nhận xét và đáp án cho học sinh?'
            }
          >
            {d.exam.publish_result ? 'Ẩn kết quả' : 'Công bố kết quả'}
          </ActionButton>
        }
      />
      <div className="tabs">
        <Link className="tab" href={`/teacher/exams/${id}`}>
          Đề & cấu hình
        </Link>
        <span className="tab active">Tiến độ & chấm bài</span>
        <Link className="tab" href={`/teacher/exams/${id}/clarifications`}>
          Giải đáp & thông báo
        </Link>
      </div>
      <div className="stats">
        <Stat label="Đã bắt đầu" value={`${d.sessions.length} / ${students.length}`} />
        <Stat
          label="Đã có bài nộp"
          value={`${new Set(d.submissions.map((s) => s.student_id)).size} / ${students.length}`}
        />
        <Stat label="Đã kết thúc làm bài" value={d.sessions.filter((s) => s.finished_at).length} />
        <Stat
          label="Lượt cần chấm"
          value={
            d.submissions.filter(
              (s) =>
                s.manual_score === null &&
                d.problems.some(
                  (p) => p.id === s.problem_id && Number(p.points) > Number(p.auto_points),
                ),
            ).length
          }
        />
      </div>
      <section className="card">
        <div className="card-header">
          <h2>Bảng tiến độ</h2>
          <AutoRefresh />
        </div>
        <p className="muted small">
          Chọn ô bài để xem đáp án và lịch sử. Tổng điểm lấy lần nộp có điểm cao nhất của từng
          Problem, tối đa {total} điểm.
        </p>
        {students.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Học sinh</th>
                  {d.problems.map((p) => (
                    <th className="score-cell" key={p.id}>
                      P{p.problem_number}
                    </th>
                  ))}
                  <th>Điểm</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => {
                  const attempts = d.submissions.filter((a) => a.student_id === s.id);
                  const session = d.sessions.find((x) => x.student_id === s.id);
                  return (
                    <tr key={s.id}>
                      <td>
                        <Link className="text-link" href={`?student=${s.id}`}>
                          {s.full_name}
                        </Link>
                      </td>
                      {d.problems.map((p) => {
                        const a = bestSubmission(attempts.filter((a) => a.problem_id === p.id));
                        return (
                          <td className="score-cell" key={p.id}>
                            <Link href={`?student=${s.id}&problem=${p.id}`}>
                              <Badge
                                color={
                                  a?.status === 'SOLVED' || a?.status === 'REVIEWED'
                                    ? 'green'
                                    : a
                                      ? 'amber'
                                      : ''
                                }
                              >
                                {a ? formatScore(a.final_score) : '—'}
                              </Badge>
                            </Link>
                          </td>
                        );
                      })}
                      <td className="mono">
                        <strong>{formatScore(totalScore(attempts))}</strong>
                      </td>
                      <td>
                        <Badge color={session?.finished_at ? 'green' : session ? 'cyan' : ''}>
                          {session?.finished_at
                            ? 'Đã kết thúc'
                            : session
                              ? 'Đang làm'
                              : 'Chưa bắt đầu'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Lớp chưa có học sinh" />
        )}
      </section>
      {selected && (
        <section className="section-gap">
          <PageHead
            title={selected.full_name}
            description={
              q.problem ? 'Lịch sử của Problem đã chọn' : 'Toàn bộ các lần nộp trong kỳ thi'
            }
            action={
              <Link className="button" href={`/teacher/exams/${id}/grading`}>
                Đóng chi tiết
              </Link>
            }
          />
          {!rows.length && <Empty title="Học sinh chưa nộp bài này" />}
          {rows.map((s) => {
            const p = d.problems.find((p) => p.id === s.problem_id)!;
            const attachments = d.attachments
              .filter((a) => a.submission_id === s.id)
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((a) => d.files.find((f) => f.id === a.file_id))
              .filter((f): f is NonNullable<typeof f> => !!f);
            const multiplier = Number(s.score_multiplier ?? 1);
            return (
              <article className="card section-gap" key={s.id}>
                <div className="card-header">
                  <h2>
                    Problem {p.problem_number} · Lần {s.attempt_number}
                  </h2>
                  <Badge color={s.is_late ? 'amber' : 'cyan'}>
                    {s.is_late ? 'Nộp muộn' : s.status}
                  </Badge>
                </div>
                <div className="review-grid">
                  <div>
                    <p>
                      <MathText text={p.title} />
                    </p>
                    <p className="history-answer">
                      <strong>Đáp án:</strong> {s.answer || 'Lời giải dạng tệp'} {s.unit}
                    </p>
                    <p className="small muted">Nộp lúc {fmt(s.submitted_at)}</p>
                    <AssetViewer files={attachments} />
                  </div>
                  <div>
                    <div className="stats" style={{ gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <Stat label="Tự động" value={formatScore(s.auto_score)} />
                      <Stat label="Tổng lượt này" value={formatScore(s.final_score)} />
                    </div>
                    <ManagedForm action="grade" payload={{ id: s.id }} label="Lưu điểm & nhận xét">
                      <label>
                        Điểm tự luận (0–{Number(p.points) - Number(p.auto_points)})
                        <input
                          name="manual_score"
                          type="number"
                          min={0}
                          max={Number(p.points) - Number(p.auto_points)}
                          step="0.001"
                          required
                          defaultValue={
                            s.manual_score === null
                              ? ''
                              : multiplier > 0
                                ? Number(s.manual_score) / multiplier
                                : 0
                          }
                        />
                      </label>
                      <p className="small muted" style={{ margin: 0 }}>
                        Hệ số lượt nộp: {multiplier * 100}%. Máy chủ áp dụng hệ số này vào điểm tự
                        luận khi lưu.
                      </p>
                      <label>
                        Nhận xét
                        <textarea
                          name="comment"
                          maxLength={4000}
                          rows={5}
                          defaultValue={s.comment || ''}
                        />
                      </label>
                    </ManagedForm>
                  </div>
                </div>
              </article>
            );
          })}
          <section className="card section-gap">
            <h3>Câu hỏi của học sinh</h3>
            {d.clarifications
              .filter((c) => c.student_id === selected.id)
              .map((c) => (
                <div className="question-thread" key={c.id}>
                  <p>{c.question}</p>
                  <p className="teacher-reply">{c.answer || 'Chưa trả lời'}</p>
                </div>
              ))}
            <Link className="text-link small" href={`/teacher/exams/${id}/clarifications`}>
              Mở trang giải đáp →
            </Link>
          </section>
        </section>
      )}
    </>
  );
}
