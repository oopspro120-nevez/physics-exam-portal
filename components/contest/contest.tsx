'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Clock, Check, Radio, FileText, Bell, Maximize2, RefreshCw } from 'lucide-react';
import type { ContestData, Status } from '@/types/domain';
import { contestPost } from '@/lib/hooks/use-draft';
import { fileUrl, FileLink } from '@/components/file-upload';
import { ProblemPanel } from './problem-panel';
import { fmt } from '@/components/ui';
const labels: Record<Status, string> = {
  UNSOLVED: 'Chưa làm',
  ATTEMPTED: 'Đã thử',
  SOLVED: 'Đã giải',
  SUBMITTED: 'Đã nộp',
  REVIEWED: 'Đã chấm',
};
export function Contest({ initial, studentId }: { initial: ContestData; studentId: string }) {
  const [data, setData] = useState(initial),
    [selected, setSelected] = useState(initial.problems[0]?.id || ''),
    [url, setUrl] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [remaining, setRemaining] = useState(() =>
      initial.session
        ? Math.max(0, Date.parse(initial.session.deadline) - Date.parse(initial.server_time))
        : 0,
    ),
    [tab, setTab] = useState<'pdf' | 'answer'>('answer');
  const anchor = useRef({ server: Date.parse(initial.server_time), mono: 0 });
  const [fresh, setFresh] = useState(true);
  const refreshing = useRef(false);
  const refresh = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    try {
      const r = await fetch('/api/contest?id=' + initial.exam.id, {
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      anchor.current = { server: Date.parse(d.server_time), mono: performance.now() };
      setRemaining(
        d.session ? Math.max(0, Date.parse(d.session.deadline) - Date.parse(d.server_time)) : 0,
      );
      setData(d);
      setFresh(true);
      setSelected((s) => s || d.problems[0]?.id || '');
    } finally {
      refreshing.current = false;
    }
  }, [initial.exam.id]);
  useEffect(() => {
    anchor.current = { server: Date.parse(initial.server_time), mono: performance.now() };
  }, [initial.server_time]);
  useEffect(() => {
    const tick = setInterval(() => {
      const now = anchor.current.server + (performance.now() - anchor.current.mono);
      setRemaining(data.session ? Math.max(0, Date.parse(data.session.deadline) - now) : 0);
      if (performance.now() - anchor.current.mono > 65000) setFresh(false);
    }, 1000);
    return () => clearInterval(tick);
  }, [data.session?.deadline]);
  useEffect(() => {
    const reload = () =>
      refresh().catch((e) => {
        setFresh(false);
        if (e.message?.includes('đăng nhập') || e.message?.includes('thiết bị'))
          setError(e.message);
      });
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) reload();
    }, 20000);
    const visible = () => {
      if (document.visibilityState === 'visible') reload();
    };
    window.addEventListener('online', reload);
    document.addEventListener('visibilitychange', visible);
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', reload);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [refresh]);
  const pdf = data.files.find((f) => f.bucket === 'exams' && f.path === data.exam.pdf_path);
  const loadPdf = useCallback(async () => {
    if (!pdf) return;
    try {
      setUrl(await fileUrl(pdf.id));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể mở PDF.');
    }
  }, [pdf?.id]);
  useEffect(() => {
    loadPdf();
  }, [loadPdf]);
  const p = data.problems.find((p) => p.id === selected),
    e = data.exam;
  const deadlinePassed =
    !!data.session && Date.parse(data.server_time) >= Date.parse(data.session.deadline);
  const canSubmit =
    !!data.session &&
    !data.session.finished_at &&
    e.status === 'published' &&
    (remaining > 0 || e.allow_late_submission) &&
    (!deadlinePassed || e.allow_late_submission);
  const totalSeconds = Math.ceil(remaining / 1000);
  const timer = `${Math.floor(totalSeconds / 3600)
    .toString()
    .padStart(2, '0')}:${Math.floor((totalSeconds % 3600) / 60)
    .toString()
    .padStart(2, '0')}:${(totalSeconds % 60).toString().padStart(2, '0')}`;
  function status(pid: string): Status {
    const ss = data.submissions.filter((s) => s.problem_id === pid);
    if (ss.some((s) => s.status === 'SOLVED')) return 'SOLVED';
    return ss.at(-1)?.status || 'UNSOLVED';
  }
  const completed = new Set(data.submissions.map((s) => s.problem_id)).size;
  return (
    <div className="contest">
      <div className="contest-heading">
        <div>
          <Link href="/student/exams" className="small muted">
            ← Kỳ thi của tôi
          </Link>
          <h1>{e.title}</h1>
          <div className="row small muted">
            <span>{e.scoring_mode}</span>
            <span>·</span>
            <span>{e.duration} phút</span>
            <span>·</span>
            <span>
              {completed}/{data.problems.length} bài đã nộp
            </span>
          </div>
        </div>
        <div className={'timer ' + (remaining < 300000 && data.session ? 'timer-alert' : '')}>
          <span className="small">
            <Clock size={15} /> THỜI GIAN CÒN LẠI
          </span>
          <strong className="mono">{data.session ? timer : '— : — : —'}</strong>
          <small>{fresh ? 'Đồng bộ giờ máy chủ' : 'Đang chờ đồng bộ giờ'}</small>
        </div>
      </div>
      {error && (
        <p role="alert" className="notice danger" style={{ marginBottom: 18 }}>
          {error}
        </p>
      )}
      {data.announcements.length > 0 && (
        <div className="announcement-bar" aria-live="polite">
          <Bell size={18} />
          <div>
            <strong>Thông báo từ giáo viên</strong>
            <p>{data.announcements[0].content}</p>
            {data.announcements.length > 1 && (
              <details>
                <summary>{data.announcements.length - 1} thông báo trước</summary>
                {data.announcements.slice(1).map((a) => (
                  <p key={a.id}>
                    {fmt(a.created_at)} · {a.content}
                  </p>
                ))}
              </details>
            )}
          </div>
        </div>
      )}
      {!data.session ? (
        <section className="card start-exam">
          <FileText size={36} color="var(--cyan)" />
          <h2>Sẵn sàng bắt đầu?</h2>
          <p>
            Thời lượng làm bài là <strong>{e.duration} phút</strong>, tính từ lúc bạn bắt đầu và
            không vượt quá hạn cuối {fmt(e.end_time)}.
          </p>
          <p className="muted small">
            Đáp án chỉ được ghi nhận sau khi máy chủ xác nhận. Mỗi Problem có lượt nộp riêng.
          </p>
          <button
            className="button primary"
            disabled={
              busy ||
              e.status !== 'published' ||
              Date.parse(data.server_time) < Date.parse(e.start_time) ||
              (!e.allow_late_submission && Date.parse(data.server_time) > Date.parse(e.end_time))
            }
            onClick={async () => {
              setBusy(true);
              try {
                await contestPost({ action: 'start', exam_id: e.id });
                await refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Không thể bắt đầu.');
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? 'Đang bắt đầu...' : 'Bắt đầu làm bài'}
          </button>
        </section>
      ) : (
        <>
          {(data.session.finished_at ||
            e.status === 'closed' ||
            (remaining === 0 && !e.allow_late_submission)) && (
            <p className="notice" style={{ marginBottom: 18 }}>
              Phiên làm bài đã kết thúc. Các lần nộp đã được máy chủ xác nhận vẫn được giữ lại.
              {e.publish_result && (
                <>
                  {' '}
                  <Link className="text-link" href={'/student/results/' + e.id}>
                    Xem kết quả →
                  </Link>
                </>
              )}
            </p>
          )}
          {remaining === 0 &&
            e.allow_late_submission &&
            !data.session.finished_at &&
            e.status === 'published' && (
              <p className="notice" style={{ marginBottom: 18 }}>
                Đã hết giờ. Giáo viên cho phép nộp muộn; các lần nộp mới sẽ được đánh dấu.
              </p>
            )}
          <div className="contest-mobile-tabs">
            <button
              className={'tab ' + (tab === 'pdf' ? 'active' : '')}
              onClick={() => setTab('pdf')}
            >
              PDF đề thi
            </button>
            <button
              className={'tab ' + (tab === 'answer' ? 'active' : '')}
              onClick={() => setTab('answer')}
            >
              Trả lời Problems
            </button>
          </div>
          <div className="contest-grid">
            <section className={'pdf-pane ' + (tab === 'pdf' ? 'mobile-show' : 'mobile-hide')}>
              <div className="pdf-toolbar">
                <span className="row">
                  <FileText size={17} />
                  PDF đề thi
                </span>
                <div className="row">
                  <button className="icon-button" aria-label="Tải lại PDF" onClick={loadPdf}>
                    <RefreshCw size={16} />
                  </button>
                  {pdf && <FileLink id={pdf.id} name="Mở rộng" />}
                </div>
              </div>
              {url ? (
                <iframe
                  src={url + '#toolbar=1&navpanes=0'}
                  title="PDF đề thi Vật lý"
                  className="pdf-frame"
                />
              ) : (
                <div className="empty">{pdf ? 'Đang mở đề thi...' : 'Không có PDF khả dụng.'}</div>
              )}
              <div className="pdf-footnote">
                Nếu PDF không hiển thị trên điện thoại, chọn “Mở rộng”.
              </div>
            </section>
            <div className={'problems-pane ' + (tab === 'answer' ? 'mobile-show' : 'mobile-hide')}>
              <div className="problem-nav">
                <div className="row between">
                  <strong className="small">DANH SÁCH BÀI</strong>
                  <span className="small muted">
                    {completed}/{data.problems.length}
                  </span>
                </div>
                <div className="problem-buttons">
                  {data.problems.map((pr) => {
                    const st = status(pr.id);
                    return (
                      <button
                        key={pr.id}
                        onClick={() => {
                          setSelected(pr.id);
                          setTab('answer');
                        }}
                        title={`Problem ${pr.problem_number}: ${labels[st]}`}
                        aria-label={`Problem ${pr.problem_number}: ${labels[st]}`}
                        aria-pressed={selected === pr.id}
                        className={
                          'problem-button ' +
                          (selected === pr.id ? 'selected ' : '') +
                          st.toLowerCase()
                        }
                      >
                        {String(pr.problem_number).padStart(2, '0')}
                        {st === 'SOLVED' ? (
                          <Check size={12} />
                        ) : st !== 'UNSOLVED' ? (
                          <Radio size={11} />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                <div className="problem-legend">
                  <span>○ Chưa làm</span>
                  <span>● Đã nộp / đã thử</span>
                  <span>✓ Đã giải</span>
                </div>
              </div>
              {p && (
                <ProblemPanel
                  key={p.id}
                  problem={p}
                  data={data}
                  studentId={studentId}
                  canSubmit={canSubmit}
                  onRefresh={refresh}
                />
              )}
            </div>
          </div>
          {!data.session.finished_at && (
            <div className="contest-finish">
              <span className="small muted">
                Chỉ những đáp án đã nộp mới được chấm. Bản nháp chưa nộp không tính là bài làm.
              </span>
              <button
                className="button"
                disabled={busy}
                onClick={async () => {
                  if (
                    !window.confirm(
                      'Kết thúc bài thi? Bạn không thể nộp thêm sau thao tác này. Bản nháp chưa nộp sẽ không được chấm.',
                    )
                  )
                    return;
                  setBusy(true);
                  try {
                    await contestPost({ action: 'finish', exam_id: e.id });
                    await refresh();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : 'Không thể kết thúc.');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Kết thúc làm bài
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
