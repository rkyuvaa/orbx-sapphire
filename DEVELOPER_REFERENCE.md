# OrbX Sapphire — Developer Reference Guide

> **Version:** 1.0.0  
> **Last Updated:** 2026-11-15  
> **Audience:** Backend & Frontend Engineers, DevOps, QA

---

## 1. Project Overview

**OrbX** is a multi-tenant SaaS platform for garment/tailoring workshops, ateliers, and boutiques.

| Attribute | Detail |
|-----------|--------|
| **Architecture** | Shared application, shared database, strict tenant isolation |
| **Tenancy Model** | `company_id` column on every tenant-scoped table + membership verification |
| **Auth** | JWT (HS256), access tokens 24h, refresh via re-login |
| **Roles** | Platform: `superadmin` · Tenant: `owner`, `admin`, `staff` |
| **Domain** | `sapphire.orbx.in` (platform) · `{code}.orbx.in` (tenant workspaces) |

---

## 2. Technology Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Frontend** | React + TypeScript + Vite | 18 / 5.x / 5.x | SPA, type safety, fast HMR |
| **Routing** | React Router | 6.x | Auth guards, portal/workspace shells |
| **Data Fetching** | TanStack Query | 5.x | Caching, invalidation on tenant switch |
| **Styling** | CSS Custom Properties + Tokens | — | Deep-green (`#203020`), sage (`#DCE9D5`) design system |
| **Backend** | FastAPI + Pydantic v2 | 0.110+ / 2.x | Async REST API, validation |
| **Database** | PostgreSQL + SQLAlchemy 2 (Async) | 16 / 2.x | Tenant isolation via `company_id` FK + constraints |
| **Migrations** | Alembic | 1.13+ | Version-controlled schema |
| **Cache/Queue** | Redis 7 + Celery 5 | 7.x / 5.x | Tenant-isolated keys, background jobs |
| **Containers** | Docker Compose + Nginx | — | Reverse proxy, static assets, SSL |

---

## 3. Repository Structure

```
OrbX Sapphire/
├── backend/
│   ├── app/
│   │   ├── api/v1/           # REST endpoints (auth, platform, companies, orders, customers, etc.)
│   │   ├── core/             # Config, security, deps, DB, Redis, audit, doc numbering
│   │   ├── models/           # SQLAlchemy models (user, company, membership, order, customer, measurement)
│   │   ├── schemas/          # Pydantic request/response schemas
│   │   ├── tasks/            # Celery tasks (reminders, notifications)
│   │   ├── main.py           # FastAPI app, lifespan, seeding
│   │   └── seed.py           # Super admin + default plans seed
│   ├── alembic/              # 10 migrations (001–010)
│   ├── tests/                # Pytest suite (auth, platform, isolation, orders)
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── auth/         # Login, activate, forgot/reset password
│   │   │   ├── platform/     # Super Admin dashboard, company management
│   │   │   └── workspace/    # Dashboard, TeamManagement, CompanySettings, CustomerOrders
│   │   ├── components/       # UI primitives (Modal, Table, Badge, Icons, etc.)
│   │   ├── context/          # AuthContext, TenantContext, ToastContext
│   │   ├── lib/              # api.ts (fetch wrapper), utils
│   │   ├── routes/           # Router config, guards
│   │   ├── styles/           # Global CSS, design tokens
│   │   └── utils/            # Helpers (recordRow, formatting)
│   ├── Dockerfile
│   └── vite.config.ts
├── nginx/
│   ├── nginx.conf
│   └── conf.d/               # default.conf, ssl.conf.template
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 4. Core Concepts

### 4.1 Tenant Isolation (`get_tenant_context`)

**File:** `backend/app/core/deps.py:66`

Every tenant-scoped endpoint **must** use this dependency. It:

1. Reads `X-Company-ID` header (sent by frontend via `apiRequest`)
2. Fetches `Company` + verifies status ≠ `suspended`/`pending_activation`
3. Verifies `CompanyMembership` exists for current user with `status=active`
4. Returns `(Company, CompanyMembership)` tuple

> ⚠️ **Never trust `X-Company-ID` alone.** Super Admins also need explicit membership.

```python
# Usage in endpoint
@router.get("/orders")
async def list_orders(
    tenant: tuple[Company, CompanyMembership] = Depends(get_tenant_context)
):
    company, membership = tenant
    # company.id is guaranteed valid & user has access
