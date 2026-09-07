import Link from 'next/link';
import { getContest } from '@/services/student';
import { PageHead, Stat, Empty, fmt, Badge } from '@/components/ui';
import { MathText } from '@/components/math';
import { formatScore, totalScore, bestSubmission } from '@/utils/scoring';
import { AssetViewer } from '@/components/asset-viewer';
import { FileLink } from '@/components/file-upload';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: d } = await getContest(id);
  if (!d.keys)
    return (
      <>
        <PageHead title="Kết quả kỳ thi" description={d.exam.title} />
        <Empty
          title="Kết quả chưa được công bố"
          description="Bạn sẽ xem được điểm và nhận xét khi giáo viên công bố."
          action={
            <Link className="button" href={'/student/exams/' + id}>
              Xem bài đã nộp
            </Link>
          }
        />
      </>
    );
  const max = d.problems.reduce((s, p) => s + Number(p.points), 0);
  return (
    <>
      <PageHead
        title="Kết quả của tôi"
        description={d.exam.title}
        action={
          <Link className="button" href="/student/exams">
            Về danh sách kỳ thi
          </Link>
        }
      />
      <div className="stats">
        <Stat label="Tổng điểm" value={`${formatScore(totalScore(d.submissions))} / ${max}`} />
        <Stat
          label="Problems đã nộp"
          value={`${new Set(d.submissions.map((s) => s.problem_id)).size} / ${d.problems.length}`}
        />
        <Stat label="Số lượt nộp" value={d.submissions.length} />
        <Stat
          label="Lượt đã chấm"
          value={
            d.submissions.filter((s) => s.status === 'REVIEWED' || s.status === 'SOLVED').length
          }
        />
      </div>
      <p className="notice">
        Điểm từng Problem là điểm cao nhất trong các lần nộp. Điểm chưa chấm tự luận được tính bằng
        0 và có thể được giáo viên cập nhật.
      </p>
      {d.problems.map((p) => {
        const attempts = d.submissions.filter((s) => s.problem_id === p.id),
          best = bestSubmission(attempts),
          key = d.keys?.find((k) => k.problem_id === p.id),
          solution = d.files.find((f) => f.bucket === 'solutions' && f.path === key?.solution_path);
        return (
          <section className="card section-gap" key={p.id}>
            <div className="card-header">
              <h2>
                Problem {p.problem_number} · <MathText text={p.title} />
              </h2>
              <Badge color="cyan">
                {formatScore(best?.final_score ?? 0)} / {p.points}
              </Badge>
            </div>
            {key?.correct_answer && (
              <p>
                <strong>Đáp án tham khảo:</strong> <MathText text={key.correct_answer} /> {p.unit}
              </p>
            )}
            {solution && <FileLink id={solution.id} name="Lời giải tham khảo" />}
            {attempts.length ? (
              attempts.map((s) => {
                const files = d.attachments
                  .filter((a) => a.submission_id === s.id)
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((a) => d.files.find((f) => f.id === a.file_id))
                  .filter((f): f is NonNullable<typeof f> => !!f);
                return (
                  <details className="question-thread" key={s.id}>
                    <summary>
                      Lần {s.attempt_number} · {fmt(s.submitted_at)} · {formatScore(s.final_score)}{' '}
                      điểm {s.is_late ? '· Nộp muộn' : ''}
                    </summary>
                    <p className="history-answer">
                      Đáp án đã nộp: {s.answer || 'Tệp lời giải'} {s.unit}
                    </p>
                    <p className="small">
                      Tự động: {formatScore(s.auto_score)} · Tự luận: {formatScore(s.manual_score)}{' '}
                      {s.manual_score === null && Number(p.points) > Number(p.auto_points)
                        ? '(chưa chấm)'
                        : ''}
                    </p>
                    {s.comment && <p className="teacher-reply">Nhận xét: {s.comment}</p>}
                    <AssetViewer files={files} />
                  </details>
                );
              })
            ) : (
              <p className="small muted">Bạn chưa nộp Problem này.</p>
            )}
          </section>
        );
      })}
    </>
  );
}
