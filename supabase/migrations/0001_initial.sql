-- N2 – schema P0. Chỉ là migration khởi đầu, cần RLS/policy và review trước public.
create extension if not exists postgis with schema extensions;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  preferred_vehicle text not null default 'motorcycle' check (preferred_vehicle in ('car','motorcycle')),
  created_at timestamptz not null default now()
);

create table if not exists public.traffic_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  incident_type text not null,
  severity text not null check (severity in ('low','medium','high')),
  status text not null default 'active' check (status in ('active','cleared','expired')),
  geom extensions.geography(Point,4326) not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  image_path text
);
create index if not exists idx_traffic_reports_geom on public.traffic_reports using gist(geom);
create index if not exists idx_traffic_reports_created on public.traffic_reports(created_at desc);

create table if not exists public.saved_routes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  vehicle text not null check (vehicle in ('car','motorcycle')),
  waypoints jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_saved_routes_user on public.saved_routes(user_id);

-- Không mở policies công khai trong starter. N2 phải viết migration RLS riêng,
-- xác minh cách backend service role/JWT được dùng trước khi deploy.
alter table public.profiles enable row level security;
alter table public.traffic_reports enable row level security;
alter table public.saved_routes enable row level security;