```

### 4.2 Role Guards

```python
# Owner/Admin only
require_company_roles(["owner", "admin"])

# Any active member
get_tenant_context  # implicitly checks membership.status == "active"
```

### 4.3 Frontend Tenant Context

**File:** `frontend/src/context/TenantContext.tsx`

- `activeCompanyId` — persisted in `localStorage` (`orbx_active_company_id`)
- `activeCompany` — full company detail (name, code, status, etc.)
- `currentMembership` — user's role in active company
- `switchCompany(id)` — clears TanStack Query cache, sets new ID, fetches details
- Auto-syncs when user logs in or memberships change

### 4.4 API Client (`apiRequest`)

**File:** `frontend/src/lib/api.ts`

```typescript
// Automatically attaches:
// - Authorization: Bearer <token>
// - X-Company-ID: <activeCompanyId> (if set)
apiRequest<T>('/orders', { method: 'POST', body: JSON.stringify(payload) })
```

Handles 401 → redirect to `/login`, standardizes error messages.

---

## 5. Database Schema (Key Tables)

### 5.1 Core Tenancy

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `users` | Platform users | `id`, `email`, `hashed_password`, `is_superadmin`, `is_active` |
| `companies` | Tenants | `id`, `name`, `code`, `status` (active/suspended/pending), `owner_id`, `subscription_id` |
| `company_memberships` | User↔Company + role | `user_id`, `company_id`, `role` (owner/admin/staff), `status` |
| `subscriptions` | Company plans | `company_id`, `plan_id`, `status`, `billing_cycle` |
| `subscription_plans` | Plan catalog | `code` (starter/professional/enterprise), `max_users`, `modules_allowed` |

### 5.2 Orders & Customers

| Table | Purpose |
|-------|---------|
| `customers` | Company-scoped customers (unique phone per company) |
| `orders` | Customer orders with status workflow |
| `order_status_history` | Immutable status change log |
| `order_document_numbering` | Per-company `ORD-000001` sequencing |
| `order_reminder_dispatches` | Scheduled notification tracking |

### 5.3 Measurements (Configurable)

| Table | Purpose |
|-------|---------|
| `measurement_tabs` | Tabs per company (e.g., "Blouse", "Pants") |
| `measurement_fields` | Fields per tab (name, type: number/text/textarea, unit, required) |
| `customer_measurements` | Default measurements per customer (template) |
| `order_measurements` | Snapshot per order (historical, immutable) |

> **Unique Constraints:**  
> - `customers`: `(company_id, phone_number)`  
> - `orders`: `(company_id, order_number)`  
> - `customer_measurements`: `(customer_id, field_id)`  
> - `order_measurements`: `(order_id, field_id)`

### 5.4 Platform & Audit

| Table | Purpose |
|-------|---------|
| `audit_logs` | Platform + tenant actions (actor, entity, details) |
| `invitations` | Team invite tokens (company-scoped) |
| `notifications` | User notifications (platform + tenant) |
| `web_push_subscriptions` | Browser push endpoints |

---

## 6. API Reference (v1)

**Base Path:** `/api/v1`

### 6.1 Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/login` | Email/password → access token |
| `POST` | `/auth/activate` | Single-use token → set password |
| `POST` | `/auth/forgot-password` | Request reset email |
| `POST` | `/auth/reset-password` | Token + new password |
| `GET` | `/auth/me` | Current user + memberships |

### 6.2 Platform (Super Admin only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/platform/dashboard` | KPI metrics |
| `GET` | `/platform/companies` | List all companies (paginated, filterable) |
| `POST` | `/platform/companies` | Register company + owner |
| `PATCH` | `/platform/companies/{id}` | Update company (suspend/activate) |
| `DELETE` | `/platform/companies/{id}` | Delete company |
| `GET` | `/platform/companies/{id}` | Company detail |
| `POST` | `/platform/companies/{id}/resend-activation` | Resend owner activation email |

### 6.3 Company Workspace (requires membership)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/companies/current` | Active company detail |
| `GET` | `/companies/current/document-numbering` | Next order number |
| `PATCH` | `/companies/current` | Update profile (owner/admin) |

