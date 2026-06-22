# 📖 Translation Management System (TMS)

A modern web application that helps a translation team plan, track, and report progress across two workspaces: **Quranic translation** (languages, meetings & weekly schedule) and **English translation** (an 8‑stage production pipeline for books, bayans & magazine articles) — all from one clean, real‑time dashboard.

🌐 **Live App:** https://tms-dawateislami.vercel.app

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?logo=tailwind-css)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)
![Deployed on Vercel](https://img.shields.io/badge/Deployed-Vercel-black?logo=vercel)

---

## 🎯 What is this project?

Translating the Holy Quran into dozens of languages is a long, collaborative effort. Each
language has a responsible person, a project it belongs to, and a **weekly meeting** where
progress is reviewed. Keeping all of that organised — who met this week, who was missed, what
was discussed, and what comes next — quickly becomes hard to manage on paper or spreadsheets.

**TMS turns that whole process into a living, real‑time system:**

- Every language and its translation status in one place
- A **weekly meeting schedule** that automatically tells you which meetings happened and which
  are overdue
- A complete **record of every meeting** (participants, discussion points, action items)
- **Reports** that can be copied, exported, or printed in seconds
- **Role-based access** so the public can view progress while only authorised staff can edit

---

## ✨ Key Features

### 🗂️ Multi-Project & Language Tracking
- Manage multiple translation projects (**Kanz ul Irfan, Taleem ul Quran, Sirat ul Jinan**)
- Track **25+ languages** with country, responsible person, priority (Low / Medium / High)
  and work status (Not Started / In Progress / Completed)
- Project-wise statistics so you can see how each project is progressing

### 📅 Smart Weekly Meeting Schedule
- Every language is assigned a **weekly meeting day** (Monday–Saturday)
- A dedicated **Schedule** page groups languages by day and shows a clear status for each:
  - 🟢 **Met this week** · 🔵 **Due today** · 🟡 **Due this week** · 🔴 **Overdue**
- Follows the team's real cadence: a meeting every **7 days**, with an **overdue reminder
  after 14 days** if one is missed
- One-click **“Record Meeting”** straight from the schedule

### 📝 Meeting Records
- Capture meeting date, participants, discussion points, progress and action items
- Set an **optional next meeting date** that automatically appears in **Upcoming Meetings**
- Full meeting history for every language, with edit & delete

### 📊 Live Dashboard
- At-a-glance stats with **animated counters** and **donut/priority charts**
- **Recent meetings**, **languages needing attention**, and **urgent follow-ups**
- A personalised greeting banner with a **live ticking clock (date + time)**
- **Upcoming meetings** widget driven by scheduled follow-ups

### 🔎 Global Search
- Search across languages, countries, people, and meeting notes from anywhere in the app

### 📑 Reports & Export
- **Daily, Weekly, and Monthly** reports plus custom date ranges
- Grouped by language with discussion points and action items
- **Copy to clipboard**, **export to CSV**, or **print as PDF**

### 🔐 Roles & Access Control
- **Public view-only mode** — anyone can open the app and view progress (“Continue without login”)
- **Editors & Admins** can add, edit, and delete data
- **Admins** can create users and assign roles (Admin / Editor / Viewer)
- Security enforced at multiple layers (database, server, routing, and UI)

### 🎨 Polished Experience
- Beautiful **light & dark mode** with smooth transitions
- Fully **responsive** — works on desktop, tablet, and mobile
- Subtle **animations**, **toast notifications**, **glassmorphism**, and loading skeletons for a fast, modern feel

---

## 🛠️ Built With

| Area | Technology |
|------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| UI | React 19 + Tailwind CSS v4 |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth with role-based permissions |
| Hosting | Vercel (continuous deployment) |

---

## 🔒 Security at a Glance

Access control is enforced in **four independent layers**, so the public can safely view data
while write access stays locked to authorised staff:

1. **Database** — Row Level Security policies (public read, staff-only write)
2. **Server** — every write action re-checks the user's role on the server
3. **Routing** — protected routes guard against direct URL access
4. **UI** — edit/delete controls only render for users with the right permissions

---

## 🗺️ Project Journey

TMS was built and improved in clear phases:

- **Phase 1 — Core system:** projects, languages, meetings, dashboard & reports
- **Phase 2 — Authentication & roles:** public view, staff editing, admin user management
- **Phase 3 — Search, exports, analytics & UI upgrade:** global search, CSV/PDF export, charts, animations
- **Phase 4 — Weekly meeting schedule:** assigned days, automatic done/overdue reminders, upcoming meetings
- **Latest:** a live, real-time clock (date + time) across the app

---

## 🤝 Credits

Designed and developed by **Ahmed Raza** to support the noble effort of bringing the meaning of
the Holy Quran to people in their own languages.

---

<p align="center"><b>Built with ❤️ for Quranic translation management</b></p>
