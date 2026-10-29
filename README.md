# Music Star

A responsive music-school workspace with Supabase sign-in and shared PostgreSQL data, deployable as a static Netlify site.

## Run locally

Run `python -m http.server 8000 --bind 127.0.0.1` in this folder, then visit http://localhost:8000. Internet access is required for Supabase requests.

Sign in with an account created in your Supabase project, linked to an active director/teacher profile. The app no longer loads demo records or reads/writes the `musicstar-v2` localStorage key. Old demo data is left untouched and is not automatically imported. Supabase stores the authentication session in browser storage to keep you signed in; business records are stored in Postgres.

## Database setup

Follow [supabase/SETUP.md](supabase/SETUP.md). Existing installations that already ran steps 00-04 must also run [supabase/05-teacher-save.sql](supabase/05-teacher-save.sql). This adds the atomic teacher/rate save function used by the new teacher form; it does not change existing data. Do not rerun 01 on an existing schema.

The public URL and publishable key are in `supabase-config.js`. They are intended for browser use. Never put database passwords, secret keys, or service-role keys in these files. Supabase JS 2.118.0 is pinned and vendored under `vendor/` so the app does not depend on a CDN for authentication code at runtime. Supabase JS is MIT licensed: https://github.com/supabase/supabase-js/blob/master/LICENSE.

## Features

- Email/password sign-in, sign-out, persistent session, explicit refresh, and connection/error states
- Director workspace and individual teacher access enforced by database RLS
- Shared students, lessons, teacher records, invoice snapshots and payment statuses
- Month/week calendars, instrument colors, date navigation, and individual lesson edits/deletes
- Weekly recurring lessons saved atomically through `create_weekly_lessons`; overlap constraints also protect against concurrent bookings
- Branded, downloadable A4 parent invoice PDFs with correct invoice numbers, totals and paid balances
- Historical teacher rates and estimated gross salary by completed lesson date; lessons without an applicable rate are explicitly flagged and excluded

## Staff accounts

Creating a teacher record does not create a sign-in account. Use Supabase Authentication > Users for accounts, then `03-add-teacher.sql` to provision the application profile and teacher link. The director can select already provisioned teacher profiles in the teacher form. The browser never uses Supabase Auth administrative credentials. Invitations and staff-account provisioning are handled in the Supabase dashboard. Users can change their own passwords in the app or request reset emails from the sign-in screen.

Teacher removal archives their record and disables access to teaching records; reassign/remove students first. Historical rates and invoices are retained. Student deletion removes their lessons and preserves issued invoice snapshots. Teacher reassignment is blocked while the student has lessons.

## Netlify deployment

Publish this folder, including `vendor/`, `supabase-config.js`, and `data-service.js`; no build step is required. Redeploy after committing/pushing or by uploading the updated folder. Under Supabase Authentication > URL Configuration use `https://music-star-school.netlify.app` as Site URL and allow `https://music-star-school.netlify.app/` and `http://localhost:8000/` as redirect URLs. Disable public sign-up if accounts should be staff-only.

## Validation and limits

Database setup scripts enable RLS and deny anonymous business-table access. Before real school use, test API requests as the director, teacher A, teacher B, and a signed-out visitor. Verify cross-teacher CRUD and role changes are rejected. A publishable key alone cannot test authenticated permissions; no sign-in passwords belong in this repository.

Use Refresh records to see changes made in another session (live subscriptions are not implemented). Salaries are gross estimates, not payroll/deductions/payment processing. Deleted student lessons no longer contribute to salary estimates, so retain student records when their history is needed. PDFs use Helvetica and transliterate common accented Latin characters; unsupported scripts use a question-mark fallback. No automatic demo-data migration, Auth account creation from the app, or tax/bank-account configuration is included.

## Development checks

With localhost:8000 running, use `python tests/run_browser_checks.py` for isolated mock-account integration checks. Use `python tests/run_browser_checks.py --live` for the real signed-out screen and read-only anonymous permission checks. The Windows runner uses installed Edge and the Python `websocket-client` package (install using pip if needed). It uses a fresh temporary browser profile and does not use your saved sign-in session. Mock checks do not prove database RLS; live signed-in director/teacher API testing is still required.

## Password changes and recovery

Directors and teachers use **Change password** beneath their profile. The form verifies their current password through Supabase and confirms a new password of at least 8 characters; the server also applies the project password policy. Passwords are not stored in application tables or business-record localStorage.

**Forgot password?** on the sign-in screen requests a Supabase recovery email. A recovery link opens the new-password form instead of the school workspace. Expired sessions and update errors are shown in the form. After success, the app clears the password inputs and signs out locally so the user can sign in with the new password.

Add these exact URLs under Supabase Authentication > URL Configuration > Redirect URLs:

- `https://music-star-school.netlify.app/?reset=password`
- `http://localhost:8000/?reset=password`

The redirect uses the directory containing the app, so add the corresponding URL for any other host/port or subdirectory you use. Keep the standard recovery email template link (`{{ .ConfirmationURL }}`) so Supabase verifies the recovery token before redirecting. Redeploy the updated frontend before sending production reset links.

For reset emails to ordinary staff addresses, configure a custom SMTP sender under Supabase Authentication email settings. Supabase's default sender is restricted to organization team members and has low test limits: https://supabase.com/docs/guides/auth/auth-smtp. An application teacher account is not automatically a Supabase organization team member. No SQL migration is needed for password changes.
[Uploading data-service.js…]()
