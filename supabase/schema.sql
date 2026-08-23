-- ============================================================
-- 식단 관리 앱 (DietDuo) - Supabase Schema
--
-- 인증은 NextAuth + 카카오가 담당하므로 Supabase auth.users 를 쓰지 않는다.
-- user id = 카카오 계정 고유번호(NextAuth token.sub) 문자열.
--
-- 모든 DB 접근은 Next.js API 라우트에서 service_role 키로만 이루어진다.
-- 따라서 RLS 는 켜두되 정책을 만들지 않는다:
--   - anon / publishable 키  → 어떤 행도 읽거나 쓸 수 없음 (정책 없음 = 전부 거부)
--   - service_role 키        → RLS 를 우회하므로 서버에서는 정상 동작
-- 권한 검사는 각 API 라우트가 NextAuth 세션으로 수행한다.
--
-- Supabase 대시보드 → SQL Editor 에서 한 번 실행하세요.
-- ============================================================

-- ── 1. app_users ────────────────────────────────────────────
-- 프로필·설정·즐겨찾기를 한 행에 모아 초기 로딩을 1회 조회로 끝낸다.
create table if not exists app_users (
  id            text primary key,               -- 카카오 sub
  display_name  text        not null default '',
  height_cm     double precision,
  weight_kg     double precision,
  age           integer,
  sex           text,
  activity      text,
  goal          text,
  settings      jsonb       not null default '{}'::jsonb,
  favorites     jsonb       not null default '[]'::jsonb,
  -- 포스트잇처럼 계속 붙어 있는 메모. 날짜와 무관하며 사용자가 지울 때까지 남는다.
  memo          text        not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table app_users enable row level security;

-- ── 2. couples ──────────────────────────────────────────────
create table if not exists couples (
  id           uuid primary key default gen_random_uuid(),
  user_a       text        not null references app_users(id) on delete cascade,
  user_b       text        references app_users(id) on delete cascade,
  invite_code  text        not null unique,
  status       text        not null default 'pending'
                           check (status in ('pending', 'active')),
  created_at   timestamptz not null default now()
);

alter table couples enable row level security;

create index if not exists couples_user_a_idx on couples (user_a);
create index if not exists couples_user_b_idx on couples (user_b);
-- 초대 코드 조회는 아직 수락되지 않은 건만 대상으로 한다.
create index if not exists couples_pending_code_idx
  on couples (invite_code) where status = 'pending';

-- 한 사람이 여러 커플에 동시에 속하지 못하도록 활성 연결을 1개로 제한
create unique index if not exists couples_active_user_a_idx
  on couples (user_a) where status = 'active';
create unique index if not exists couples_active_user_b_idx
  on couples (user_b) where status = 'active';

-- ── 3. day_logs ─────────────────────────────────────────────
create table if not exists day_logs (
  user_id     text        not null references app_users(id) on delete cascade,
  date        date        not null,
  meals       jsonb       not null default '{}'::jsonb,
  water_ml    integer     not null default 0,
  steps       integer     not null default 0,
  exercises   jsonb       not null default '[]'::jsonb,
  weight_kg   double precision,          -- 그날 기록한 체중 (기기 간 동기화)
  kcal        integer     not null default 0,  -- 섭취 칼로리 합계 (캘린더·차트 range 조회용)
  updated_at  timestamptz not null default now(),
  primary key (user_id, date)
);

alter table day_logs enable row level security;

-- 캘린더(한 달)·주간 차트(7일)·체중 추이(30일) 모두 이 인덱스를 탄다.
create index if not exists day_logs_user_date_idx on day_logs (user_id, date desc);
