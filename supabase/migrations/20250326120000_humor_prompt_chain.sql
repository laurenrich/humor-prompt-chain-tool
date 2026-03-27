-- Requires existing public.profiles with columns is_superadmin, is_matrix_admin (boolean).

create table if not exists public.humor_flavors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.humor_flavor_steps (
  id uuid primary key default gen_random_uuid(),
  flavor_id uuid not null references public.humor_flavors (id) on delete cascade,
  step_order integer not null,
  prompt_template text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint humor_flavor_steps_order_unique unique (flavor_id, step_order)
);

create index if not exists humor_flavor_steps_flavor_id_idx on public.humor_flavor_steps (flavor_id);

create table if not exists public.humor_test_images (
  id uuid primary key default gen_random_uuid(),
  label text,
  image_url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.humor_flavor_runs (
  id uuid primary key default gen_random_uuid(),
  flavor_id uuid not null references public.humor_flavors (id) on delete cascade,
  test_image_id uuid references public.humor_test_images (id) on delete set null,
  image_url text,
  step_outputs jsonb not null default '[]'::jsonb,
  final_captions text[] default '{}',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

create index if not exists humor_flavor_runs_flavor_id_idx on public.humor_flavor_runs (flavor_id);

alter table public.humor_flavors enable row level security;
alter table public.humor_flavor_steps enable row level security;
alter table public.humor_test_images enable row level security;
alter table public.humor_flavor_runs enable row level security;

create policy "humor_flavors matrix or superadmin"
  on public.humor_flavors
  for all
  using (
    exists (
      select 1
      from public.profiles p
      where
        p.id = (select auth.uid ())
        and (
          coalesce(p.is_superadmin, false)
          or coalesce(p.is_matrix_admin, false)
        )
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where
        p.id = (select auth.uid ())
        and (
          coalesce(p.is_superadmin, false)
          or coalesce(p.is_matrix_admin, false)
        )
    )
  );

create policy "humor_flavor_steps matrix or superadmin"
  on public.humor_flavor_steps
  for all
  using (
    exists (
      select 1
      from public.profiles p
      where
        p.id = (select auth.uid ())
        and (
          coalesce(p.is_superadmin, false)
          or coalesce(p.is_matrix_admin, false)
        )
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where
        p.id = (select auth.uid ())
        and (
          coalesce(p.is_superadmin, false)
          or coalesce(p.is_matrix_admin, false)
        )
    )
  );

create policy "humor_test_images matrix or superadmin"
  on public.humor_test_images
  for all
  using (
    exists (
      select 1
      from public.profiles p
      where
        p.id = (select auth.uid ())
        and (
          coalesce(p.is_superadmin, false)
          or coalesce(p.is_matrix_admin, false)
        )
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where
        p.id = (select auth.uid ())
        and (
          coalesce(p.is_superadmin, false)
          or coalesce(p.is_matrix_admin, false)
        )
    )
  );

create policy "humor_flavor_runs matrix or superadmin"
  on public.humor_flavor_runs
  for all
  using (
    exists (
      select 1
      from public.profiles p
      where
        p.id = (select auth.uid ())
        and (
          coalesce(p.is_superadmin, false)
          or coalesce(p.is_matrix_admin, false)
        )
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where
        p.id = (select auth.uid ())
        and (
          coalesce(p.is_superadmin, false)
          or coalesce(p.is_matrix_admin, false)
        )
    )
  );

insert into
  public.humor_test_images (id, label, image_url, sort_order)
values
  (
    'a0000001-0000-4000-8000-000000000001',
    'Sample 1',
    'https://images.unsplash.com/photo-1507146426996-ef05306b995a?w=800&q=80',
    0
  ),
  (
    'a0000001-0000-4000-8000-000000000002',
    'Sample 2',
    'https://images.unsplash.com/photo-1517849845537-4d257902454a?w=800&q=80',
    1
  ),
  (
    'a0000001-0000-4000-8000-000000000003',
    'Sample 3',
    'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=800&q=80',
    2
  )
on conflict (id) do nothing;
