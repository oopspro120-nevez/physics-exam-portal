import { overview } from '@/services/data';
import { getProgress } from '@/services/student';
import { PageHead, Stat } from '@/components/ui';
import { StudentExams } from '@/components/student-exams';
export default async function Page() {
  const [d, progress] = await Promise.all([overview(), getProgress()]);
  return (
    <>
      <PageHead
        title="Kỳ thi của tôi"
        description="Mở đề, trình bày lời giải và theo dõi tiến độ của bạn."
      />
      <div className="stats">
        <Stat label="Kỳ thi được giao" value={d.exams.length} />
        <Stat label="Đã bắt đầu" value={d.sessions.length} />
        <Stat label="Problems đã nộp" value={progress.reduce((s, p) => s + p.completed, 0)} />
        <Stat label="Lớp của tôi" value={d.classes.length} />
      </div>
      <StudentExams
        exams={d.exams}
        classes={d.classes}
        sessions={d.sessions}
        progress={progress}
        serverNow={Date.now()}
      />
    </>
  );
}