### 6.4 Team & Memberships

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/memberships` | List members |
| `POST` | `/invitations` | Invite member (owner/admin) |
| `PATCH` | `/memberships/{user_id}` | Change role (owner) |
| `DELETE` | `/memberships/{user_id}` | Remove member (owner) |
| `POST` | `/invitations/{token}/accept` | Accept invite |

### 6.5 Customers

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/orders/customers` | List (search, limit) |
| `POST` | `/orders/customers` | Create |
| `GET` | `/orders/customers/{id}` | Detail |
| `PATCH` | `/orders/customers/{id}` | Update |
| `DELETE` | `/orders/customers/{id}` | Delete (blocks if orders/measurements exist) |
| `GET` | `/orders/customers/{id}/measurements` | Default measurements |
| `PUT` | `/orders/customers/{id}/measurements` | Save default measurements |

### 6.6 Orders

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/orders` | Create (validates measurements vs config) |
| `GET` | `/orders` | List (filter: status, customer, search, due date, overdue) |
| `GET` | `/orders/upcoming` | Non-terminal orders due in 5 days (timezone-aware) |
| `GET` | `/orders/{id}` | Detail + measurements + status history |
| `PATCH` | `/orders/{id}` | Update identifiers, dates, priority, measurements |
| `PUT` | `/orders/{id}/measurements` | Replace order measurements (snapshot) |
| `PATCH` | `/orders/{id}/status` | Advance status (sequential) or cancel (reason required) |
| `DELETE` | `/orders/{id}` | Delete order + history + measurements |

### 6.7 Measurement Configuration (owner/admin)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/orders/measurement-config` | All tabs + fields |
| `POST` | `/orders/measurement-config/tabs` | Create tab |
| `GET` | `/orders/measurement-config/tabs` | List tabs |
| `PUT` | `/orders/measurement-config/tabs/order` | Reorder tabs |
| `PUT` | `/orders/measurement-config/tabs/{id}/fields/order` | Reorder fields |
| `GET` | `/orders/measurement-config/tabs/{id}` | Tab detail |
| `PATCH` | `/orders/measurement-config/tabs/{id}` | Update tab (name, enabled, order) |
| `DELETE` | `/orders/measurement-config/tabs/{id}` | Delete tab + fields |
| `POST` | `/orders/measurement-config/tabs/{id}/fields` | Create field |
| `PATCH` | `/orders/measurement-config/fields/{id}` | Update field (type, unit, required, enabled) |

### 6.8 Notifications

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/notifications` | List (unread count, paginated) |
| `PATCH` | `/notifications/{id}/read` | Mark read |
| `PATCH` | `/notifications/read-all` | Mark all read |
| `POST` | `/notifications/push/subscribe` | Register push subscription |
| `DELETE` | `/notifications/push/unsubscribe` | Unregister |

---

## 7. Frontend Page Map

### 7.1 Public Routes (no auth)

| Path | Component | Purpose |
|------|-----------|---------|
| `/login` | `LoginPage` | Email/password, remember me |
| `/activate` | `ActivatePage` | Single-use token → password setup |
| `/forgot-password` | `ForgotPasswordPage` | Request reset link |
| `/reset-password` | `ResetPasswordPage` | Token + new password |

### 7.2 Platform Portal (superadmin)

| Path | Component | Purpose |
|------|-----------|---------|
| `/platform` | `PlatformDashboard` | KPI cards, quick actions |
| `/platform/companies` | `CompanyManagement` | Table: create, suspend, activate, delete, view |
| `/platform/companies/:id` | `CompanyDetail` | Full detail, membership, subscription |

### 7.3 Workspace (tenant member)

| Path | Component | Purpose |
|------|-----------|---------|
| `/workspace` | `WorkspaceDashboard` | Quick stats, recent orders, upcoming due |
| `/workspace/team` | `TeamManagement` | Invite, role change, remove |
| `/workspace/settings` | `CompanySettings` | Profile edit, subscription view |
| `/workspace/orders?section=orders` | `CustomerOrdersPage` | Orders table, create, status workflow |
| `/workspace/orders?section=customers` | `CustomerOrdersPage` | Customer CRUD, search |
| `/workspace/orders?section=measurements` | `CustomerOrdersPage` | Tab/field builder (drag-drop reorder) |

> All workspace routes share `WorkspaceLayout` with company badge + switcher.

---

## 8. Key Business Logic

### 8.1 Order Status Workflow

```
ORDER_RECEIVED → MATERIAL_MARKING → DESIGN_WORK → CUTTING → STITCHING
    → FINISHING → TRIAL → READY_FOR_DELIVERY → DELIVERED
                              ↘ CANCELLED (reason required, from any state)
