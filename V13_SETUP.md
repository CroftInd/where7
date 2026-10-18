# WHERE7 V13 — spoiler-free archive and admin-only challenge management

## Admin access (required)
1. Supabase Dashboard → Authentication → Users → find your own user → copy **User UID** (UUID). Do not use the service role key or your password.
2. In Vercel → WHERE7 project → Settings → Environment Variables, add `ADMIN_USER_ID` set to that exact Supabase Auth user UID for Production (and Preview if needed).
3. Keep `ADMIN_EMAILS` set to **only your account email address**. Both email and UID must match for admin API access.
4. Redeploy after changing environment variables. Other users visiting `/admin` see a restricted page. Signed-out visitors can see the sign-in form, but cannot access admin data.
5. No client-side check alone is relied upon: `/api/admin/challenges` and `/api/admin/places` both call `requireAdmin` on the server. Never expose `SUPABASE_SERVICE_ROLE_KEY` with a `NEXT_PUBLIC_` prefix.

## Archive
- Public `/archive` shows only date and a generic 'Daily expedition' label, not challenge title, country, difficulty or destination.
- Public `/api/archive` includes only the date: no challenge ID, titles or difficulty. Practice uses a date alias resolved server-side to avoid leaking landmark names through URL slugs. Previously assigned days are shown only after midnight UTC.
- Selecting Practice still opens the challenge itself and may reveal details once playing; the archive listing does not spoil answers.

## Admin published challenges
- `/admin` → Published challenges now groups saved database challenges by country, showing publication status and allowing edits.
- The list should populate immediately from `public.challenges` and does not wait for a daily rollover.
- If it is empty, check in Supabase SQL Editor: `select country_iso3, status, count(*) from public.challenges group by country_iso3, status;`
- Generated daily challenges from the geography tree appear once generated in the database; geography entries are edited under Geography library.

## Deploy
Replace the files in your existing project, retain your current `.env.local`, and run `npm run build` before pushing. No database migration required.
