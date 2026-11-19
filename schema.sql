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
  video text not null default '',
  instagram text not null default '',
  facebook text not null default '',
  tiktok text not null default '',
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

-- ---------- admin: set a forgotten password ---------------------------
create function public.admin_set_password(p_email text, p_password text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_admin() then raise exception 'Only the admin can do this.'; end if;
  if char_length(coalesce(p_password, '')) < 6 then raise exception 'Use at least 6 characters.'; end if;
  update auth.users set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')), updated_at = now()
    where lower(email) = lower(trim(p_email));
  if not found then raise exception 'No account with that email.'; end if;
end $$;
revoke execute on function public.admin_set_password(text, text) from public, anon;
grant execute on function public.admin_set_password(text, text) to authenticated;

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


-- =====================================================================
-- Vazuva: automatic approvals, payments, expiry and reports.
-- Paste this whole file into Supabase > SQL Editor > New query > Run.
-- Safe to run again if you are not sure it worked.
-- =====================================================================

-- ---------- new details on each business ------------------------------
alter table public.businesses
  add column if not exists paid_until timestamptz,
  add column if not exists lapsed_plan text not null default '',
  add column if not exists review_note text not null default '';

-- ---------- automatic checks on new listings --------------------------
-- Returns '' when a listing looks fine, otherwise the reason it needs
-- the admin to look at it.
create or replace function public.review_problem(p_id uuid, p_owner uuid, p_name text, p_wa text, p_tagline text)
returns text language plpgsql stable security definer set search_path = public as $$
begin
  if char_length(trim(coalesce(p_tagline, ''))) < 5 then
    return 'The one-line summary is missing or very short.';
  end if;
  if coalesce(p_wa, '') !~ '^2637[0-9]{8}$' then
    return 'The WhatsApp number is not a Zimbabwean mobile number.';
  end if;
  if exists (select 1 from businesses b where b.id <> p_id and b.status <> 'rejected'
             and lower(trim(b.name)) = lower(trim(p_name))) then
    return 'Another listing already uses this name.';
  end if;
  if exists (select 1 from businesses b where b.id <> p_id and b.status <> 'rejected'
             and b.wa = p_wa and b.owner <> p_owner) then
    return 'Another owner already uses this WhatsApp number.';
  end if;
  if exists (select 1 from businesses b where b.owner = p_owner and b.status = 'rejected') then
    return 'This owner has had a listing rejected before.';
  end if;
  return '';
end $$;

-- Owners cannot approve themselves, give themselves a paid plan or change
-- payment dates. New listings that pass the checks go live straight away.
create or replace function public.guard_business() returns trigger
language plpgsql set search_path = public as $$
declare problem text;
begin
  if current_user not in ('anon', 'authenticated') then return new; end if;  -- the system itself
  if tg_op = 'INSERT' then
    if not public.is_admin() then
      new.owner := auth.uid();
      new.plan := 'starter'; new.paid := false; new.verified := false; new.featured := false;
      new.paid_until := null; new.lapsed_plan := '';
    end if;
    problem := public.review_problem(new.id, new.owner, new.name, new.wa, new.tagline);
    new.status := case when problem = '' then 'approved' else 'pending' end;
    new.review_note := problem;
  elsif not public.is_admin() then
    new.owner := old.owner; new.plan := old.plan; new.status := old.status;
    new.paid := old.paid; new.verified := old.verified; new.featured := old.featured;
    new.paid_until := old.paid_until; new.lapsed_plan := old.lapsed_plan; new.review_note := old.review_note;
  end if;
  if new.plan = 'starter' then new.deal := ''; end if;
  return new;
end $$;

-- ---------- payments ---------------------------------------------------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses on delete cascade,
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  plan text not null check (plan in ('growth', 'premium')),
  amount numeric not null default 0 check (amount >= 0 and amount < 1000),
  reference text not null check (char_length(reference) between 3 and 60),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected')),
  created_at timestamptz not null default now()
);
create unique index if not exists payments_one_pending on public.payments (business_id) where status = 'pending';
alter table public.payments enable row level security;
drop policy if exists "owner or admin reads payments" on public.payments;
create policy "owner or admin reads payments" on public.payments for select
  using (owner = auth.uid() or public.is_admin());
drop policy if exists "owner sends payment details" on public.payments;
create policy "owner sends payment details" on public.payments for insert to authenticated
  with check (owner = auth.uid() and status = 'pending'
    and exists (select 1 from public.businesses b where b.id = business_id and b.owner = auth.uid()));
grant select, insert on public.payments to authenticated;

-- Admin confirms (or turns down) a payment. Confirming switches the plan on
-- for 30 days, added on to any time already paid for.
create or replace function public.admin_confirm_payment(p_id uuid, p_ok boolean)
returns void language plpgsql security definer set search_path = public as $$
declare pay public.payments;
begin
  if not public.is_admin() then raise exception 'Only the admin can do this.'; end if;
  select * into pay from payments where id = p_id and status = 'pending';
  if not found then raise exception 'That payment was already handled.'; end if;
  update payments set status = case when p_ok then 'confirmed' else 'rejected' end where id = p_id;
  if p_ok then
    update businesses set plan = pay.plan, paid = true, lapsed_plan = '',
      paid_until = greatest(coalesce(paid_until, now()), now()) + interval '30 days'
      where id = pay.business_id;
  end if;
