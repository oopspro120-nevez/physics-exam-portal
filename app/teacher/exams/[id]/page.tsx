import Link from 'next/link';
import { CheckCircle2, Circle } from 'lucide-react';
import { teacherExam, overview } from '@/services/data';
import { PageHead, Badge, fmt, Empty } from '@/components/ui';
import { ActionButton } from '@/components/mutations';
import { FileUpload, FileLink } from '@/components/file-upload';
import { ExamForm } from '@/components/exams/exam-form';
import { ProblemForm } from '@/components/exams/problem-form';
import { EditorState, PublishExam } from '@/components/exams/editor-state';
import { MathText } from '@/components/math';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [d, o] = await Promise.all([teacherExam(id, 'editor'), overview(['classes'])]);
  const e = d.exam,
    c = o.classes.find((c) => c.id === e.class_id);
  const pdf = d.files.find((f) => f.ready && f.path === e.pdf_path);
  const draft = e.status === 'draft';
  const total = d.problems.reduce((s, p) => s + Number(p.points), 0);
  const missingKeys = d.problems.filter(
    (p) =>
      ['numeric', 'text'].includes(p.answer_type) &&
      !d.keys.find((k) => k.problem_id === p.id)?.correct_answer?.trim(),
  );
  const checks = [
    { ok: !!c, text: `Lớp nhận đề: ${c?.name || 'Chưa chọn'}`, href: '#settings' },
    { ok: !!pdf, text: pdf ? 'PDF đã tải và xác minh' : 'Cần tải PDF đề thi', href: '#pdf' },
    {
      ok: d.problems.length > 0,
      text: d.problems.length
        ? `${d.problems.length} câu · ${total} điểm`
        : 'Cần thêm ít nhất một câu hỏi',
      href: '#questions',
    },
    {
      ok: missingKeys.length === 0,
      text: missingKeys.length
        ? `Câu ${missingKeys.map((p) => p.problem_number).join(', ')} còn thiếu đáp án`
        : 'Đáp án chấm tự động đã đủ',
      href: '#questions',
    },
    {
      ok: Date.parse(e.end_time) > Date.now(),
      text:
        Date.parse(e.end_time) > Date.now()
          ? 'Hạn cuối còn hiệu lực'
          : 'Hạn cuối đã qua, cần sửa lịch',
      href: '#settings',
    },
  ];
  const nextNumber = Math.max(0, ...d.problems.map((p) => p.problem_number)) + 1;
  return (
    <EditorState>
      <PageHead
        title={e.title}
        description={`${c?.name || ''} · ${fmt(e.start_time)} — ${fmt(e.end_time)}`}
        action={
          <Badge color={draft ? '' : 'green'}>
            {draft ? 'Bản nháp' : e.status === 'closed' ? 'Đã đóng' : 'Đã giao'}
          </Badge>
        }
      />
      <nav className="tabs" aria-label="Quản lý kỳ thi">
        <span className="tab active">Soạn & giao đề</span>
        <Link className="tab" href={`/teacher/exams/${id}/grading`} prefetch={false}>
          Tiến độ & chấm bài
        </Link>
        <Link className="tab" href={`/teacher/exams/${id}/clarifications`} prefetch={false}>
          Giải đáp & thông báo
        </Link>
      </nav>
      {draft && (
        <nav className="editor-steps" aria-label="Các bước ra đề">
          <a href="#settings">
            <b>1</b>Thông tin
          </a>
          <a href="#pdf">
            <b>2</b>PDF đề thi
          </a>
          <a href="#questions">
            <b>3</b>Câu hỏi & điểm
          </a>
          <a href="#review">
            <b>4</b>Kiểm tra & giao
          </a>
        </nav>
      )}
      <div className="exam-editor-grid">
        <div className="stack">
          <section className="card" id="pdf">
            <div className="card-header">
              <h2>PDF đề thi</h2>
              {pdf && <Badge color="green">Sẵn sàng</Badge>}
            </div>
            {pdf && (
              <div className="section-gap">
                <FileLink id={pdf.id} name={pdf.name} />
              </div>
            )}
            {draft ? (
              <FileUpload
                bucket="exams"
                examId={id}
                label={pdf ? 'Thay PDF đề thi' : 'Chọn hoặc kéo PDF vào đây'}
              />
            ) : (
              !pdf && <Empty title="Chưa có PDF" />
            )}
          </section>
          <section className="card" id="questions">
            <div className="card-header">
              <h2>Câu hỏi & thang điểm</h2>
              <Badge>
                {d.problems.length} câu · {total} điểm
              </Badge>
            </div>
            <p className="small muted">
              Đánh số theo đề PDF. Chọn cách học sinh trả lời và điểm của từng câu.
            </p>
            {d.problems.map((p) => (
              <details key={p.id} className="problem-row">
                <summary>
                  <strong>Câu {p.problem_number}</strong> ·{' '}
                  <MathText text={p.title || 'Chưa đặt tiêu đề'} />
                  <span className="problem-points">{p.points} điểm</span>
                </summary>
                <div className="section-gap">
                  {draft ? (
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
                          confirmation={`Xóa câu ${p.problem_number} khỏi bản nháp?`}
                        >
                          Xóa câu này
                        </ActionButton>
                      </div>
                    </>
                  ) : (
                    <p className="small muted">Đề đã giao. Nội dung và đáp án chấm được khóa.</p>
                  )}
                  <details className="section-gap">
                    <summary>Lời giải tham khảo</summary>
                    <div className="section-gap">
                      <FileUpload
                        bucket="solutions"
                        examId={id}
                        problemId={p.id}
                        label="Tải lời giải PDF hoặc ảnh"
                      />
                    </div>
                  </details>
                </div>
              </details>
            ))}
            {draft && (
              <details className="section-gap" open={!d.problems.length}>
                <summary className="text-link">+ Thêm câu {nextNumber}</summary>
                <div className="section-gap">
                  <ProblemForm key={'new-' + nextNumber} examId={id} number={nextNumber} />
                </div>
              </details>
            )}
          </section>
          {draft && (
            <details className="card" id="settings">
              <summary>Sửa thông tin, lớp và lịch làm bài</summary>
              <div className="section-gap">
                <ExamForm classes={o.classes} exam={e} />
              </div>
            </details>
          )}
        </div>
        <aside className="card exam-review" id="review">
          <h2>{draft ? 'Kiểm tra trước khi giao' : 'Thông tin kỳ thi'}</h2>
          {draft && (
            <ul className="publish-checks">
              {checks.map((item) => (
                <li key={item.text}>
                  <a href={item.href}>
                    {item.ok ? (
                      <CheckCircle2 size={19} className="check-ok" />
                    ) : (
                      <Circle size={19} />
                    )}
                    <span>{item.text}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
          <dl className="review-facts">
            <dt>Thời lượng</dt>
            <dd>{e.duration} phút</dd>
            <dt>Mở đề</dt>
            <dd>{fmt(e.start_time)}</dd>
            <dt>Hạn cuối</dt>
            <dd>{fmt(e.end_time)}</dd>
            <dt>Hình thức</dt>
            <dd>
              {e.scoring_mode === 'EXAM'
                ? 'Kiểm tra · một lần nộp'
                : e.scoring_mode === 'CHALLENGE'
                  ? 'Thử thách'
                  : 'Luyện tập'}
            </dd>
          </dl>
          {draft ? (
            <>
              <PublishExam
                id={id}
                ready={checks.every((item) => item.ok)}
                confirmation={`Giao “${e.title}” cho ${c?.name}? Đề có ${d.problems.length} câu, tổng ${total} điểm. Mở lúc ${fmt(e.start_time)}. Sau khi giao, cấu trúc đề và đáp án chấm được khóa.`}
              />
              <p className="small muted section-gap">
                Học sinh chỉ mở PDF từ giờ mở đề. Điểm chỉ hiển thị khi giáo viên công bố kết quả.
              </p>
            </>
          ) : (
            e.status === 'published' && (
              <ActionButton
                action="exam_close"
                payload={{ id }}
                danger
                confirmation="Đóng kỳ thi ngay? Học sinh sẽ không thể nộp thêm."
              >
                Đóng kỳ thi
              </ActionButton>
            )
          )}
        </aside>
      </div>
    </EditorState>
  );
}
