create table if not exists public.velkaris_documents (
  key text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.velkaris_documents enable row level security;

create or replace function public.touch_velkaris_documents()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_velkaris_documents on public.velkaris_documents;
create trigger trg_touch_velkaris_documents
before update on public.velkaris_documents
for each row
execute function public.touch_velkaris_documents();

insert into storage.buckets (id, name, public)
values ('velkaris-media', 'velkaris-media', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Public can read Velkaris media" on storage.objects;
create policy "Public can read Velkaris media"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'velkaris-media');
