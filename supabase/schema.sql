-- ============================================================
-- 식단 관리 앱 - Supabase SQL Schema
-- Supabase 대시보드 → SQL Editor에서 한 번 실행하세요.
-- ============================================================

-- ── 1. user_display (공개 정보) ──────────────────────────────
create table if not exists user_display (
  id uuid references auth.users on delete cascade primary key,
  display_name text not null default '',
  created_at timestamptz default now()
);
alter table user_display enable row level security;
-- 누구나 읽기 가능 (닉네임은 비공개 정보 아님)
create policy "Public read" on user_display for select using (true);
create policy "Own insert" on user_display for insert with check (auth.uid() = id);
create policy "Own update" on user_display for update using (auth.uid() = id);

-- ── 2. user_profiles (민감 정보 - 본인만 접근) ───────────────
create table if not exists user_profiles (
  id uuid references auth.users on delete cascade primary key,
  height_cm float,
  weight_kg float,
  age int,
  sex text,
  activity text,
  goal text,
  settings jsonb not null default '{}'::jsonb,
  favorites jsonb not null default '[]'::jsonb,
  created_at timestamptz default now()
);
alter table user_profiles enable row level security;
create policy "Own access only" on user_profiles for all using (auth.uid() = id);

-- ── 3. couples (커플 연결 관계) ──────────────────────────────
create table if not exists couples (
  id uuid primary key default gen_random_uuid(),
  user_a uuid references auth.users on delete cascade not null,
  user_b uuid references auth.users on delete cascade,
  invite_code text unique not null,
  status text not null default 'pending' check (status in ('pending', 'active')),
  created_at timestamptz default now()
);
alter table couples enable row level security;

-- 본인 커플 + 대기중인 초대 코드 읽기 허용
create policy "See own couples and pending invites"
  on couples for select
  using (
    auth.uid() = user_a
    or auth.uid() = user_b
    or (status = 'pending' and user_b is null)
  );

-- 초대 생성 (user_a = 본인)
create policy "Create invite"
  on couples for insert
  with check (auth.uid() = user_a and user_b is null);

-- 초대 수락 (대기중인 남의 초대 코드를 본인 ID로 업데이트)
create policy "Accept invite"
  on couples for update
  using (status = 'pending' and user_b is null and user_a != auth.uid())
  with check (user_b = auth.uid() and status = 'active');

-- 커플 해제 (본인이 user_a 또는 user_b인 경우)
create policy "Disconnect couple"
  on couples for delete
  using (auth.uid() = user_a or auth.uid() = user_b);

-- ── 4. day_logs (일별 식단·운동 기록) ───────────────────────
create table if not exists day_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  date date not null,
  meals jsonb not null default '{}'::jsonb,
  water_ml integer not null default 0,
  memo text,
  steps integer not null default 0,
  exercises jsonb not null default '[]'::jsonb,
  updated_at timestamptz default now(),
  unique(user_id, date)
);
alter table day_logs enable row level security;

-- 본인 기록 CRUD
create policy "Own logs"
  on day_logs for all using (auth.uid() = user_id);

-- 연결된 커플 파트너의 기록 읽기 허용
create policy "Partner can read logs"
  on day_logs for select using (
    auth.uid() = user_id
    or user_id in (
      select
        case when user_a = auth.uid() then user_b else user_a end
      from couples
      where status = 'active'
        and (user_a = auth.uid() or user_b = auth.uid())
        and user_b is not null
    )
  );
