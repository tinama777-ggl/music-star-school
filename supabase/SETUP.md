# Music Star: Supabase setup

These scripts prepare a fresh Supabase database. They do not connect the website or migrate browser records. Your existing demo stays unchanged.

## 0. Check first

Open your Supabase project > SQL Editor > New query. Paste and run `00-check-existing-tables.sql`.

If it returns any table names, stop before step 1: the existing schema needs a migration. Do not delete tables. An empty result means the six Music Star table names are available. Other unrelated tables can remain.

## 1. Create the database

Paste the entire contents of `01-create-database.sql` into one new query and click Run. Run it once. Success may say "Success. No rows returned". The transaction creates all six tables, validation, overlap constraints, indexes, row security, and a weekly-lessons function together. If it fails, no partial setup is committed; share the exact error before retrying.

The tables are profiles, teachers, teacher_rates, students, lessons, and invoices. Teacher rates are director-only. Teachers can read their own teacher record and manage their assigned students, lessons, and invoices. They cannot create roles, promote themselves, edit teachers, or see other teachers' records. Unauthenticated visitors cannot access these tables.

Lesson times use the school's Pacific/Auckland wall-clock time. Database constraints reject overlapping teacher, student, and room bookings, including concurrent requests. The weekly function saves a series atomically. Teacher rates have effective dates for future historical salary calculation.

## 2. Create your director login

In Authentication > Users, use Add user to create your own email/password account or invite yourself. Complete any required verification/invitation. Do not insert passwords with SQL or share them in chat.

Open `02-create-director.sql`, replace the two REPLACE_WITH values, and run the entire file in SQL Editor. It links your existing Auth user to a director profile. Only run role-assignment scripts in the trusted SQL Editor, never from browser code.

## 3. Add a teacher login

Optional now, required for teacher access tests later. Create a different account in Authentication > Users. Replace the values in `03-add-teacher.sql`, choose the instrument and hourly rate, and run it. Repeat for other teachers. The Auth account, application profile, teacher record, and salary rate are linked by UUID, not by a client-supplied role.

## 4. Verify

Run each SELECT in `04-verify-setup.sql` separately. All six tables must have row security enabled; all anonymous-access booleans must be false. Check the director and teacher roles and lesson overlap constraints. These are configuration checks, not a complete authorization test. Before real data use, test actual signed-in API requests for director, teacher A, teacher B, and signed-out visitors, including attempts to change roles and access another teacher's records.

## 5. Configure sign-in URLs (dashboard, no SQL)

Authentication > URL Configuration:

- Site URL: https://music-star-school.netlify.app
- Redirect URLs: https://music-star-school.netlify.app/ and http://localhost:8000/

Use your actual development URL if different. Staff accounts are provisioned by the director/trusted administrator. Disable public sign-ups under Authentication settings if you do not want visitors registering accounts; unprovisioned accounts have no application profile or data access under these policies.

## 6. Enable teacher/rate saves

Run the whole `05-teacher-save.sql` file in SQL Editor. It adds an authenticated, director-only transactional save for a teacher record and its dated rate. It is safe to rerun. Do not rerun `01-create-database.sql`.

## 7. Connect and test the app

The supplied project URL and publishable key are now configured in `supabase-config.js`. The app uses real Supabase sign-in and data operations. No business records are loaded from the old demo localStorage key. Supabase still keeps the login session in browser storage.

Start the local server and sign in using your director account. Add a student, create a weekly lesson series, make an invoice, download its PDF, and refresh to check persistence. Test a linked teacher account separately. Before using real data, verify director, teacher A, teacher B, and signed-out API behavior, including blocked access to other teachers and blocked role changes.

New teacher records can be created in the app, but their sign-in users must still be provisioned in Authentication > Users and linked with `03-add-teacher.sql`. App forms can select already provisioned teacher profiles. Administrative Auth operations are deliberately kept out of browser code.

Use active=false to archive teachers with historical invoices/rates instead of deleting financial history. Student deletion removes lessons but preserves invoice contact snapshots. Retain student records if their lesson history is needed for salary estimates. Browser sample data is not imported automatically.

## References

- https://supabase.com/docs/guides/database/tables
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/auth/managing-user-data
- https://www.postgresql.org/docs/current/rangetypes.html

## Password recovery configuration

The app now supports current-password verification for signed-in changes and a Forgot password email flow. Add `https://music-star-school.netlify.app/?reset=password` and `http://localhost:8000/?reset=password` to Authentication > URL Configuration > Redirect URLs. Configure custom SMTP for recovery emails to normal teacher/director addresses; the default Supabase sender only delivers to Supabase organization team members. Keep the email template's `{{ .ConfirmationURL }}` link. No new SQL is required for password changes. Redeploy the frontend and verify an actual recovery email and successful sign-in with the new password before relying on this flow.
