import Link from 'next/link';
import { teacherExam, overview } from '@/services/data';
import { PageHead, Stat, Badge, fmt, Empty } from '@/components/ui';
import { ActionButton } from '@/components/mutations';
import { FileUpload, FileLink } from '@/components/file-upload';
import { ExamForm } from '@/components/exams/exam-form';
import { ProblemForm } from '@/components/exams/problem-form';
import { MathText } from '@/components/math';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [d, o] = await Promise.all([teacherExam(id), overview()]);
  const e = d.exam,
    c = o.classes.find((c) => c.id === e.class_id);
  const total = o.members.filter((m) => m.class_id === e.class_id).length;
  const submitted = new Set(d.submissions.map((s) => s.student_id)).size;
  const pdf = d.files.find((f) => f.path === e.pdf_path);
  return (
    <>
      <PageHead
        title={e.title}
        description={`${c?.name} · ${fmt(e.start_time)} — ${fmt(e.end_time)}`}
        action={
          <div className="row">
            <Badge color={e.status === 'published' ? 'green' : ''}>
              {e.status === 'draft' ? 'Bản nháp' : e.status === 'closed' ? 'Đã đóng' : 'Đã giao'}
            </Badge>
            {e.status === 'draft' ? (
              <ActionButton
                action="exam_publish"
                payload={{ id }}
                confirmation="Giao kỳ thi cho học sinh? Cấu trúc đề và đáp án sẽ được khóa."
              >
                Giao kỳ thi
              </ActionButton>
            ) : (
              e.status === 'published' && (
                <ActionButton
                  action="exam_close"
                  payload={{ id }}
                  confirmation="Đóng kỳ thi ngay? Học sinh sẽ không thể nộp thêm."
                  danger
                >
                  Đóng kỳ thi
                </ActionButton>
              )
            )}
          </div>
        }
      />
      <div className="stats">
        <Stat label="Đã bắt đầu" value={`${d.sessions.length} / ${total}`} />
        <Stat label="Đã có bài nộp" value={`${submitted} / ${total}`} />
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
        <Stat
          label="Problems"
          value={d.problems.length}
          note={`${d.problems.reduce((s, p) => s + Number(p.points), 0)} điểm tối đa`}
        />
      </div>
      <div className="tabs">
        <span className="tab active">Đề & cấu hình</span>
        <Link className="tab" href={`/teacher/exams/${id}/grading`}>
          Tiến độ & chấm bài
        </Link>
        <Link className="tab" href={`/teacher/exams/${id}/clarifications`}>
          Giải đáp & thông báo
        </Link>
      </div>
      <div className="grid2">
        <section className="card">
          <h2>PDF đề thi</h2>
          {pdf && (
            <div style={{ marginBottom: 20 }}>
              <FileLink id={pdf.id} name={pdf.name} />
            </div>
          )}
          {e.status === 'draft' ? (
            <FileUpload
              bucket="exams"
              examId={id}
              label={pdf ? 'Thay PDF đề thi' : 'Tải PDF chứa toàn bộ đề thi'}
            />
          ) : (
            !pdf && <Empty title="Chưa có PDF" />
          )}
        </section>
        <section className="card">
          <h2>Quy tắc làm bài</h2>
          <div className="stack small">
            <span>
              Chế độ: <strong className="mono">{e.scoring_mode}</strong>
            </span>
            <span>
              Thời lượng: <strong>{e.duration} phút từ lúc học sinh bắt đầu</strong>
            </span>
            <span>
              Nộp muộn:{' '}
              <strong>
                {e.allow_late_submission
                  ? 'Cho phép, ghi nhận thời gian nộp muộn'
                  : 'Không cho phép'}
              </strong>
            </span>
            <span>
              Kết quả: <strong>{e.publish_result ? 'Đã công bố' : 'Chưa công bố'}</strong>
            </span>
          </div>
        </section>
      </div>
      {e.status === 'draft' && (
        <details className="card section-gap">
          <summary>Chỉnh sửa cấu hình kỳ thi</summary>
          <div className="section-gap">
            <ExamForm classes={o.classes} exam={e} />
          </div>
        </details>
      )}
      <section className="card section-gap">
        <div className="card-header">
          <h2>Problems</h2>
          <Badge>{d.problems.length} bài</Badge>
        </div>
        {d.problems.map((p) => (
          <details key={p.id} className="card" style={{ marginBottom: 12, padding: 18 }}>
            <summary>
              <strong className="mono">{String(p.problem_number).padStart(2, '0')}</strong> ·{' '}
              <MathText text={p.title || 'Problem ' + p.problem_number} />{' '}
              <span className="muted small">
                {' '}
                — {p.points} điểm · {p.answer_type}
              </span>
            </summary>
            <div className="section-gap">
              {e.status === 'draft' ? (
                <>
                  <ProblemForm
                    examId={id}
                    number={p.problem_number}
                    problem={p}
                    answerKey={d.keys.find((k) => k.problem_id === p.id)}
                  />
                  <div className="section-gap">
                    <ActionButton
                      action="problem_delete"
                      payload={{ id: p.id }}
                      danger
                      confirmation="Xóa Problem này khỏi đề nháp?"
                    >
                      Xóa Problem
                    </ActionButton>
                  </div>
                </>
              ) : (
                <p className="small muted">Đề đã giao. Cấu trúc Problem và đáp án được khóa.</p>
              )}
              <div className="section-gap">
                <FileUpload
                  bucket="solutions"
                  examId={id}
                  problemId={p.id}
                  label="Tải lời giải tham khảo"
                />
              </div>
            </div>
          </details>
        ))}
        {!d.problems.length && (
          <Empty
            title="Khai báo Problem đầu tiên"
            description="Nhập loại đáp án, dung sai và điểm. Nội dung câu hỏi nằm trong PDF."
          />
        )}
        {e.status === 'draft' && (
          <details className="section-gap" open={!d.problems.length}>
            <summary className="text-link">+ Thêm Problem</summary>
            <div className="section-gap">
              <ProblemForm
                examId={id}
                number={Math.max(0, ...d.problems.map((p) => p.problem_number)) + 1}
              />
            </div>
          </details>
        )}
      </section>
    </>
  );
}
