import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

test('PostgreSQL migrations, RLS, device binding, attempts and grading', async (t) => {
  const db = new PGlite();
  await db.exec(`
 create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create schema storage;
 create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)$$;
 grant usage on schema auth, public to authenticated,anon,service_role;
 grant execute on all functions in schema auth to authenticated,anon,service_role;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;
 grant usage on schema storage to authenticated;grant select on storage.objects to authenticated;
 `);
  for (const f of (await readdir('supabase/migrations')).filter((f) => f.endsWith('.sql')).sort())
    await db.exec(await readFile('supabase/migrations/' + f, 'utf8'));
  type Person = { id: string; sid: string; hash: string };
  async function createPerson(name: string, role: string): Promise<Person> {
    const id = randomUUID(),
      sid = randomUUID(),
      hash = randomUUID();
    await db.query('insert into auth.users(id,raw_app_meta_data) values($1,$2)', [
      id,
      JSON.stringify({ portal_username: name, portal_name: name, portal_role: role }),
    ]);
    await db.query('select public.bind_device($1,$2,$3,$4)', [id, hash, sid, 'Test browser']);
    return { id, sid, hash };
  }
  const admin = await createPerson('admin.test', 'admin'),
    teacher = await createPerson('teacher.one', 'teacher'),
    teacher2 = await createPerson('teacher.two', 'teacher'),
    student = await createPerson('student.one', 'student'),
    student2 = await createPerson('student.two', 'student');
  async function actor(p: Person | null, bound = true) {
    await db.exec('reset role');
    await db.query(`select set_config('request.jwt.claims',$1,false)`, [
      JSON.stringify(p ? { sub: p.id, session_id: bound ? p.sid : randomUUID() } : {}),
    ]);
    await db.exec('set role authenticated');
  }
  async function root() {
    await db.exec('reset role');
  }
  async function rpc<T = Record<string, unknown>>(name: string, args: unknown[] = []): Promise<T> {
    const params = args.map((_, i) => '$' + (i + 1)).join(',');
    const r = await db.query<{ v: T }>(`select public.${name}(${params}) as v`, args);
    return r.rows[0].v;
  }
  const manage = (action: string, payload: Record<string, unknown>) =>
    rpc<{ id: string }>('manage', [action, JSON.stringify(payload)]);
  await actor(admin);
  const c = (await manage('class_save', { name: 'Vật lý 12', teacher_id: teacher.id })).id,
    c2 = (await manage('class_save', { name: 'Vật lý 11', teacher_id: teacher2.id })).id;
  await manage('enroll', { class_id: c, student_id: student.id });
  await manage('enroll', { class_id: c2, student_id: student2.id });
  await t.test('Teacher only sees assigned classes; unbound Auth JWT cannot manage', async () => {
    await actor(teacher);
    assert.equal((await db.query('select * from public.classes')).rows.length, 1);
    await assert.rejects(manage('class_save', { name: 'Forbidden' }), /FORBIDDEN/);
    await actor(teacher, false);
    assert.equal((await db.query('select * from public.classes')).rows.length, 0);
    assert.equal(await rpc('manages_class', [c]), false);
    await assert.rejects(manage('exam_close', { id: randomUUID() }), /FORBIDDEN/);
  });
  await actor(teacher);
  const examPayload = {
    title: 'Integration test exam',
    description: '',
    class_id: c,
    start_time: new Date(Date.now() - 60000).toISOString(),
    end_time: new Date(Date.now() + 3600000).toISOString(),
    duration: 30,
    scoring_mode: 'CHALLENGE',
    allow_late_submission: false,
    attempt_weights: [1, 0.8, 0.6],
  };
  const eid = (await manage('exam_save', examPayload)).id;
  const problemPayload = {
    exam_id: eid,
    problem_number: 1,
    title: 'Acceleration',
    answer_type: 'numeric',
    correct_answer: '9.81',
    unit: 'm/s2',
    tolerance_type: 'absolute',
    tolerance_value: 0.02,
    max_attempts: 3,
    points: 10,
    auto_points: 6,
    require_solution: false,
  };
  const pid = (await manage('problem_save', problemPayload)).id;
  const pdf = randomUUID();
  await root();
  await db.query(
    `insert into public.file_assets(id,owner_id,exam_id,bucket,path,name,mime_type,size_bytes,ready) values($1,$2,$3,'exams','test/exam.pdf','exam.pdf','application/pdf',100,true)`,
    [pdf, teacher.id, eid],
  );
  await db.query(`update public.exams set pdf_path='test/exam.pdf' where id=$1`, [eid]);
  await db.query(`insert into storage.objects(bucket_id,name) values('exams','test/exam.pdf')`);
  await actor(teacher);
  await manage('exam_publish', { id: eid });
  await t.test('PDF hidden until timed session begins; numeric keys never exposed', async () => {
    await actor(student);
    assert.equal((await db.query('select * from public.problem_keys')).rows.length, 0);
    assert.equal((await db.query('select * from storage.objects')).rows.length, 0);
    const before = await rpc<{ problems: unknown[]; keys?: unknown }>('contest_data', [eid]);
    assert.equal(before.problems.length, 0);
    assert.equal(before.keys, undefined);
    await rpc('start_exam', [eid]);
    assert.equal((await db.query('select * from storage.objects')).rows.length, 1);
    assert.equal((await db.query('select * from public.problems')).rows.length, 1);
  });
  await t.test(
    'Teacher cannot enroll another teacher’s student to gain account access',
    async () => {
      await actor(teacher2);
      await assert.rejects(manage('enroll', { class_id: c2, student_id: student.id }), /FORBIDDEN/);
    },
  );
  await t.test('Other student cannot read or submit in a different class', async () => {
    await actor(student2);
    assert.equal((await db.query('select * from public.exams')).rows.length, 0);
    await assert.rejects(rpc('contest_data', [eid]), /FORBIDDEN/);
    await assert.rejects(
      rpc('submit_answer', [pid, '9.81', 'm/s2', [], randomUUID()]),
      /FORBIDDEN/,
    );
  });
  await t.test(
    'Atomic attempt history and idempotent retry; raw submission table denied',
    async () => {
      await actor(student);
      const key = randomUUID();
      await rpc('submit_answer', [pid, '9,0', 'm/s2', [], key]);
      const retry = await rpc<{ duplicate: boolean }>('submit_answer', [
        pid,
        '9.81',
        'm/s2',
        [],
        key,
      ]);
      assert.equal(retry.duplicate, true);
      assert.equal((await db.query('select * from public.submissions')).rows.length, 0);
      await assert.rejects(
        db.query(`insert into public.submissions default values`),
        /permission denied/,
      );
      const d = await rpc<{
        submissions: { answer: string; auto_score: null; final_score: null }[];
      }>('contest_data', [eid]);
      assert.equal(d.submissions.length, 1);
      assert.equal(d.submissions[0].answer, '9,0');
      assert.equal(d.submissions[0].auto_score, null);
      assert.equal(d.submissions[0].final_score, null);
    },
  );
  let successfulId = '';
  await t.test(
    'Absolute boundary, scientific notation and challenge factors are exact',
    async () => {
      await actor(student);
      successfulId = (
        await rpc<{ id: string }>('submit_answer', [pid, '9.83E0', 'm/s2', [], randomUUID()])
      ).id;
      await actor(teacher);
      const r = await db.query<{ is_correct: boolean; auto_score: string }>(
        'select is_correct,auto_score from public.submissions where id=$1',
        [successfulId],
      );
      assert.equal(r.rows[0].is_correct, true);
      assert.equal(Number(r.rows[0].auto_score), 4.8);
      await manage('grade', { id: successfulId, manual_score: 4, comment: 'Lập luận đúng.' });
      const s = await db.query<{ manual_score: string; final_score: string }>(
        'select manual_score,final_score from public.submissions where id=$1',
        [successfulId],
      );
      assert.equal(Number(s.rows[0].manual_score), 3.2);
      assert.equal(Number(s.rows[0].final_score), 8);
      await manage('grade', { id: successfulId, manual_score: 4, comment: 'Lưu lại.' });
      const again = await db.query<{ final_score: string }>(
        'select final_score from public.submissions where id=$1',
        [successfulId],
      );
      assert.equal(Number(again.rows[0].final_score), 8);
      await assert.rejects(
        manage('grade', { id: successfulId, manual_score: 4.01 }),
        /INVALID_SCORE/,
      );
    },
  );
  await t.test(
    'Malformed answers and foreign files fail without consuming an attempt',
    async () => {
      await actor(student);
      await assert.rejects(
        rpc('submit_answer', [pid, 'NaN', 'm/s2', [], randomUUID()]),
        /INVALID_NUMBER/,
      );
      await assert.rejects(
        rpc('submit_answer', [pid, '1e9999', 'm/s2', [], randomUUID()]),
        /INVALID_NUMBER/,
      );
      await assert.rejects(
        rpc('submit_answer', [pid, '9.81', 'm/s2', [randomUUID()], randomUUID()]),
        /INVALID_FILES/,
      );
      const d = await rpc<{ submissions: unknown[] }>('contest_data', [eid]);
      assert.equal(d.submissions.length, 2);
    },
  );
  await t.test('Attempt cap and unit check enforced by PostgreSQL', async () => {
    await actor(student);
    await rpc('submit_answer', [pid, '9.81', 'km/s2', [], randomUUID()]);
    await assert.rejects(
      rpc('submit_answer', [pid, '9.81', 'm/s2', [], randomUUID()]),
      /ATTEMPTS_EXHAUSTED/,
    );
    await actor(teacher);
    const s = await db.query<{ is_correct: boolean }>(
      'select is_correct from public.submissions where problem_id=$1 and attempt_number=3',
      [pid],
    );
    assert.equal(s.rows[0].is_correct, false);
  });
  await t.test('Draft revisions prevent silent overwrite', async () => {
    await actor(student);
    const d = await rpc<{ draft: { revision: number } }>('save_draft', [pid, 'draft A', 'm/s2', 0]);
    assert.equal(d.draft.revision, 1);
    const conflict = await rpc<{ conflict: boolean; draft: { answer: string } }>('save_draft', [
      pid,
      'stale tab',
      'm/s2',
      0,
    ]);
    assert.equal(conflict.conflict, true);
    assert.equal(conflict.draft.answer, 'draft A');
  });
  await t.test('Clarification privacy and published announcement', async () => {
    await actor(student);
    const qid = await rpc<string>('ask_clarification', [pid, 'Bỏ qua ma sát?']);
    await actor(teacher);
    await manage('reply', { id: qid, answer: 'Có thể bỏ qua ma sát.', publish: true });
    await actor(student);
    assert.equal((await db.query('select * from public.announcements')).rows.length, 1);
    await actor(student2);
    assert.equal((await db.query('select * from public.clarifications')).rows.length, 0);
    assert.equal((await db.query('select * from public.announcements')).rows.length, 0);
  });
  await t.test(
    'End time blocks late attempts; EXAM has exactly one attempt and hides correctness',
    async () => {
      await actor(teacher);
      const ex = (await manage('exam_save', { ...examPayload, scoring_mode: 'EXAM' })).id;
      const p = (
        await manage('problem_save', {
          ...problemPayload,
          exam_id: ex,
          answer_type: 'numeric',
          correct_answer: '1e-4',
          tolerance_type: 'relative',
          tolerance_value: 0.01,
          auto_points: 10,
          unit: '',
        })
      ).id;
      await root();
      await db.query(`update public.exams set pdf_path='another.pdf' where id=$1`, [ex]);
      await actor(teacher);
      await manage('exam_publish', { id: ex });
      await actor(student);
      await rpc('start_exam', [ex]);
      await root();
      await db.query(
        `update public.exam_sessions set deadline=now()-interval '1 minute' where exam_id=$1`,
        [ex],
      );
      await actor(student);
      await assert.rejects(
        rpc('submit_answer', [p, '1.01e-4', '', [], randomUUID()]),
        /TIME_EXPIRED/,
      );
      await root();
      await db.query(
        `update public.exam_sessions set deadline=now()+interval '1 minute' where exam_id=$1`,
        [ex],
      );
      await actor(student);
      await rpc('submit_answer', [p, '1.01e-4', '', [], randomUUID()]);
      await assert.rejects(
        rpc('submit_answer', [p, '1e-4', '', [], randomUUID()]),
        /ATTEMPTS_EXHAUSTED/,
      );
      const d = await rpc<{ submissions: { is_correct: unknown; status: string }[] }>(
        'contest_data',
        [ex],
      );
      assert.equal(d.submissions[0].is_correct, null);
      assert.equal(d.submissions[0].status, 'SUBMITTED');
      await actor(teacher);
      const s = await db.query<{ is_correct: boolean }>(
        'select is_correct from public.submissions where problem_id=$1',
        [p],
      );
      assert.equal(s.rows[0].is_correct, true);
    },
  );
  await t.test(
    'Results gated by publication and end; closing makes immutable sessions',
    async () => {
      await actor(teacher);
      await assert.rejects(
        manage('publish_result', { id: eid, publish: true }),
        /RESULTS_REQUIRE_EXAM_END/,
      );
      await manage('exam_close', { id: eid });
      await manage('publish_result', { id: eid, publish: true });
      await actor(student);
      const d = await rpc<{
        keys: { correct_answer: string }[];
        submissions: { id: string; final_score: number }[];
      }>('contest_data', [eid]);
      assert.equal(d.keys[0].correct_answer, '9.81');
      assert.equal(Number(d.submissions.find((s) => s.id === successfulId)?.final_score), 8);
      await assert.rejects(
        rpc('submit_answer', [pid, '9.81', 'm/s2', [], randomUUID()]),
        /EXAM_NOT_OPEN/,
      );
    },
  );
  await t.test(
    'Device reset revokes existing tokens; different fingerprint refused until reset',
    async () => {
      await root();
      assert.equal(
        await rpc('bind_device', [student.id, 'other-fingerprint', randomUUID(), 'Other']),
        false,
      );
      await actor(teacher);
      await manage('reset_device', { id: student.id });
      await actor(student);
      assert.equal((await db.query('select * from public.exams')).rows.length, 0);
      await assert.rejects(rpc('contest_data', [eid]), /FORBIDDEN/);
      await root();
      student.sid = randomUUID();
      student.hash = 'other-fingerprint';
      assert.equal(
        await rpc('bind_device', [student.id, student.hash, student.sid, 'New browser']),
        true,
      );
      await actor(student);
      assert.ok((await db.query('select * from public.exams')).rows.length > 0);
    },
  );
  await t.test('Lock student blocks RLS; unbound JWT cannot register files', async () => {
    await actor(teacher);
    await manage('lock_user', { id: student.id, active: false });
    await actor(student);
    assert.equal((await db.query('select * from public.profiles')).rows.length, 0);
    await assert.rejects(rpc('start_exam', [eid]), /FORBIDDEN/);
    await actor(teacher, false);
    await assert.rejects(
      rpc('register_file', [
        JSON.stringify({
          id: randomUUID(),
          exam_id: eid,
          bucket: 'solutions',
          problem_id: pid,
          path: 'forbidden.pdf',
          name: 'bad.pdf',
          mime_type: 'application/pdf',
          size_bytes: 10,
        }),
      ]),
      /FORBIDDEN/,
    );
  });
  await t.test('Reassigning a class revokes the original teacher', async () => {
    await actor(admin);
    await manage('class_save', { id: c, name: 'Vật lý 12', teacher_id: teacher2.id });
    await actor(teacher);
    assert.equal((await db.query('select * from public.exams')).rows.length, 0);
    await actor(teacher2);
    assert.ok((await db.query('select * from public.exams')).rows.length > 0);
  });
  await root();
  await db.close();
});
