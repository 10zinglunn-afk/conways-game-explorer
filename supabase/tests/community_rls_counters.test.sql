begin;

create extension if not exists pgtap with schema extensions;
create temp table community_tap (line text);
grant insert, select on table community_tap to anon, authenticated;

insert into community_tap select plan(19);

insert into auth.users (id, email)
values
  ('11111111-1111-4111-8111-111111111111', 'owner@example.com'),
  ('22222222-2222-4222-8222-222222222222', 'remixer@example.com');

insert into public.profiles (id, username, display_name, is_public)
values
  ('11111111-1111-4111-8111-111111111111', 'owner', 'Owner', true),
  ('22222222-2222-4222-8222-222222222222', 'remixer', 'Remixer', true);

insert into public.creations (
  id,
  owner_id,
  slug,
  title,
  visibility,
  root_creation_id,
  published_at
)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    '11111111-1111-4111-8111-111111111111',
    'public-source',
    'Public Source',
    'public',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    now()
  ),
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
    '11111111-1111-4111-8111-111111111111',
    'private-source',
    'Private Source',
    'private',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
    null
  );

insert into public.creation_versions (
  id,
  creation_id,
  rle,
  width,
  height,
  generation,
  population,
  rule
)
values
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    'x = 1, y = 1, rule = B3/S23\no!',
    1,
    1,
    0,
    1,
    'B3/S23'
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
    'x = 1, y = 1, rule = B3/S23\no!',
    1,
    1,
    0,
    1,
    'B3/S23'
  );

update public.creations
set current_version_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';

update public.creations
set current_version_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';

set local role anon;
set local "request.jwt.claim.sub" = '';

insert into community_tap select results_eq(
  $$select count(*)::int from public.creations$$,
  $$values (1)$$,
  'anon sees only public creations'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '22222222-2222-4222-8222-222222222222';

insert into community_tap select lives_ok(
  $$select public.save_creation(
      'cccccccc-cccc-4ccc-8ccc-ccccccccccc1'::uuid,
      'rpc-saved-public',
      'RPC Saved Public',
      'Saved through atomic RPC',
      array['rpc', 'save'],
      'public',
      now(),
      'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'::uuid,
      'x = 1, y = 1, rule = B3/S23\no!',
      1,
      1,
      2,
      1,
      'B3/S23'
    )$$,
  'save_creation RPC can save a public creation and version'
);

insert into community_tap select results_eq(
  $$select owner_id, visibility, current_version_id
      from public.creations
     where id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1'::uuid$$,
  $$values (
      '22222222-2222-4222-8222-222222222222'::uuid,
      'public'::text,
      'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'::uuid
    )$$,
  'save_creation owns the creation and points at its version'
);

insert into community_tap select results_eq(
  $$select generation, population
      from public.creation_versions
     where id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'::uuid$$,
  $$values (2, 1)$$,
  'save_creation writes the version payload'
);

set local "request.jwt.claim.sub" = '';

insert into community_tap select throws_ok(
  $$select public.save_creation(
      'cccccccc-cccc-4ccc-8ccc-ccccccccccc2'::uuid,
      'rpc-no-auth',
      'RPC No Auth',
      '',
      '{}',
      'private',
      null,
      'dddddddd-dddd-4ddd-8ddd-ddddddddddd2'::uuid,
      'x = 1, y = 1, rule = B3/S23\no!',
      1,
      1,
      0,
      1,
      'B3/S23'
    )$$,
  'P0001',
  'authentication required',
  'save_creation requires an authenticated uid'
);

set local "request.jwt.claim.sub" = '22222222-2222-4222-8222-222222222222';

insert into community_tap select results_eq(
  $$select count(*)::int from public.creations where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'::uuid$$,
  $$values (0)$$,
  'non-owner cannot read private creations'
);

insert into community_tap select is_empty(
  $$update public.creations
      set title = 'Stolen'
    where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid
    returning id$$,
  'non-owner cannot update another profile creation'
);

set local "request.jwt.claim.sub" = '11111111-1111-4111-8111-111111111111';

insert into community_tap select lives_ok(
  $$update public.creations
      set title = 'Owner Updated Source'
    where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid$$,
  'owner can update their creation'
);

set local "request.jwt.claim.sub" = '22222222-2222-4222-8222-222222222222';

insert into community_tap select lives_ok(
  $$insert into public.stars (profile_id, creation_id)
    values (
      '22222222-2222-4222-8222-222222222222'::uuid,
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid
    )$$,
  'authenticated profile can star a public creation'
);

insert into community_tap select results_eq(
  $$select star_count from public.creations where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid$$,
  $$values (1)$$,
  'star trigger increments star_count'
);

insert into community_tap select lives_ok(
  $$delete from public.stars
    where profile_id = '22222222-2222-4222-8222-222222222222'::uuid
      and creation_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid$$,
  'authenticated profile can unstar their own star'
);

insert into community_tap select results_eq(
  $$select star_count from public.creations where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid$$,
  $$values (0)$$,
  'star trigger decrements star_count'
);

insert into community_tap select throws_ok(
  $$insert into public.stars (profile_id, creation_id)
    values (
      '22222222-2222-4222-8222-222222222222'::uuid,
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'::uuid
    )$$,
  '42501',
  'new row violates row-level security policy for table "stars"',
  'authenticated profile cannot star a private creation'
);

insert into community_tap select throws_ok(
  $$insert into public.remixes (source_creation_id, remix_creation_id)
    values (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid,
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'::uuid
    )$$,
  '42501',
  'permission denied for table remixes',
  'direct remix inserts are blocked'
);

insert into community_tap select lives_ok(
  $$select public.clone_creation(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid,
      'public-source-remix-rls',
      'Public Source Remix'
    )$$,
  'clone_creation RPC can clone a public source'
);

insert into community_tap select results_eq(
  $$select clone_count from public.creations where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid$$,
  $$values (1)$$,
  'clone trigger increments clone_count'
);

insert into community_tap select results_eq(
  $$select count(*)::int
    from public.creations
    where slug = 'public-source-remix-rls'
      and owner_id = '22222222-2222-4222-8222-222222222222'::uuid
      and visibility = 'private'$$,
  $$values (1)$$,
  'clone_creation creates a private remix owned by the caller'
);

set local "request.jwt.claim.sub" = '11111111-1111-4111-8111-111111111111';

insert into community_tap select results_eq(
  $$select count(*)::int from public.creations where slug = 'public-source-remix-rls'$$,
  $$values (0)$$,
  'other profiles cannot read the private remix'
);

set local role anon;
set local "request.jwt.claim.sub" = '';

insert into community_tap select results_eq(
  $$select count(*)::int
      from public.trending_creations
     where id in (
       'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid,
       'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'::uuid
     )$$,
  $$values (1)$$,
  'anon can read the trending view for public creations only'
);

insert into community_tap select * from finish();
select line from community_tap;
rollback;
