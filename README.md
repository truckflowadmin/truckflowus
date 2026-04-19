# TruckFlow

Dump-truck ticketing, dispatch, and invoicing. Self-hosted, single-tenant-per-install.

## Stack

- **Next.js 14** (App Router) + TypeScript
- **PostgreSQL** via Prisma
- **Tailwind CSS** (industrial theme)
- **Textbelt** for SMS
- **PDFKit** for invoice PDFs
- Cookie-based JWT auth (bcrypt + jsonwebtoken)

## Features

- Dispatcher/admin login (JWT in httpOnly cookie)
- Dashboard with live operational stats
- Ticket CRUD: create, edit, assign to driver, track status (pending → dispatched → in progress → completed), cancel, mark issue
- **Bulk ticket creation** — create up to 50 identical tickets at once for multi-trip jobs
- SMS notifications on assignment via Textbelt (with deep-link to driver's mobile view)
- Inbound SMS webhook parses `DONE` / `ISSUE` replies and auto-updates tickets
- Driver mobile view at `/d/{token}` — phone-optimized, no password, tap-to-start / tap-to-done / report-issue, completed job history
- Drivers & customers management with full edit pages
- Invoices generated from completed tickets over a date range, PDF export, status tracking (draft/sent/paid/overdue)
- **Email invoices** to customers with PDF attachment via SMTP (auto-advances draft → sent)
- **Reports & analytics** — daily activity charts (tickets/loads/revenue), status breakdown, revenue by customer, driver leaderboard, configurable time range
- **CSV export** of tickets with date/status filters
- SMS log with pagination, company settings, user management (admin can add/remove dispatchers)
- Password change for all users
- Responsive design — mobile hamburger sidebar on dispatcher UI
- Loading skeletons, error boundaries, 404 page
- Health check endpoint at `/api/health` for monitoring
- Docker + docker-compose with healthchecks

## Setup

### Prerequisites
- Node.js 20+
- PostgreSQL 14+
- Public URL (or tunneled URL like ngrok) if you want Textbelt inbound replies to work

### 1. Install

```bash
npm install
```

### 2. Configure

```bash
cp .env.example .env
# Edit .env:
#   DATABASE_URL — your Postgres connection string
#   JWT_SECRET   — openssl rand -base64 32
#   APP_URL      — the public URL of this app (used in SMS links)
#   TEXTBELT_KEY — your Textbelt paid key (or "textbelt_test" for dev)
```

### 3. Create schema + seed

```bash
createdb truckflow
npx prisma migrate dev --name init
npm run db:seed
```

Seed creates:
- Company: **Acme Hauling Co.**
- Admin: `admin@acmehauling.example` / `admin123`
- 2 drivers, 2 customers, 3 sample tickets

### 4. Run

```bash
npm run dev        # development on :3000
# or
npm run build && npm start   # production
```

Open <http://localhost:3000>, log in, and you should see the dashboard.

## SMS configuration

### Outbound
Textbelt outbound needs only `TEXTBELT_KEY` set. Use `textbelt_test` in development — messages won't be delivered but the flow works and everything is logged. Get a paid key at <https://textbelt.com/> for production.

### Inbound (driver replies)
Textbelt will POST replies to whatever `replyWebhookUrl` is sent with each outbound message. TruckFlow sets this to `${APP_URL}/api/sms/webhook` automatically.

For this to work, `APP_URL` must be a URL Textbelt can reach from the internet. In development, tunnel with something like ngrok:

```bash
ngrok http 3000
# Set APP_URL=https://<random>.ngrok.io in .env and restart
```

Reply parsing:
- `DONE` (any case, optional trailing text) → marks the driver's active ticket `COMPLETED`
- `ISSUE <message>` → marks `ISSUE` and appends the message as a driver note
- Anything else → logged as a driver note, no status change

## Driver mobile links

Every driver has a rotating access token. The phone-friendly URL is:

```
${APP_URL}/d/{accessToken}
```

This URL is included automatically in every assignment SMS. If a phone is lost, rotate the token from `/drivers`.

## Email configuration (invoice delivery)

To email invoices to customers, set SMTP credentials in `.env`:

```
SMTP_HOST=smtp.gmail.com      # or your provider
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=dispatch@yourcompany.com
```

If `SMTP_HOST` is blank, the email action still works but messages are logged to console instead of sent (good for dev). When you click "Send Invoice Email" on an invoice detail page, it generates the PDF, attaches it, and emails it to the customer. Draft invoices auto-advance to SENT status.

## Deploying on-prem

### Bare metal / VM

```bash
npm ci
npm run build
NODE_ENV=production PORT=3000 npm start
```

Run behind nginx with HTTPS. Run `npx prisma migrate deploy` on each release.

### systemd unit (example)

```ini
[Unit]
Description=TruckFlow
After=network.target postgresql.service

[Service]
Type=simple
User=truckflow
WorkingDirectory=/opt/truckflow
EnvironmentFile=/opt/truckflow/.env
ExecStart=/usr/bin/node node_modules/.bin/next start -p 3000
Restart=always

[Install]
WantedBy=multi-user.target
```

## Project layout

```
prisma/
  schema.prisma         # data models
  seed.ts               # seed script
src/
  app/
    (protected)/        # dispatcher/admin UI (requires login)
      dashboard/        # stats overview
      tickets/          # list, new, bulk, [id], [id]/edit, actions.ts
      drivers/          # list, [id]/edit
      customers/        # list, [id]/edit
      invoices/         # list, [id], [id]/pdf, actions.ts (email)
      reports/          # analytics charts + data
      sms/              # SMS log with pagination
      settings/         # company info, password, user management
    api/
      export/tickets/   # CSV export
      health/           # healthcheck endpoint
      logout/
      sms/webhook/      # inbound Textbelt replies
    d/[token]/          # driver mobile view (token auth)
    login/              # dispatcher login
  components/
    Pagination.tsx      # reusable pagination
    Sidebar.tsx         # responsive sidebar with mobile drawer
    StatusBadge.tsx     # ticket status badges
  lib/
    auth.ts             # JWT session + bcrypt
    email.ts            # nodemailer SMTP client
    pdf.ts              # shared pdfkit invoice generator
    prisma.ts           # Prisma client singleton
    sms.ts              # Textbelt client + message composer
  middleware.ts         # auth gate for /dashboard, /tickets, etc.
```

## Scripts

- `npm run dev` — development server
- `npm run build` — production build (runs `prisma generate` first)
- `npm run start` — production server
- `npm run db:push` — push schema without migration
- `npm run db:migrate` — create and apply a new migration
- `npm run db:seed` — run seed script
- `npm run db:studio` — open Prisma Studio

## Security notes

- Change `JWT_SECRET` to a cryptographically random value in production.
- Driver access tokens are long random strings in the URL — they grant access to that driver's jobs. Rotate if compromised.
- Dispatcher sessions last 30 days. Adjust `expiresIn` in `src/lib/auth.ts`.
- Inbound SMS webhook is unauthenticated by design (Textbelt doesn't sign requests). Consider IP-restricting it at your reverse proxy if that's a concern.
