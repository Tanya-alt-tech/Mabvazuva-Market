-- =====================================================================
-- Mabvazuva Market: database setup for Supabase.
-- Paste this whole file into Supabase > SQL Editor > New query > Run.
-- Run it once, on a new project.
-- =====================================================================

-- ---------- accounts --------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  is_admin boolean not null default false
);
alter table public.profiles enable row level security;
create policy "read own profile" on public.profiles for select using (auth.uid() = id);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false)
$$;

-- ---------- businesses ------------------------------------------------
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  cat text not null,
  owner_name text not null default '',
  tagline text not null default '' check (char_length(tagline) <= 140),
  descr text not null default '' check (char_length(descr) <= 2000),
  prices jsonb not null default '[]',
  hours text not null default '',
  wa text not null default '',
  photos jsonb not null default '[]',
  deal text not null default '' check (char_length(deal) <= 200),
  plan text not null default 'starter' check (plan in ('starter','growth','premium')),
  requested_plan text not null default 'starter' check (requested_plan in ('starter','growth','premium')),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  paid boolean not null default false,
  verified boolean not null default false,
  featured boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.businesses enable row level security;

create policy "see approved, own, or all if admin" on public.businesses for select
  using (status = 'approved' or owner = auth.uid() or public.is_admin());
create policy "signed-in people add their own" on public.businesses for insert to authenticated
  with check (owner = auth.uid());
create policy "owner or admin edits" on public.businesses for update to authenticated
  using (owner = auth.uid() or public.is_admin())
  with check (owner = auth.uid() or public.is_admin());
create policy "owner or admin deletes" on public.businesses for delete to authenticated
  using (owner = auth.uid() or public.is_admin());

-- Owners cannot approve themselves or give themselves a paid plan.
-- Only the admin can change plan, status, paid, verified and featured.
create function public.guard_business() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user not in ('anon', 'authenticated') then return new; end if;  -- SQL editor
  if public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    new.owner := auth.uid();
    new.plan := 'starter'; new.status := 'pending';
    new.paid := false; new.verified := false; new.featured := false;
  else
    new.owner := old.owner;
    new.plan := old.plan; new.status := old.status;
    new.paid := old.paid; new.verified := old.verified; new.featured := old.featured;
  end if;
  if new.plan = 'starter' then new.deal := ''; end if;
  return new;
end $$;
create trigger guard_business before insert or update on public.businesses
  for each row execute function public.guard_business();

-- ---------- reviews ---------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  stars int not null check (stars between 1 and 5),
  body text not null check (char_length(body) between 3 and 600),
  created_at timestamptz not null default now()
);
alter table public.reviews enable row level security;
create policy "anyone reads reviews" on public.reviews for select using (true);
create policy "anyone writes a review" on public.reviews for insert with check (true);
create policy "admin removes reviews" on public.reviews for delete to authenticated using (public.is_admin());

-- ---------- request board --------------------------------------------
create table public.requests (
  id uuid primary key default gen_random_uuid(),
  need text not null check (char_length(need) between 5 and 300),
  when_text text not null default '',
  name text not null check (char_length(name) between 1 and 40),
  cat text not null default 'other',
  replies int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.requests enable row level security;
create policy "anyone reads requests" on public.requests for select using (true);
create policy "admin removes requests" on public.requests for delete to authenticated using (public.is_admin());

-- WhatsApp numbers of people who post requests are kept apart, so the
-- public cannot read them. Only approved business owners can fetch one.
create table public.request_contacts (
  request_id uuid primary key references public.requests on delete cascade,
  wa text not null
);
alter table public.request_contacts enable row level security;

create function public.post_request(p_need text, p_when text, p_name text, p_cat text, p_wa text)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  insert into public.requests (need, when_text, name, cat)
    values (p_need, coalesce(p_when, ''), p_name, coalesce(p_cat, 'other'))
    returning id into new_id;
  if coalesce(p_wa, '') <> '' then
    insert into public.request_contacts (request_id, wa) values (new_id, p_wa);
  end if;
  return new_id;
end $$;

-- Returns null if the caller may not see it, '' if no number was left.
create function public.request_contact(p_id uuid)
returns text language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin() or exists (
      select 1 from public.businesses b where b.owner = auth.uid() and b.status = 'approved')) then
    return null;
  end if;
  update public.requests r set replies = r.replies + 1 where r.id = p_id;
  return coalesce((select c.wa from public.request_contacts c where c.request_id = p_id), '');
end $$;

-- ---------- views and WhatsApp clicks ---------------------------------
create table public.hits (
  id bigint generated always as identity primary key,
  business_id uuid not null references public.businesses on delete cascade,
  kind text not null check (kind in ('view', 'wa')),
  created_at timestamptz not null default now()
);
create index hits_business_time on public.hits (business_id, created_at);
alter table public.hits enable row level security;
create policy "anyone records a hit" on public.hits for insert with check (true);

-- Public: WhatsApp contacts per business in the last 7 days.
create function public.public_counts()
returns table (business_id uuid, contacts bigint)
language sql stable security definer set search_path = public as $$
  select h.business_id, count(*) from public.hits h
  where h.kind = 'wa' and h.created_at > now() - interval '7 days'
  group by h.business_id
$$;

-- Owner or admin: weekly views and clicks for the last 4 weeks (wk 0 = this week).
create function public.biz_stats(p_id uuid)
returns table (wk int, k text, n bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_admin() or exists (
      select 1 from public.businesses b where b.id = p_id and b.owner = auth.uid())) then
    return;
  end if;
  return query
    select floor(extract(epoch from (now() - h.created_at)) / 604800)::int, h.kind, count(*)
    from public.hits h
    where h.business_id = p_id and h.created_at > now() - interval '28 days'
    group by 1, 2;
end $$;

-- ---------- community events -----------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  date_text text not null,
  title text not null,
  detail text not null default '',
  created_at timestamptz not null default now()
);
alter table public.events enable row level security;
create policy "anyone reads events" on public.events for select using (true);
create policy "admin adds events" on public.events for insert to authenticated with check (public.is_admin());
create policy "admin removes events" on public.events for delete to authenticated using (public.is_admin());

-- ---------- photo storage --------------------------------------------
insert into storage.buckets (id, name, public) values ('photos', 'photos', true)
  on conflict (id) do nothing;
create policy "photos are public" on storage.objects for select using (bucket_id = 'photos');
create policy "signed-in people upload photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos');

-- ---------- access for the website -----------------------------------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage on all sequences in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;

-- =====================================================================
-- AFTER you have created your own account on the website, make yourself
-- the admin by running this one line (with your email):
--
--   update public.profiles set is_admin = true where email = 'you@example.com';
-- =====================================================================
