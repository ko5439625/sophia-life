-- ============================================================
-- sophia.life Supabase Schema
-- Supabase SQL Editor에서 실행하세요
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. 블로그
-- ============================================================
create table if not exists posts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  content text default '',
  category text default '일상',
  tags text[] default '{}',
  is_public boolean default true,
  images text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- 2. 일정 - 체크리스트 (주간 계획)
-- ============================================================
create table if not exists todos (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  memo text default '',
  is_done boolean default false,
  date date not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- 3. 일정 - 이벤트/캘린더
-- ============================================================
create table if not exists events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  date date not null,
  time text,
  emoji text default '📅',
  is_shared boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- 4. 일정 - 플래너 (여행/데이트)
-- ============================================================
create table if not exists plans (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  start_date date not null,
  end_date date not null,
  estimated_cost integer default 0,
  status text default 'planned' check (status in ('planned', 'completed')),
  memo text default '',
  items jsonb default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- 5. 자산 - 월별 예산
-- ============================================================
create table if not exists budgets (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  month text not null, -- "YYYY-MM"
  salary1 integer default 0,
  salary2 integer default 0,
  categories jsonb default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, month)
);

-- ============================================================
-- 6. 자산 - 수입/지출
-- ============================================================
create table if not exists finances (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  amount integer not null,
  category text not null,
  date date not null,
  memo text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- 7. 투자 - 보유 종목
-- ============================================================
create table if not exists holdings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  category text default 'stock' check (category in ('stock', 'etf', 'bond', 'crypto', 'gold', 'other')),
  quantity numeric not null default 0,
  avg_price numeric not null default 0,
  current_price numeric not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- 8. 투자 - 거래 내역
-- ============================================================
create table if not exists trades (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  date date not null,
  type text not null check (type in ('buy', 'sell')),
  holding_name text not null,
  quantity numeric not null,
  price numeric not null,
  total_amount numeric not null,
  realized_pnl numeric,
  destination text check (destination in ('cash', 'reinvest', 'savings')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- 9. 투자 - 연금
-- ============================================================
create table if not exists pension_funds (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  account_type text default 'irp' check (account_type in ('irp', 'pension_saving', 'dc')),
  name text not null,
  buy_price numeric default 0,
  current_price numeric default 0,
  quantity numeric default 0,
  weight numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- 10. 부동산 - 임장 기록
-- ============================================================
create table if not exists inspections (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  apartment_name text not null,
  visit_date date not null,
  scores jsonb default '{}',
  photos text[] default '{}',
  review text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- 11. 기록 - D-day
-- ============================================================
create table if not exists ddays (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  emoji text default '❤️',
  date date not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- 12. 기록 - 위시리스트
-- ============================================================
create table if not exists wishes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  category text default '물건' check (category in ('물건', '장소', '경험')),
  is_done boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- 13. 기록 - 갤러리/앨범
-- ============================================================
create table if not exists albums (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  description text default '',
  is_public boolean default false,
  photos jsonb default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- 14. 기록 - 속닥속닥 (메모)
-- ============================================================
create table if not exists memos (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  author text default 'sophia' check (author in ('sophia', 'partner')),
  message text not null,
  pinned boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- 14-1. 기록 - 웨딩 준비
-- ============================================================
create table if not exists wedding_items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  category text not null default '기타',
  sub_category text not null default '',
  title text not null,
  is_done boolean default false,
  memo text default '',
  budget numeric default 0,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- 14-2. 기록 - 웨딩 업체 비교
-- ============================================================
create table if not exists wedding_vendors (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  section text not null check (section in ('venue', 'sdm_studio', 'sdm_dress', 'sdm_makeup', 'honeymoon', 'reservation', 'misc')),
  name text not null,
  price numeric default 0,
  memo text default '',
  pros text default '',
  cons text default '',
  contact text default '',
  rating integer default 0 check (rating >= 0 and rating <= 5),
  is_selected boolean default false,
  details jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- 15. 설정 - 사용자 설정
-- ============================================================
create table if not exists user_settings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade unique,
  pin_code text default '1002',
  category_pin text default '100200',
  annual_income1 integer default 0,
  annual_income2 integer default 0,
  monthly_loan_payment integer default 0,
  cash_savings integer default 0,
  emergency_fund integer default 0,
  blog_categories text[] default '{일상,개발,여행,요리,음악,영화}',
  locked_categories text[] default '{감성}',
  api_keys jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- 16. 부동산 - 관심 아파트
-- ============================================================
create table if not exists favorite_apartments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  apartment_name text not null,
  address text default '',
  region text default '',
  created_at timestamptz default now()
);

-- ============================================================
-- 17. 자산 - 보유 부동산
-- ============================================================
create table if not exists owned_properties (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  address text default '',
  purchase_price numeric default 0,
  current_value numeric default 0,
  purchase_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- 18. 블로그 좋아요
-- ============================================================
create table if not exists post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id text not null,
  visitor_id text not null,
  created_at timestamptz default now(),
  unique(post_id, visitor_id)
);

create index if not exists idx_post_likes_post_id on post_likes(post_id);
create index if not exists idx_post_likes_visitor on post_likes(post_id, visitor_id);

-- ============================================================
-- Row Level Security (RLS) - 모든 테이블에 적용
-- ============================================================
alter table posts enable row level security;
alter table todos enable row level security;
alter table events enable row level security;
alter table plans enable row level security;
alter table budgets enable row level security;
alter table finances enable row level security;
alter table holdings enable row level security;
alter table trades enable row level security;
alter table pension_funds enable row level security;
alter table inspections enable row level security;
alter table ddays enable row level security;
alter table wishes enable row level security;
alter table albums enable row level security;
alter table memos enable row level security;
alter table wedding_items enable row level security;
alter table wedding_vendors enable row level security;
alter table user_settings enable row level security;
alter table favorite_apartments enable row level security;
alter table owned_properties enable row level security;
alter table post_likes enable row level security;

-- RLS Policies: 본인 데이터만 접근 가능
-- (PIN 인증 방식이라 auth 없이 사용할 수도 있으므로,
--  일단 모든 접근 허용 정책 추가. 추후 auth 추가 시 수정)

create policy "Allow all access" on posts for all using (true) with check (true);
create policy "Allow all access" on todos for all using (true) with check (true);
create policy "Allow all access" on events for all using (true) with check (true);
create policy "Allow all access" on plans for all using (true) with check (true);
create policy "Allow all access" on budgets for all using (true) with check (true);
create policy "Allow all access" on finances for all using (true) with check (true);
create policy "Allow all access" on holdings for all using (true) with check (true);
create policy "Allow all access" on trades for all using (true) with check (true);
create policy "Allow all access" on pension_funds for all using (true) with check (true);
create policy "Allow all access" on inspections for all using (true) with check (true);
create policy "Allow all access" on ddays for all using (true) with check (true);
create policy "Allow all access" on wishes for all using (true) with check (true);
create policy "Allow all access" on albums for all using (true) with check (true);
create policy "Allow all access" on memos for all using (true) with check (true);
create policy "Allow all access" on wedding_items for all using (true) with check (true);
create policy "Allow all access" on wedding_vendors for all using (true) with check (true);
create policy "Allow all access" on user_settings for all using (true) with check (true);
create policy "Allow all access" on favorite_apartments for all using (true) with check (true);
create policy "Allow all access" on owned_properties for all using (true) with check (true);
create policy "Allow all access" on post_likes for all using (true) with check (true);

-- 블로그 공개 글은 비인증 사용자도 읽기 가능
create policy "Public posts readable" on posts for select using (is_public = true);
create policy "Public albums readable" on albums for select using (is_public = true);

-- ============================================================
-- Indexes for performance
-- ============================================================
create index if not exists idx_posts_category on posts(category);
create index if not exists idx_posts_created on posts(created_at desc);
create index if not exists idx_todos_date on todos(date);
create index if not exists idx_events_date on events(date);
create index if not exists idx_budgets_month on budgets(month);
create index if not exists idx_finances_date on finances(date);
create index if not exists idx_finances_type on finances(type);
create index if not exists idx_trades_date on trades(date);
create index if not exists idx_memos_pinned on memos(pinned);
create index if not exists idx_wedding_items_category on wedding_items(category);
create index if not exists idx_wedding_vendors_section on wedding_vendors(section);

-- ============================================================
-- Storage Buckets (Supabase Dashboard에서 생성)
-- ============================================================
-- 1. "blog-images" - 블로그 사진
-- 2. "gallery" - 갤러리 사진
-- 3. "inspection-photos" - 임장 사진
-- 이 버킷들은 Supabase Dashboard > Storage에서 직접 생성하세요
