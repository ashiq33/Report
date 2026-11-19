# Warp Knitting Daily Production Report

A React + TypeScript reporting app for daily Warp Knitting production. It includes Excel import, KPI calculations, report history, WhatsApp text generation, PDF export, and optional Supabase authentication/database integration.

## Quick start

1. Install Node.js LTS: https://nodejs.org/
2. Extract this project.
3. Open the project folder in VS Code.
4. Open Terminal and run:

```bash
npm install
npm run dev
```

5. Open the local URL printed in the terminal (normally http://localhost:5173).

### Demo mode

The app runs immediately in **local demo mode** without Supabase credentials. Data is saved in the browser's local storage on that computer/browser. Use the role switcher in the sidebar to preview Admin and Boss experiences. Demo mode is for testing only; it does not synchronize between devices or users.

## Enable Supabase

1. Create a project at https://supabase.com/.
2. In Supabase, open SQL Editor and run `supabase/schema.sql`.
3. In Authentication > Users, create user accounts for the admin and boss.
4. In Table Editor, open `profiles` and set the intended accounts to `admin`, `boss`, or `user`. New accounts are created with the least-privilege `user` role.
5. Copy `.env.example` to `.env` and enter your Project URL and anon/public key.
6. Stop and restart the dev server (`Ctrl+C`, then `npm run dev`).

The application uses the Supabase anon key in the browser. Never put a Supabase `service_role` key in `.env` or frontend code.

### Important Supabase note

Supabase mode uses authenticated users and Row Level Security. The SQL creates policies for:
- Admin: create/update all reports and child data; manage profile roles.
- Boss: read submitted reports only.
- User: read only reports they created; no administrative routes.
- Each account can read its own profile role. New accounts default to `user`.

Create the Auth users first. Then promote the intended accounts in the SQL Editor (replace the email addresses):

```sql
update public.profiles p set role = 'admin'
where p.id = (select id from auth.users where email = 'admin@example.com');

update public.profiles p set role = 'boss'
where p.id = (select id from auth.users where email = 'boss@example.com');
```

Do not allow public signup in a production deployment unless you add a controlled invitation workflow. The `service_role` key must never be placed in the browser app.

## Excel import format

The importer accepts `.xlsx` and `.xls` files. It reads the first worksheet as a key/value sheet (columns `Field` and `Value`) or recognizes the included multi-sheet template.

Download a blank template from **Excel Import** in the app. The workbook contains:
- `Production`: one row with reporting date, production date, monthly order, monthly totals, daily production, targets and Columbia figures.
- `Stock`: columns `Category`, `MTR`, `KG`, `Rolls`.
- `Resources`: `Field`, `Value` rows for yarn stock, manpower and machine counts.

The preview screen validates the workbook before saving. Missing numeric values are shown as warnings; invalid dates and negative values are errors.

## Vercel build settings

Use these settings in Vercel → Project → Settings → Build and Development Settings:
- Framework Preset: Vite
- Root Directory: `./` (the folder containing `package.json`)
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `dist`

Build-time packages (including Vite and TypeScript) are listed in `dependencies` so they remain available even if the install environment omits development dependencies. Avoid setting the Install Command to `npm install --omit=dev` or `npm install --production`.

## Build and deploy to GitHub / Vercel

```bash
npm run build
```

To publish:
1. Create a new GitHub repository.
2. Upload the extracted project files (including `package.json`, `src`, `supabase`, etc.).
3. In Vercel, import the GitHub repository.
4. Framework preset: Vite.
5. Build command: `npm run build`.
6. Output directory: `dist`.
7. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel Environment Variables if using Supabase.
8. Redeploy after adding environment variables.

GitHub Pages can host the frontend, but Vercel is recommended for straightforward SPA routing and environment configuration.

## Included features

- Responsive dashboard and navigation
- Admin / Boss role experience
- Excel template download and upload
- Production, stock, manpower and machine data
- Automatic daily/monthly achievement and stock differences
- Report preview, submit, edit and archive
- WhatsApp-ready report text with copy/share
- PDF export
- Local demo mode and Supabase mode
- Supabase SQL schema with RLS policies

## Business rules to confirm

The app intentionally keeps physical greige, Glostom greige, SAP greige and Glostom SAP stock separate. It does not assume which values should be added to create a combined total. Confirm your organization's definition before adding a combined stock KPI.

Monthly production is treated as the cumulative monthly figure entered for the report. It is not added to previous cumulative snapshots, avoiding double-counting.


## Deployment and route refresh

`vercel.json` rewrites application routes to `index.html`, so direct visits and refreshes on `/analytics` and other client-side routes are served by the React app. After changing environment variables or this configuration, redeploy the Vercel project.

The app reloads report data after authentication becomes ready and when the route/location changes. The Retry action runs the report query again.
