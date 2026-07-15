-- ============================================================
-- QA JJ v2 — Chat Schema
-- Supabase SQL Editor에서 실행하세요
-- ============================================================

-- ============================================================
-- 1. chat_messages 테이블
-- ============================================================
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  sender text not null check (sender in ('degul', 'muyo')),
  kind text not null default 'text' check (kind in ('text', 'image')),
  text text default '',
  image_path text default '',
  edited boolean default false,
  deleted boolean default false,
  read boolean default false,
  created_at timestamptz default now()
);

-- Indexes
create index if not exists idx_chat_messages_created on chat_messages(created_at desc);
create index if not exists idx_chat_messages_sender on chat_messages(sender);

-- RLS
alter table chat_messages enable row level security;
create policy "Allow all access" on chat_messages for all using (true) with check (true);

-- Realtime 활성화 (Supabase Dashboard > Database > Replication에서도 설정 가능)
alter publication supabase_realtime add table chat_messages;

-- ============================================================
-- 2. chat_notice 테이블 (고정 메모, 자정 삭제 제외)
-- ============================================================
create table if not exists chat_notice (
  id uuid primary key default gen_random_uuid(),
  text text default '',
  updated_by text default 'degul' check (updated_by in ('degul', 'muyo')),
  updated_at timestamptz default now()
);

alter table chat_notice enable row level security;
create policy "Allow all access" on chat_notice for all using (true) with check (true);

-- ============================================================
-- 3. pg_cron: 매시간 KST 기준 전날 이전 메시지 자동 삭제
-- ============================================================
-- Supabase Dashboard > SQL Editor에서 아래 쿼리를 실행하세요:
--
-- select cron.schedule(
--   'delete-old-chat-messages',
--   '0 * * * *',  -- 매시간 정각 실행 (하루 24회)
--   $$
--   delete from chat_messages
--   where created_at < (
--     date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul'
--   );
--   $$
-- );
--
-- 확인: select * from cron.job;
-- 삭제: select cron.unschedule('delete-old-chat-messages');
--
-- 이미지 Storage 정리는 Edge Function 또는 DB trigger로 별도 처리

-- ============================================================
-- 4. Storage Bucket (Supabase Dashboard에서 생성)
-- ============================================================
-- 이름: "chat-images"
-- 타입: Private
-- File size limit: 5MB
-- Allowed MIME types: image/jpeg, image/png, image/gif, image/webp
