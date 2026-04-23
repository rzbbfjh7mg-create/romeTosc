# Supabase Setup

האתר בנוי עכשיו לעבוד כאתר סטטי על GitHub Pages, עם שמירת הנתונים ב-Supabase.

## 1. Create a Supabase project

1. כנס ל-[Supabase](https://supabase.com/).
2. צור פרויקט חדש.
3. חכה שהפרויקט יסיים לעלות.

## 2. Create the table

ב-Supabase:
1. כנס ל-`SQL Editor`
2. צור Query חדש
3. הדבק את ה-SQL הבא
4. הרץ

```sql
create table if not exists public.trip_state (
  id text primary key,
  days jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.trip_state enable row level security;

drop policy if exists "Public can read trip state" on public.trip_state;
create policy "Public can read trip state"
on public.trip_state
for select
to anon
using (true);

drop policy if exists "Public can write trip state" on public.trip_state;
create policy "Public can write trip state"
on public.trip_state
for insert
to anon
with check (true);

drop policy if exists "Public can update trip state" on public.trip_state;
create policy "Public can update trip state"
on public.trip_state
for update
to anon
using (true)
with check (true);
```

## 3. Copy project credentials

ב-Supabase:
1. כנס ל-`Project Settings`
2. כנס ל-`API`
3. תעתיק:
- `Project URL`
- `anon public key`

## 4. Fill in `trip-config.js`

פתח את הקובץ [trip-config.js](/Users/tomlevy/Documents/New%20project/trip-config.js) והחלף:

```js
window.TRIP_APP_CONFIG = {
  supabaseUrl: "YOUR_SUPABASE_URL",
  supabaseAnonKey: "YOUR_SUPABASE_ANON_KEY"
};
```

למשל:

```js
window.TRIP_APP_CONFIG = {
  supabaseUrl: "https://abcdefghijk.supabase.co",
  supabaseAnonKey: "eyJ..."
};
```

## 5. Push to GitHub

```bash
cd "/Users/tomlevy/Documents/New project"
git add .
git commit -m "Switch trip site to GitHub Pages and Supabase"
git push
```

## 6. Enable GitHub Pages

ב-GitHub:
1. פתח את הריפו
2. כנס ל-`Settings`
3. כנס ל-`Pages`
4. תחת `Build and deployment` בחר:
- `Source: Deploy from a branch`
- `Branch: main`
- `Folder: / (root)`
5. לחץ `Save`

GitHub ייתן לך URL ציבורי בסגנון:

```text
https://YOUR_GITHUB_USERNAME.github.io/YOUR_REPO_NAME/
```

## Notes

- כרגע כל מי שפותח את האתר יכול גם לערוך את המסלול, כי המדיניות ב-Supabase פתוחה ל-`anon`.
- אם תרצה בהמשך, אפשר להוסיף התחברות ולהגביל עריכה רק לך.
