# Music Star

A responsive music school workspace built with HTML, CSS, and JavaScript.

## Run locally

From this folder run `python -m http.server 8000 --bind 127.0.0.1`, then open http://localhost:8000.

## Features

- Director overview and individual teacher previews
- Add, edit, and delete students, teachers, and lessons
- Weekly recurring lessons: choose Every week and 2-52 lessons, including the first; all dates are checked for conflicts before any lessons are added. Edit and delete individual occurrences independently.
- Month and week lesson calendars with previous/next navigation, Today shortcut, teacher filters, and instrument colors. Add lessons from a date, click a lesson to edit, or delete an individual occurrence.
- Today, upcoming, and all-lesson lists on the overview
- Lesson attendance and teacher/student/room overlap checks
- Branded A4 PDF invoices with billing details, tuition description, subtotal, total, payment status, balance due, payment reference, and automatic pagination for long descriptions
- Completed teaching hours and estimated gross salaries at current hourly rates
- Browser-local persistence using localStorage

## Scope

This is a local demonstration with sample data. The account selector previews role-based views, not authenticated accounts. Browser data is accessible to anyone with access to the browser. Production use requires a backend with authentication and server-side authorization, a database, backups, and protected handling of student and parent information. Salary estimates use all completed lessons and current rates; they do not implement payroll periods, historical rates, deductions, or payments. PDF invoices use standard Helvetica and replace unsupported non-ASCII characters with question marks.
