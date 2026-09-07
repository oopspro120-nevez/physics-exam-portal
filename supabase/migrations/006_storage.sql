-- Ba bucket PRIVATE. Migration tự tạo bucket, không cần thao tác thủ công khác.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('exams','exams',false,26214400,array['application/pdf']),
 ('submissions','submissions',false,15728640,array['application/pdf','image/jpeg','image/png']),
 ('solutions','solutions',false,15728640,array['application/pdf','image/jpeg','image/png'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
-- Upload bằng signed upload token chỉ do backend phát sau register_file. Không mở INSERT công khai.
create policy portal_private_files_read on storage.objects for select to authenticated using (
 bucket_id in ('exams','submissions','solutions') and exists (
 select 1 from public.file_assets f where f.bucket=storage.objects.bucket_id and f.path=storage.objects.name and f.ready and public.sees_file(f.id))
);
-- Không có policy UPDATE: không ghi đè lời giải sau khi nộp.
