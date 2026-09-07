import { overview } from '@/services/data';
import { PageHead } from '@/components/ui';
import { PeopleTable } from '@/components/people-table';
export default async function Page() {
  const d = await overview();
  return (
    <>
      <PageHead title="Tài khoản" description="Khóa, mở khóa, cấp lại mật khẩu và thiết bị." />
      <section className="card">
        <PeopleTable people={d.profiles.filter((p) => p.role !== 'admin')} />
      </section>
    </>
  );
}
