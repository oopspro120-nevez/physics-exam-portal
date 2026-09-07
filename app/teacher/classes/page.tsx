import Link from 'next/link';
import { BookOpen, ArrowRight } from 'lucide-react';
import { overview } from '@/services/data';
import { PageHead, Empty } from '@/components/ui';
export default async function Page() {
  const d = await overview();
  return (
    <>
      <PageHead title="Lớp phụ trách" description="Các lớp được quản trị viên phân công cho bạn." />
      {d.classes.length ? (
        <div className="grid3">
          {d.classes.map((c) => (
            <Link href={'/teacher/classes/' + c.id} className="card exam-card" key={c.id}>
              <BookOpen size={25} color="var(--cyan)" />
              <h3>{c.name}</h3>
              <p className="muted small">
                {d.members.filter((m) => m.class_id === c.id).length} học sinh ·{' '}
                {d.exams.filter((e) => e.class_id === c.id).length} kỳ thi
              </p>
              <span className="text-link small row">
                Mở lớp <ArrowRight size={16} />
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <Empty
          title="Bạn chưa được giao lớp"
          description="Liên hệ quản trị viên để được phân công lớp học."
        />
      )}
    </>
  );
}
