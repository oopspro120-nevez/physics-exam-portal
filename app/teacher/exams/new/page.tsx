import { overview } from '@/services/data';
import { PageHead, Empty } from '@/components/ui';
import { ExamForm } from '@/components/exams/exam-form';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ class?: string }>;
}) {
  const d = await overview();
  const q = await searchParams;
  return (
    <>
      <PageHead
        title="Tạo kỳ thi"
        description="01 Cấu hình → 02 Tải đề PDF → 03 Khai báo Problems"
      />
      {d.classes.length ? (
        <section className="card">
          <ExamForm classes={d.classes} classId={q.class} />
        </section>
      ) : (
        <Empty
          title="Cần có lớp được phân công"
          description="Liên hệ quản trị viên để được giao lớp trước khi tạo kỳ thi."
        />
      )}
    </>
  );
}