end $$;

-- Admin adds a month by hand, for cash payments.
create or replace function public.admin_extend(p_id uuid, p_plan text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only the admin can do this.'; end if;
  if p_plan not in ('growth', 'premium') then raise exception 'Choose Growth or Premium first.'; end if;
  update businesses set plan = p_plan, paid = true, lapsed_plan = '',
    paid_until = greatest(coalesce(paid_until, now()), now()) + interval '30 days'
    where id = p_id;
end $$;

-- ---------- reports ----------------------------------------------------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses on delete cascade,
  reason text not null check (char_length(reason) between 2 and 200),
  reporter text not null check (char_length(reporter) between 8 and 64),
  created_at timestamptz not null default now(),
  unique (business_id, reporter)
);
alter table public.reports enable row level security;
drop policy if exists "admin reads reports" on public.reports;
create policy "admin reads reports" on public.reports for select to authenticated using (public.is_admin());
drop policy if exists "admin clears reports" on public.reports;
create policy "admin clears reports" on public.reports for delete to authenticated using (public.is_admin());
grant select, delete on public.reports to authenticated;

-- Anyone can report a listing. Three different people hide it until the admin looks.
create or replace function public.report_listing(p_id uuid, p_reason text, p_reporter text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into reports (business_id, reason, reporter) values (p_id, left(p_reason, 200), p_reporter)
    on conflict do nothing;
  if (select count(*) from reports where business_id = p_id) >= 3 then
    update businesses set status = 'pending', review_note = 'Hidden after reports from 3 people.'
      where id = p_id and status = 'approved';
  end if;
end $$;

-- When the admin approves a listing, its old reports are cleared.
create or replace function public.clear_reports() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'approved' and old.status <> 'approved' then
    delete from reports where business_id = new.id;
  end if;
  return null;
end $$;
drop trigger if exists clear_reports on public.businesses;
create trigger clear_reports after update of status on public.businesses
  for each row execute function public.clear_reports();

-- ---------- housekeeping, run each time someone opens the site ---------
-- Ends plans whose 30 days are up and clears requests older than 14 days.
create or replace function public.housekeeping()
returns void language plpgsql security definer set search_path = public as $$
begin
  update businesses set lapsed_plan = plan, plan = 'starter', paid = false, featured = false, deal = ''
    where plan <> 'starter' and paid_until is not null and paid_until < now();
  delete from requests where created_at < now() - interval '14 days';
end $$;

-- ---------- access for the website -----------------------------------
grant execute on function public.review_problem(uuid, uuid, text, text, text) to authenticated;
grant execute on function public.admin_confirm_payment(uuid, boolean) to authenticated;
grant execute on function public.admin_extend(uuid, text) to authenticated;
grant execute on function public.report_listing(uuid, text, text) to anon, authenticated;
grant execute on function public.housekeeping() to anon, authenticated;


-- =====================================================================
-- Vazuva: delete account, and photo clean-up.
-- Paste this whole file into Supabase > SQL Editor > New query > Run.
-- Safe to run again if you are not sure it worked.
-- =====================================================================

-- An owner deletes their own account. Their businesses, payments and
-- profile go with it. The admin account cannot be deleted this way.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if public.is_admin() then raise exception 'The admin account cannot be deleted from here.'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Owners can delete photo files they uploaded themselves.
drop policy if exists "people delete their own photos" on storage.objects;
create policy "people delete their own photos" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and owner_id = (select auth.uid()::text));


-- =====================================================================
-- Vazuva: private website suggestions (only the admin sees them).
-- Paste this whole file into Supabase > SQL Editor > New query > Run.
-- Safe to run again, and works whether or not you ran ideas-update.sql.
-- =====================================================================

create table if not exists public.ideas (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'website' check (kind in ('community', 'website')),
  body text not null check (char_length(body) between 5 and 600),
  name text not null default '' check (char_length(name) <= 40),
  status text not null default 'new' check (status in ('new', 'planned', 'done')),
  votes int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.ideas add column if not exists topic text not null default '';
alter table public.ideas enable row level security;

-- The public board is gone: remove its ideas, votes and rules.
delete from public.ideas where kind = 'community';
drop function if exists public.vote_idea(uuid, text);
drop table if exists public.idea_votes;
drop policy if exists "read community ideas" on public.ideas;
drop policy if exists "anyone shares an idea" on public.ideas;

-- Anyone can send a suggestion. Only the admin can read, update or remove them.
drop policy if exists "admin reads suggestions" on public.ideas;
create policy "admin reads suggestions" on public.ideas for select to authenticated using (public.is_admin());
drop policy if exists "anyone sends a suggestion" on public.ideas;
create policy "anyone sends a suggestion" on public.ideas for insert
  with check (kind = 'website' and status = 'new' and votes = 0 and char_length(topic) <= 40);
drop policy if exists "admin updates ideas" on public.ideas;
create policy "admin updates ideas" on public.ideas for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin removes ideas" on public.ideas;
create policy "admin removes ideas" on public.ideas for delete to authenticated using (public.is_admin());
grant insert on public.ideas to anon, authenticated;
grant select, update, delete on public.ideas to authenticated;
