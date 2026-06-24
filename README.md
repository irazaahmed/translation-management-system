# 📖 Translation Management System (TMS)

A modern web application that helps a translation team plan, track, and report progress across two workspaces: **Quranic Translation** (languages, meetings & a weekly schedule) and **English Translation** (an 8‑stage production pipeline for books, weekly speeches, booklets & magazine articles) — all from one clean, real‑time dashboard.

🌐 **Live App:** https://tms-dawateislami.vercel.app

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?logo=tailwind-css)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)
![Deployed on Vercel](https://img.shields.io/badge/Deployed-Vercel-black?logo=vercel)

---

## 🎯 What is this project?

A large translation department runs two very different kinds of work at the same time:

1. **Translating the Holy Quran** into dozens of languages — each language has a responsible
   person and a **weekly meeting** where progress is reviewed.
2. **Producing English translations** of books, weekly speeches, booklets and magazine
   articles — each one moves through a fixed **production pipeline**, passing from person to
   person until it is finished and emailed out.

Keeping all of that organised on paper or scattered spreadsheets quickly becomes unmanageable.
**TMS turns both processes into one living, real‑time system** — so anyone can see, at a glance,
who is doing what, what is due, what is stuck, and what is finished.

The app has **two workspaces**, and you can switch between them from the sidebar:

| Workspace | What it manages |
|-----------|-----------------|
| 🕌 **Quranic Translation** | Languages, weekly meetings, schedule & reports |
| 🅴 **English Translation** | The 8‑stage production pipeline for every work item |

---

## 🕌 Quranic Translation — features

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

---

## 🅴 English Translation — features

This module tracks every piece of work (a “**work item**”) as it travels through a fixed
production line. The current holder and step are **calculated automatically** from the dates
entered — they are never typed in by hand, so the status is always honest.

### 🔁 The 8‑stage pipeline

Each work item flows through these stages, in order:

| # | Code | Stage |
|---|------|-------|
| 1 | TR | Translation |
| 2 | IF | Initial Formation |
| 3 | CM | Comparison |
| 4 | ED | Editing |
| 5 | NR | Native Review |
| 6 | ST | S. Tafteesh |
| 7 | FF | Final Formatting |
| 8 | FPR | Final Proofreading |

For every stage you record **who** has it, the date it was **sent** to them, and the date it
came **back**. From those dates the app works out the **current step**, **who is holding it now**,
and **how many days** it has been sitting there.

- A stage can be marked **N/A** (not needed for this item) or **Merged** (its parts were merged
  into a combined file), and those stages are skipped in the progress count.
- **Returns** — if a missing part is noticed later, you can log a quick “sent back to fix it”
  entry (what was missing, who got it, when it went and came back).

### ✅ How an item is marked “Completed”

An item is only **Completed** when its **Final email** has been sent — not just because the
last step was filled in. This prevents items from looking finished before they really are.

- If every step is done but the final email hasn't gone out yet, the item shows
  **“Awaiting final email.”**
- **Merged items** are the exception: when a work item is folded into a combined file (its tail
  ends on a *Merged* stage), it counts as **Completed without its own final email**, because the
  email is sent on the combined file instead.

### 🗣️ Weekly Speech Brothers — the “Islamic Sisters” phase

A **Weekly Speech Brothers (wsb)** item has two extra steps after the normal pipeline, plus a
**second** final email:

1. Pipeline finishes → **1st email: “F. Email Sent for Islamic Brothers”**
2. Two extra steps — **Prepared for Islamic Sister** → **Final Formation**
3. **2nd email: “F. Email sent for Islamic Sisters”** → now the item is **Completed**

### 🗃️ Organised by category

Work items are grouped into clear sections, each with its own page:

- **📅 Weekly Docs** — recurring weekly deliverables (Weekly Speech Brothers, Friday Speech,
  Weekly Booklet). Shows delivery countdowns, **overdue / due‑this‑week / upcoming**, items
  **held too long** at one step, items with **no confirmed date**, and unassigned tasks.
- **📚 Books** — the in‑process books, in the team's own order, each with an editable
  **comment / note** (e.g. “give this book to ___ only after ___”). Completed books are hidden.
- **📰 Magazine** — magazine articles moving through the pipeline.
- **🗂️ Other Works** — everything else (departmental work, reprints, etc.).

### 📈 Reports & downloads

A dedicated **Reports** page lets you filter and download:

- **Per‑person activity** — pick a person and a date range to see exactly what work they did
  (which items and stages, with dates).
- **Full items export** — every item with its status, current step, holder, dates and progress.
- Download as **Excel** or **PDF** (filtered exactly the way you see it on screen).

### 👥 Workforce

A single **Workforce** list is the one source of truth for everyone's name. Add, edit, or
remove team members, and record their skills, email and working hours. Renaming a person here
**flows through the whole site automatically** (all their past and current work updates to the
new name).

### 🧭 English dashboard

The English dashboard surfaces what needs attention first:

1. **Weekly deliveries** — due within 7 days, or held more than 4 days at a step
2. **Unassigned tasks** — grouped by category, so it's clear what is stalled
3. **Longest at current step** — the items that have sat the longest

> 💡 Opening an item from any list and pressing **“Save & Back”** returns you to exactly where
> you came from — the same Weekly Docs, Books, Magazine page, or your **filtered/searched**
> items list (your filters, search, tab and sort are kept).

---

## 🌟 Shared across the whole app

### 📊 Live Dashboard
- At-a-glance stats with **animated counters** and **donut / priority charts**
- A personalised greeting banner with a **live ticking clock (date + time)**

### 🔎 Global Search
- Search across languages, countries, people, work items, and meeting notes from anywhere

### 🔐 Roles & Access Control
- **Public view-only mode** — anyone can open the app and view progress (“Continue without login”)
- **Editors & Admins** can add, edit, and delete data
- **Admins** can create users and assign roles (Admin / Editor / Viewer)
- Security enforced at multiple layers (database, server, routing, and UI)

### 🎨 Polished Experience
- Beautiful **light & dark mode** with smooth transitions
- Fully **responsive** — works on desktop, tablet, and mobile
- Subtle **animations**, **toast notifications**, **glassmorphism**, and loading skeletons

---

## 🛠️ Built With

| Area | Technology |
|------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| UI | React 19 + Tailwind CSS v4 |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth with role-based permissions |
| Exports | SheetJS (Excel) · jsPDF (PDF) |
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
- **Phase 5 — English Translation module:** the 8‑stage pipeline, computed current step/holder,
  weekly documents, magazine & “other works”
- **Phase 6 — Pipeline maturity:** workforce as the single source of holder names (with
  cascade rename), final‑email completion gating, the Weekly Speech Brothers “Islamic Sisters”
  phase, and merge‑complete handling
- **Phase 7 — Books, Reports & polish:** a dedicated Books section with per‑book comments, a
  Reports page with per‑person activity and full exports (Excel/PDF), smarter “Save & Back”
  navigation, and a fully mobile‑responsive layout

---

## 🤝 Credits

Designed and developed by **Ahmed Raza** to support the noble effort of bringing the meaning of
the Holy Quran — and the wider body of Islamic works — to people in their own languages.

---

<p align="center"><b>Built with ❤️ for translation management</b></p>
