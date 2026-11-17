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
4. In Table Editor, open `profiles` and set each user's `role` to `admin` or `boss`.
5. Copy `.env.example` to `.env` and enter your Project URL and anon/public key.
6. Stop and restart the dev server (`Ctrl+C`, then `npm run dev`).

The application uses the Supabase anon key in the browser. Never put a Supabase `service_role` key in `.env` or frontend code.

### Important Supabase note

Supabase mode uses authenticated users and Row Level Security. The SQL creates policies for:
- Admin: create/update reports and child data.
- Boss: read submitted reports only.
- Both roles: read their own profile.

Create the first admin user in Supabase Auth, then set their profile role to `admin` using the SQL editor. Do not allow public signup in a production deployment unless you add a controlled invitation workflow.

## Excel import format

The importer accepts `.xlsx` and `.xls` files. It reads the first worksheet as a key/value sheet (columns `Field` and `Value`) or recognizes the included multi-sheet template.

Download a blank template from **Excel Import** in the app. The workbook contains:
- `Production`: one row with reporting date, production date, monthly order, monthly totals, daily production, targets and Columbia figures.
- `Stock`: columns `Category`, `MTR`, `KG`, `Rolls`.
- `Resources`: `Field`, `Value` rows for yarn stock, manpower and machine counts.

The preview screen validates the workbook before saving. Missing numeric values are shown as warnings; invalid dates and negative values are errors.

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