```

- **Sequential only** — cannot skip steps
- **Cancellation** allowed from any non-terminal state, requires reason
- History recorded in `order_status_history` with actor + timestamp

### 8.2 Document Numbering

- Per-company sequence: `ORD-000001`, `ORD-000002`…
- Stored in `order_document_numbering` (row-locked via `SELECT … FOR UPDATE`)
- Prefix configurable (default `ORD-`)

### 8.3 Measurement Validation

On order create/update:
1. Load company's **enabled** tabs + fields
2. Verify every submitted `field_id` exists in config + belongs to correct `tab_id`
3. Check required fields have non-empty values
4. Save to both `order_measurements` (snapshot) + `customer_measurements` (template)

### 8.4 Upcoming Orders (Timezone-Aware)

```
GET /orders/upcoming?timezone=Asia/Kolkata
```
- Converts "next 5 calendar days in user's local time" → UTC range
- Returns non-terminal orders with `due_date` in that window

---

## 9. Development Workflows

### 9.1 Local Development (Manual)

```bash
# Backend
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate
pip install -r requirements.txt
cp ../.env.example ../.env   # edit if needed
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
# → http://localhost:3000 (proxies /api to :8000 via Vite)
```

### 9.2 Docker Compose (Production-like)

```bash
cp .env.example .env
docker compose up --build -d
# → http://localhost:8050 (ORBX_PORT)
```

### 9.3 Database Migrations

```bash
cd backend
# Create new migration
alembic revision --autogenerate -m "description"

# Apply
alembic upgrade head

# Rollback
alembic downgrade -1
```

### 9.4 Running Tests

```bash
cd backend
# All tests
pytest -v tests

