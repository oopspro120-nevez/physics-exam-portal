import { overview } from '@/services/data';
import { PageHead } from '@/components/ui';
import { PeopleTable } from '@/components/people-table';
import { UserManager } from '@/components/user-manager';
export default async function Page() {
  const d = await overview();
  return (
    <>
      <PageHead
        title="Giáo viên"
        description="Cấp tài khoản và quản lý quyền truy cập của giáo viên."
      />
      <section className="card">
        <PeopleTable people={d.profiles.filter((p) => p.role === 'teacher')} />
      </section>
      <section className="card section-gap">
        <h2>Tạo tài khoản giáo viên</h2>
        <UserManager role="teacher" />
      </section>
    </>
  );
}
