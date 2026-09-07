'use client';
import Link from 'next/link';
import { useState } from 'react';
import { CalendarDays, Clock, BookOpen } from 'lucide-react';
import type { Exam, Class, ExamSession } from '@/types/domain';
import { Badge, Empty, fmt } from '@/components/ui';
export function StudentExams({
  exams,
  classes,
  sessions,
  progress,
  serverNow,
}: {
  exams: Exam[];
  classes: Class[];
  sessions: ExamSession[];
  progress: { exam_id: string; total: number; completed: number }[];
  serverNow: number;
}) {
  const [tab, setTab] = useState('open');
  const group = (e: Exam) =>
    e.status === 'closed' || (!e.allow_late_submission && Date.parse(e.end_time) < serverNow)
      ? 'closed'
      : Date.parse(e.start_time) > serverNow
        ? 'upcoming'
        : 'open';
  const list = exams.filter((e) => group(e) === tab);
  return (
    <>
      <div className="tabs">
        {[
          ['open', 'Đang mở'],
          ['upcoming', 'Sắp diễn ra'],
          ['closed', 'Đã kết thúc'],
        ].map(([key, label]) => (
          <button
            key={key}
            className={'tab ' + (tab === key ? 'active' : '')}
            onClick={() => setTab(key)}
          >
            {label} <span className="badge">{exams.filter((e) => group(e) === key).length}</span>
          </button>
        ))}
      </div>
      {list.length ? (
        <div className="grid3">
          {list.map((e) => {
            const p = progress.find((p) => p.exam_id === e.id);
            const session = sessions.find((s) => s.exam_id === e.id);
            return (
              <article className="card exam-card" key={e.id}>
                <div className="row between">
                  <Badge color={tab === 'open' ? 'green' : tab === 'upcoming' ? 'cyan' : ''}>
                    {tab === 'open'
                      ? 'Đang mở'
                      : tab === 'upcoming'
                        ? 'Sắp diễn ra'
                        : 'Đã kết thúc'}
                  </Badge>
                  <span className="mono small muted">{e.scoring_mode}</span>
                </div>
                <h3>{e.title}</h3>
                <div className="exam-meta">
                  <span>
                    <BookOpen size={15} />
                    {classes.find((c) => c.id === e.class_id)?.name}
                  </span>
                  <span>
                    <CalendarDays size={15} />
                    Mở: {fmt(e.start_time)}
                  </span>
                  <span>
                    <CalendarDays size={15} />
                    Hạn: {fmt(e.end_time)}
                  </span>
                  <span>
                    <Clock size={15} />
                    {e.duration} phút
                  </span>
                </div>
                <div>
                  <div className="row between small muted">
                    <span>
                      {p?.completed || 0}/{p?.total || 0} bài đã nộp
                    </span>
                    {session?.finished_at && <span>Đã kết thúc bài</span>}
                  </div>
                  <div className="progress-track" style={{ marginTop: 10 }}>
                    <div
                      className="progress-fill"
                      style={{ width: ((p?.completed || 0) / (p?.total || 1)) * 100 + '%' }}
                    />
                  </div>
                </div>
                <Link
                  className={'button ' + (tab === 'open' ? 'primary' : '')}
                  href={
                    e.publish_result && tab === 'closed'
                      ? '/student/results/' + e.id
                      : '/student/exams/' + e.id
                  }
                >
                  {e.publish_result && tab === 'closed'
                    ? 'Xem kết quả'
                    : session
                      ? 'Tiếp tục / xem bài'
                      : 'Xem kỳ thi'}{' '}
                  →
                </Link>
              </article>
            );
          })}
        </div>
      ) : (
        <Empty
          title={
            tab === 'open'
              ? 'Chưa có kỳ thi đang mở'
              : tab === 'upcoming'
                ? 'Chưa có kỳ thi sắp diễn ra'
                : 'Chưa có kỳ thi đã kết thúc'
          }
          description="Kỳ thi sẽ xuất hiện khi giáo viên giao đề cho lớp."
        />
      )}
    </>
  );
}
