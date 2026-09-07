'use client';
import { useEffect, useState } from 'react';
import { Send, MessageSquare, CheckCircle2, WifiOff } from 'lucide-react';
import type { Problem, ContestData, Asset, Submission } from '@/types/domain';
import { useDraft, contestPost } from '@/lib/hooks/use-draft';
import { SolutionUpload } from './solution-upload';
import { MathText } from '@/components/math';
import { FileLink } from '@/components/file-upload';
import { fmt } from '@/components/ui';
export function ProblemPanel({
  problem: p,
  data,
  studentId,
  canSubmit,
  onRefresh,
}: {
  problem: Problem;
  data: ContestData;
  studentId: string;
  canSubmit: boolean;
  onRefresh: () => Promise<void>;
}) {
  const prefix = `physics:${studentId}:${data.exam.id}:${p.id}`;
  const draft = useDraft(
    prefix + ':draft',
    p.id,
    data.drafts.find((d) => d.problem_id === p.id),
    canSubmit,
  );
  const [uploading, setUploading] = useState(false),
    [files, setFiles] = useState<Asset[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [pending, setPending] = useState<Record<string, unknown> | null>(null);
  const history = data.submissions.filter((s) => s.problem_id === p.id);
  const limit = data.exam.scoring_mode === 'EXAM' ? 1 : p.max_attempts;
  const remaining = limit === null || history.length < limit;
  useEffect(() => {
    try {
      const ids = JSON.parse(localStorage.getItem(prefix + ':files') || '[]') as string[];
      setFiles(ids.map((id) => data.files.find((f) => f.id === id)).filter((f): f is Asset => !!f));
      const saved = localStorage.getItem(prefix + ':pending');
      if (saved) setPending(JSON.parse(saved));
    } catch {}
  }, [prefix]);
  function changeFiles(next: Asset[]) {
    setFiles(next);
    try {
      localStorage.setItem(prefix + ':files', JSON.stringify(next.map((f) => f.id)));
    } catch {
      setError('Không lưu được thứ tự tệp trên thiết bị.');
    }
  }
  async function submit() {
    setBusy(true);
    setError('');
    setMessage('');
    const body = pending || {
      action: 'submit',
      problem_id: p.id,
      answer: draft.answer,
      unit: draft.unit,
      file_ids: files.map((f) => f.id),
      request_id: crypto.randomUUID(),
    };
    try {
      localStorage.setItem(prefix + ':pending', JSON.stringify(body));
      setPending(body);
      await contestPost(body);
      localStorage.removeItem(prefix + ':pending');
      setPending(null);
      setMessage('Máy chủ đã xác nhận lần nộp.');
      await onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa nhận được xác nhận từ máy chủ.');
    } finally {
      setBusy(false);
    }
  }
  const ownQuestions = data.clarifications.filter((c) => c.problem_id === p.id);
  return (
    <section className="answer-panel">
      <div className="row between">
        <p className="eyebrow" style={{ margin: 0 }}>
          PROBLEM {String(p.problem_number).padStart(2, '0')}
        </p>
        <span className="badge">{p.points} điểm</span>
      </div>
      <h2 style={{ margin: '12px 0 8px' }}>
        <MathText text={p.title || 'Bài toán ' + p.problem_number} />
      </h2>
      <p className="small muted">
        Lượt nộp {Math.min(history.length + 1, limit || Infinity)} / {limit || '∞'} ·{' '}
        {p.answer_type === 'file_only'
          ? 'Nộp lời giải'
          : p.answer_type === 'essay'
            ? 'Tự luận'
            : p.answer_type === 'numeric'
              ? 'Đáp án số'
              : 'Đáp án văn bản'}
      </p>
      <div className="stack">
        {p.answer_type !== 'file_only' && (
          <label>
            Đáp án của bạn
            {p.answer_type === 'essay' ? (
              <textarea
                value={draft.answer}
                onChange={(e) => draft.edit('answer', e.target.value)}
                disabled={!canSubmit || busy}
                maxLength={20000}
                rows={6}
              />
            ) : (
              <input
                value={draft.answer}
                onChange={(e) => draft.edit('answer', e.target.value)}
                disabled={!canSubmit || busy}
                maxLength={p.answer_type === 'numeric' ? 80 : 1000}
                placeholder={p.answer_type === 'numeric' ? 'Ví dụ: 3,5 hoặc 3.5e-4' : 'Nhập đáp án'}
              />
            )}
          </label>
        )}
        {p.unit && (
          <label>
            Đơn vị yêu cầu: {p.unit}
            <input
              value={draft.unit}
              onChange={(e) => draft.edit('unit', e.target.value)}
              disabled={!canSubmit || busy}
              maxLength={80}
              placeholder={p.unit}
            />
            <span className="small muted">Nhập giá trị theo đúng đơn vị trên.</span>
          </label>
        )}
        <div className="small muted row" role="status">
          {draft.online ? <CheckCircle2 size={14} /> : <WifiOff size={14} />}{' '}
          {draft.online ? draft.status : 'Offline · Bản nháp lưu trên thiết bị'}
        </div>
        {draft.conflict && (
          <div className="notice">
            <p>Tab khác đã cập nhật bản nháp này. Chọn bản muốn giữ:</p>
            <div className="row">
              <button className="button compact" onClick={() => draft.resolve(false)}>
                Giữ bản đang nhập
              </button>
              <button className="button compact" onClick={() => draft.resolve(true)}>
                Dùng bản trên máy chủ
              </button>
            </div>
          </div>
        )}
        <div className="divider" style={{ margin: 0 }} />
        <div className="row between">
          <h3 style={{ margin: 0 }}>Lời giải trình bày</h3>
          <span className="small muted">
            {p.require_solution || p.answer_type === 'file_only' ? 'Bắt buộc' : 'Không bắt buộc'}
          </span>
        </div>
        <SolutionUpload
          examId={data.exam.id}
          problemId={p.id}
          files={files}
          onChange={changeFiles}
          onBusy={setUploading}
          disabled={!canSubmit || busy}
        />
        {pending && (
          <div className="notice">
            Một lần nộp đang chờ xác nhận. “Gửi lại” sử dụng đúng đáp án và tệp của lần nộp đó.
          </div>
        )}
        {message && (
          <p className="notice success" role="status">
            {message}
          </p>
        )}
        {error && (
          <p className="notice danger" role="alert">
            {error}
          </p>
        )}
        <button
          className="button primary full"
          onClick={submit}
          disabled={busy || uploading || !draft.online || (!pending && (!canSubmit || !remaining))}
        >
          <Send size={16} />
          {busy
            ? 'Đang xác nhận...'
            : pending
              ? 'Gửi lại lần nộp chờ xác nhận'
              : !remaining
                ? 'Đã dùng hết lượt nộp'
                : 'Nộp đáp án & lời giải'}
        </button>
        {pending && (
          <button
            className="button compact"
            onClick={() => {
              if (
                window.confirm(
                  'Bỏ yêu cầu đang chờ trên thiết bị? Bài đã được máy chủ nhận (nếu có) vẫn được giữ.',
                )
              ) {
                localStorage.removeItem(prefix + ':pending');
                setPending(null);
                onRefresh();
              }
            }}
          >
            Bỏ yêu cầu chờ trên thiết bị
          </button>
        )}
        <details>
          <summary className="text-link small row">
            <MessageSquare size={16} />
            Yêu cầu giải đáp
          </summary>
          <form
            className="stack section-gap"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              setBusy(true);
              setError('');
              try {
                await contestPost({
                  action: 'ask',
                  problem_id: p.id,
                  question: new FormData(form).get('question'),
                });
                form.reset();
                await onRefresh();
                setMessage('Đã gửi câu hỏi đến giáo viên.');
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Không thể gửi câu hỏi.');
              } finally {
                setBusy(false);
              }
            }}
          >
            <textarea
              name="question"
              required
              maxLength={2000}
              placeholder="Nêu phần đề cần làm rõ..."
            />
            <button className="button" disabled={busy || !canSubmit || !draft.online}>
              Gửi câu hỏi
            </button>
          </form>
          {ownQuestions.map((c) => (
            <div key={c.id} className="question-thread">
              <p>{c.question}</p>
              <small className="muted">{fmt(c.created_at)}</small>
              <p className="teacher-reply">{c.answer || 'Đang chờ giáo viên trả lời.'}</p>
            </div>
          ))}
        </details>
        <details>
          <summary className="small">Lịch sử nộp ({history.length})</summary>
          {history.length ? (
            history.map((s: Submission) => (
              <div className="question-thread" key={s.id}>
                <div className="row between">
                  <strong className="small">Lần {s.attempt_number}</strong>
                  <span className="badge">{s.status}</span>
                </div>
                <p className="history-answer">
                  {s.answer || 'Lời giải dạng tệp'} {s.unit}
                </p>
                <p className="small muted">
                  {fmt(s.submitted_at)}
                  {s.is_late ? ' · Nộp muộn' : ''}
                </p>
                {data.attachments
                  .filter((a) => a.submission_id === s.id)
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((a) => data.files.find((f) => f.id === a.file_id))
                  .filter((f): f is Asset => !!f)
                  .map((f) => (
                    <FileLink key={f.id} id={f.id} name={f.name} />
                  ))}
              </div>
            ))
          ) : (
            <p className="small muted section-gap">Chưa có lần nộp nào.</p>
          )}
        </details>
      </div>
    </section>
  );
}