# Specific module
pytest -v tests/test_auth.py
pytest -v tests/test_platform.py
pytest -v tests/test_isolation.py
```

### 9.5 Frontend Production Build

```bash
cd frontend
npm run build
# Output: dist/
```

---

## 10. Configuration Reference

### 10.1 Backend `.env` (all required)

| Variable | Example | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql+asyncpg://postgres:pwd@localhost:5432/orbx` | Async SQLAlchemy URL |
| `REDIS_URL` | `redis://localhost:6379/0` | Cache/client |
| `CELERY_BROKER_URL` | `redis://localhost:6379/1` | Task queue |
| `CELERY_RESULT_BACKEND` | `redis://localhost:6379/2` | Task results |
| `SECRET_KEY` | `32+ char random string` | JWT signing (CHANGE IN PROD) |
| `ALGORITHM` | `HS256` | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` | Token TTL (24h) |
| `FIRST_SUPERADMIN_EMAIL` | `admin@orbx.in` | Seed superadmin |
| `FIRST_SUPERADMIN_PASSWORD` | `StrongPass!2026` | Seed password (CHANGE IN PROD) |
| `FIRST_SUPERADMIN_NAME` | `Platform Super Admin` | Seed name |
| `DOMAIN` | `nexus.orbx.in` | Base domain for subdomains |
| `ORBX_PORT` | `8050` | Nginx external port |
| `WEB_PUSH_VAPID_PRIVATE_KEY` | *(optional)* | Push notifications |
| `WEB_PUSH_VAPID_SUBJECT` | `mailto:admin@orbx.in` | VAPID contact |

### 10.2 Frontend `.env`

| Variable | Description |
|----------|-------------|
| `VITE_VAPID_PUBLIC_KEY` | Web Push public key (matches backend private) |

---

## 11. Design System Tokens (CSS)

**File:** `frontend/src/styles/globals.css` (or `index.css`)

```css
:root {
  /* Primary — Deep Green */
  --pri: #203020;
  --pri-hover: #182418;
  --pri-light: #e8efe8;

  /* Accent — Sage */
  --acc: #DCE9D5;
  --acc-strong: #b8d4b0;

  /* Neutrals */
  --bg: #fafbfa;
  --card: #ffffff;
  --bd: #e1e8e1;
  --text: #1a1f1a;
  --t2: #6b7a6b;      /* secondary text */
  --mut: #c8d4c8;     /* muted/dividers */

  /* Semantic */
  --color-success: #1e7d32;
  --color-warning: #f57f17;
  --color-error: #c62828;
  --color-info: #0277bd;

  /* Motion */
  --ease: cubic-bezier(0.2, 0.8, 0.2, 1);
  --fast: 120ms;
  --base: 200ms;
  --slow: 320ms;

  /* Layout */
  --radius-sm: 6px;
  --radius: 10px;
  --radius-lg: 14px;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.04);
  --shadow: 0 4px 12px rgba(0,0,0,0.06);
  --shadow-lg: 0 12px 28px rgba(0,0,0,0.08);
}
```

**Usage:** `color: var(--pri); transition: all var(--base) var(--ease);`

---

## 12. Common Patterns & Gotchas

### 12.1 Adding a New Tenant-Scoped Endpoint

1. **Backend:** Add to `router.py`, use `get_tenant_context` dependency
2. **Schema:** Define request/response in `schemas/`
3. **Model:** Add table with `company_id` FK + index
4. **Migration:** `alembic revision --autogenerate`
5. **Frontend:** Add API call in page/component using `apiRequest`

### 12.2 Tenant Switch Cache Invalidation

```tsx
// In TenantContext.switchCompany()
queryClient.clear();  // wipes ALL cached queries
```

> Do **not** rely on `queryClient.invalidateQueries()` — cross-tenant leakage risk.

### 12.3 Super Admin Accessing Workspace

Super Admin **must** have a `CompanyMembership` in the target company. Platform endpoints (`/platform/*`) use `get_current_superadmin` only.

### 12.4 Measurement Field IDs are Stable

- `MeasurementField.id` (UUID) never changes
- Snapshots (`order_measurements`, `customer_measurements`) store `field_id` + denormalized `field_name`, `tab_name`, `unit`, `type`
- If field deleted → `field_id` set NULL, denormalized data preserved

### 12.5 Order Date vs Created At

- `order_date` — business date (user-editable, defaults to today)
- `created_at` — immutable audit timestamp (DB default)

---

## 13. Extending the Platform

### 13.1 New Module (e.g., Inventory)

1. **Models:** `inventory_items`, `stock_movements` with `company_id`
2. **API:** `/api/v1/inventory` router with `get_tenant_context`
3. **Schema:** Pydantic models for CRUD
4. **Migration:** Alembic
5. **Frontend:** New page under `workspace/`, add to `WorkspaceLayout` nav
6. **Subscription:** Add `inventory` to `modules_allowed` in `SubscriptionPlan`

### 13.2 New Notification Channel

1. Add Celery task in `app/tasks/`
2. Register in `app/tasks/celery_app.py` beat schedule
3. Create notification record via `core/audit.py` or direct insert
4. Frontend: `NotificationBell` component polls `/notifications`

---

## 14. Deployment Checklist

- [ ] `.env` secrets rotated (SECRET_KEY, SUPERADMIN_PASSWORD, DB_PASSWORD)
- [ ] `DOMAIN` + `ORBX_PORT` set correctly
- [ ] SSL certificates (Let's Encrypt via Certbot or manual)
- [ ] `nginx/conf.d/ssl.conf` configured for domain
- [ ] PostgreSQL backups scheduled (pg_dump / PITR)
- [ ] Redis persistence (AOF enabled in docker-compose)
- [ ] Celery workers + beat running (separate containers)
- [ ] Health checks: `/health` returns `database: connected`, `redis: connected`
- [ ] Log aggregation (stdout → Loki/Datadog/CloudWatch)
- [ ] Sentry/Error tracking DSN configured
- [ ] VAPID keys generated for push (`npx web-push generate-vapid-keys`)

---

## 15. Useful Commands Quick Reference

```bash
# Backend shell
docker compose exec backend bash
# or local
cd backend && source venv/bin/activate

# Run migration
alembic upgrade head

# Create migration
alembic revision --autogenerate -m "add inventory tables"

# Seed only
python -c "import asyncio; from app.main import init_db_and_seed; asyncio.run(init_db_and_seed())"

# Frontend build
cd frontend && npm run build

# Lint
cd frontend && npm run lint

# Test backend
cd backend && pytest -v

# View logs
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f nginx
```

---

## 16. Support & Links

| Resource | Link |
|----------|------|
| API Docs (Swagger) | `http://<host>/api/v1/docs` |
| API Docs (ReDoc) | `http://<host>/api/v1/redoc` |
| Health Check | `http://<host>/health` |
| Prototype Design | `OrbX Sapphire Prototype.html` (root) |

---

> **Maintainers:** Keep this document updated with schema changes, new endpoints, and workflow modifications.  
> **Last sync:** Check `git log -1 --format="%ci" -- DEVELOPER_REFERENCE.md`