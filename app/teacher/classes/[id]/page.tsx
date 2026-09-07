import { notFound } from 'next/navigation';
import Link from 'next/link';
import { overview } from '@/services/data';
import { PageHead } from '@/components/ui';
import { PeopleTable } from '@/components/people-table';
import { UserManager } from '@/components/user-manager';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await overview();
  const c = d.classes.find((c) => c.id === id);
  if (!c) notFound();
  const members = new Set(d.members.filter((m) => m.class_id === id).map((m) => m.student_id));
  return (
    <>
      <PageHead
        title={c.name}
        description={`${members.size} học sinh · Quản lý danh sách và tài khoản lớp.`}
        action={
          <Link className="button primary" href={'/teacher/exams/new?class=' + id}>
            Tạo kỳ thi cho lớp
          </Link>
        }
      />
      <section className="card">
        <h2>Danh sách học sinh</h2>
        <PeopleTable people={d.profiles.filter((p) => members.has(p.id))} />
      </section>
      <section className="card section-gap">
        <h2>Thêm học sinh</h2>
        <UserManager role="student" classId={id} />
      </section>
    </>
  );
}
