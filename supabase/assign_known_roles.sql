-- Warp Knitting Daily Production Report: assign the known account roles.
-- Run in Supabase SQL Editor as project owner AFTER the schema has been applied.
-- Each update matches BOTH the Auth UID and email for safety.

update public.profiles
set role = 'user'
where id = 'ce3dbe0e-3e02-4dd1-acf0-8eb274a46262'::uuid
  and lower(email) = lower('user@user.com');

update public.profiles
set role = 'admin'
where id = '298bbd7e-b23c-4a6e-b8a1-9847e934bab8'::uuid
  and lower(email) = lower('ashiqshahariar@gmail.com');

update public.profiles
set role = 'boss'
where id = '08a443fe-9cb9-462e-aae2-1705e1241117'::uuid
  and lower(email) = lower('ashiqshahariar003@gmail.com');

-- Verify exact account-to-role mapping. Any missing/mismatched account is visible here.
select
  p.id,
  p.email,
  p.role,
  case
    when p.id = 'ce3dbe0e-3e02-4dd1-acf0-8eb274a46262'::uuid and lower(p.email) = lower('user@user.com') and p.role = 'user' then 'OK'
    when p.id = '298bbd7e-b23c-4a6e-b8a1-9847e934bab8'::uuid and lower(p.email) = lower('ashiqshahariar@gmail.com') and p.role = 'admin' then 'OK'
    when p.id = '08a443fe-9cb9-462e-aae2-1705e1241117'::uuid and lower(p.email) = lower('ashiqshahariar003@gmail.com') and p.role = 'boss' then 'OK'
    else 'CHECK UID / EMAIL / ROLE'
  end as verification
from public.profiles p
where p.id in (
  'ce3dbe0e-3e02-4dd1-acf0-8eb274a46262'::uuid,
  '298bbd7e-b23c-4a6e-b8a1-9847e934bab8'::uuid,
  '08a443fe-9cb9-462e-aae2-1705e1241117'::uuid
)
order by case p.role when 'admin' then 1 when 'boss' then 2 else 3 end;
