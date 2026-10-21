# OrbX — Multi-Tenant SaaS Platform

OrbX is a multi-tenant SaaS application built for garment and tailoring workshops, ateliers, and boutiques. It utilizes a shared-application, shared-database architecture with verified tenant isolation, role-based access control, a Super Admin platform portal, and a deep-green sage design system inspired by `OrbX Sapphire Prototype.html`.

---

## 1. System Architecture

```
                                  sapphire.orbx.in / app.orbx.in
                                                │
                                    ┌───────────▼───────────┐
                                    │      Nginx Proxy      │
                                    │ (SSL & Reverse Proxy) │
                                    └─────┬───────────┬─────┘
                                          │           │
                          /api/v1/* ┌─────▼─────┐   ┌─▼──────────────────┐
                                    │  FastAPI  │   │   React 18 + Vite  │
                                    │  Backend  │   │     Frontend       │
                                    └─────┬─────┘   └────────────────────┘
                                          │
            ┌─────────────────────────────┼─────────────────────────────┐
            │                             │                             │
    ┌───────▼────────┐           ┌────────▼────────┐           ┌────────▼────────┐
    │   PostgreSQL   │           │      Redis      │           │  Celery Worker  │
    │ Shared Database│           │ Cache & Broker  │           │ Background Jobs │
    └────────────────┘           └─────────────────┘           └─────────────────┘
```

---

## 2. Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 18, Vite, TypeScript | Single-page application with type safety |
| **Routing** | React Router v6 | Auth guards, platform portal & workspace shells |
| **Data Fetching** | TanStack Query v5 | Cache invalidation on company context switch |
| **Styling & Motion** | Standardized CSS Tokens | Deep-green (`#203020`), sage (`#DCE9D5`), cubic-bezier transitions |
| **Backend** | FastAPI, Pydantic v2 | High-performance asynchronous REST API |
| **Database** | PostgreSQL 16 + SQLAlchemy 2 Async | Strict tenant isolation via `company_id` constraints |
| **Migrations** | Alembic | Version-controlled schema updates |
| **Cache & Tasks** | Redis 7 + Celery 5 | Tenant-isolated cache keys & async task foundation |
| **Containers** | Docker Compose + Nginx | Reverse proxy, static asset delivery, and SSL |

---

## 3. Core SaaS Features Implemented

### 3.1 Authentication & Multi-Company Switching
- Shared login page at `/login`.
- Single-use token account activation at `/activate`.
- Self-service password recovery flow at `/forgot-password` and `/reset-password`.
- **Post-Login Routing**:
  1. Super Admins are automatically routed to `/platform`.
  2. Users belonging to **1 company** are routed directly to `/workspace`.
  3. Users belonging to **multiple companies** see the `/select-company` selector.
  4. Users with **no active company** receive an explicit access-denied status message.
- **Tenant Switching**:
  - Validates user membership on the backend before switching.
  - Wipes TanStack Query frontend cache (`queryClient.clear()`) to prevent cross-tenant data leakage.

### 3.2 Super Admin Platform Portal (`/platform`)
- Protected by `is_superadmin == True` platform-level authorization.
- Real-time dashboard KPI metrics: total companies, active, suspended, pending activation, registered users, and plan breakdown.
- **Company Registration & Owner Provisioning**:
  - Generates company record with unique slug code (`{code}.orbx.in`).
  - Provisions owner user account and assigns `owner` role.
  - Issues a single-use 48-hour secure activation token.
  - Allows immediate suspension and reactivation of tenants.

### 3.3 Company Workspace Shell (`/workspace`)
- Reusable workspace layout with active company badge and switcher.
- Team & Membership management: invite team members, adjust roles (`owner`, `manager`, `staff`), and remove members.
- Company settings: edit company profile and view tenant metadata.
- **Customer Orders Placeholder**:
  - In strict compliance with scope requirements, the Customer Order menu entry is prepared as an upcoming module placeholder.
  - **No order records, measurements, or fabricated customer transactions exist in the database.**

---

## 4. Tenant Isolation & Security Rules

1. **Derived Context**: Every tenant-scoped endpoint relies on `get_tenant_context` which verifies the user's active membership in PostgreSQL. A browser-supplied header (`X-Company-ID`) is **never** trusted without membership verification.
2. **Platform Role Isolation**: Super Admins cannot access tenant workspace endpoints unless explicitly granted a membership in that company.
3. **Suspension Defense**: Suspended companies are immediately blocked with `403 Forbidden`.
4. **Cache Key Isolation**: Redis keys follow the prefix `tenant:{company_id}:{key}`.

---

## 5. Setup & Development Instructions

### 5.1 Running with Docker Compose (Recommended)

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Build and launch all services:
   ```bash
   docker compose up --build -d
   ```
3. The platform will be available at `http://localhost`.

### 5.2 Local Development (Manual)

#### Backend Setup
```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
- API Documentation: `http://localhost:8000/api/v1/docs`

#### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
- Web Application: `http://localhost:3000`

---

## 6. Database Migrations

Run database migrations via Alembic:
```bash
cd backend
alembic upgrade head
```

---

## 7. Testing

### Run Backend Test Suite
The automated test suite runs against an isolated async database and verifies authentication, platform security, owner provisioning, and cross-tenant isolation:
```bash
cd backend
venv\Scripts\pytest -v tests
```

### Run Frontend Production Build
```bash
cd frontend
npm run build
```

---

## 8. Default Seed Credentials

| Account | Email | Password | Access |
|---|---|---|---|
| **Platform Super Admin** | `admin@orbx.in` | `OrbXAdmin@2026!` | `/platform` |
