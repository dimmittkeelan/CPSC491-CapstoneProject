# 🖥️ PC Build Generator

> A full-stack web application that generates optimized, compatibility-verified PC builds based on your budget — built by CSUF CPSC 491 Capstone team 3.

[![Deploy Frontend](https://img.shields.io/badge/Frontend-Vercel-black?logo=vercel)](https://pc-build-generator.vercel.app/)
[![Deploy Backend](https://img.shields.io/badge/Backend-Render-46E3B7?logo=render)](https://render.com/)
[![Tests](https://github.com/dimmittkeelan/CPSC491-CapstoneProject/actions/workflows/test.yml/badge.svg)](https://github.com/dimmittkeelan/CPSC491-CapstoneProject/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)

---

## 📖 Table of Contents

- [About the Project](#-about-the-project)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Frontend Setup](#frontend-setup)
  - [Backend Setup](#backend-setup)
  - [Environment Variables](#environment-variables)
- [API Reference](#-api-reference)
- [Architecture](#-architecture)
- [Testing](#-testing)
- [CI/CD](#-cicd)
- [Team](#-team)

---

## 🧠 About the Project

Building a custom PC is overwhelming. Compatibility issues, pricing research, and component selection can take hours — and even then, a wrong choice can mean wasted money.

The **PC Build Generator** solves this by automatically recommending compatible, budget-optimized PC components. It validates part compatibility in real time, tracks prices, and lets users save their configurations for later.

Whether you're a first-time builder or an experienced enthusiast, the PC Build Generator gives you a reliable, centralized tool for your next build.

**Live Demo:** [pc-build-generator.vercel.app](https://pc-build-generator.vercel.app/)

---

## ✨ Features

| Feature | Status |
|---|---|
| 🔐 User Authentication (Register / Login / Logout) | ✅ Live |
| 💰 Budget-based build generation | ✅ Live |
| 🧩 Hardware compatibility checking (CPU, RAM, PSU, Mobo) | ✅ Live |
| 💾 Save & manage builds per user account | ✅ Live |
| 📊 Performance scoring and budget summary | ✅ Live |
| 🔔 Price drop tracking & observer service | ✅ Live |
| 📜 Auth event audit logging | ✅ Live |
| 📱 Responsive design (mobile & desktop) | ✅ Live |
| 🌐 Vendor pricing API integration | 🔜 Planned |
| 📧 Email price-drop notifications | 🔜 Planned |

---

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| [React 19](https://react.dev/) | UI framework |
| [React Router v7](https://reactrouter.com/) | Client-side routing |
| [Vite](https://vitejs.dev/) | Build tool & dev server |
| [Vitest](https://vitest.dev/) | Unit testing |
| [React Testing Library](https://testing-library.com/) | Component testing |

### Backend
| Technology | Purpose |
|---|---|
| [Express 5](https://expressjs.com/) | HTTP server & routing |
| [PostgreSQL](https://www.postgresql.org/) | Relational database |
| [express-session](https://github.com/expressjs/session) | Session management |
| [bcrypt](https://github.com/kelektiv/node.bcrypt.js) | Password hashing |
| [connect-pg-simple](https://github.com/voxpelli/node-connect-pg-simple) | PostgreSQL session store |
| [Jest](https://jestjs.io/) | Backend unit & integration testing |

### DevOps
| Technology | Purpose |
|---|---|
| [Vercel](https://vercel.com/) | Frontend hosting & CD |
| [Render](https://render.com/) | Backend hosting & CD |
| [GitHub Actions](https://docs.github.com/en/actions) | CI pipeline |

---

## 📁 Project Structure

```
CPSC491-CapstoneProject/
├── .github/
│   └── workflows/
│       ├── test.yml                    # CI: run tests on every push/PR
│       └── render_deployment_test.yml  # CD: deploy backend to Render
│
├── frontend/                           # React + Vite application
│   ├── src/
│   │   ├── components/                 # Shared UI components (Navbar, etc.)
│   │   ├── context/
│   │   │   ├── BuildContext.jsx        # Global PC build state (useReducer)
│   │   │   └── BuildContext.test.jsx   # Unit tests for build engine
│   │   ├── pages/                      # Route-level page components
│   │   │   ├── Home.jsx
│   │   │   ├── Build.jsx
│   │   │   ├── SavedBuild.jsx
│   │   │   ├── Login.jsx
│   │   │   └── SignUp.jsx
│   │   ├── services/
│   │   │   ├── authApi.js              # Auth API calls (login, register, me)
│   │   │   ├── buildApi.js             # Build CRUD API calls
│   │   │   └── savedBuilds.js          # Local storage fallback for builds
│   │   └── styles/                     # Component-scoped CSS
│   ├── vite.config.js                  # Vite + Vitest configuration
│   └── package.json
│
├── backend/                            # Express.js API server
│   ├── __tests__/
│   │   ├── server.test.js              # Route-level HTTP integration tests
│   │   ├── compatibilityEngine.test.js # Unit tests for compatibility logic
│   │   └── authContract.test.js        # Auth contract/regression tests
│   ├── routes/
│   │   └── priceTracking.js            # Price observer API routes
│   ├── services/
│   │   └── priceObserver.js            # Observer pattern price tracking logic
│   ├── compatibilityEngine.js          # Core hardware compatibility logic
│   ├── server.js                       # App factory, routes, session config
│   ├── .env.example                    # Environment variable template
│   └── package.json
│
├── tests/                              # Integration test templates & plans
│   ├── README.md
│   └── budget-validation.test.js
│
└── docs/
    └── auth-contract.md                # Auth API contract (team source of truth)
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v20 or higher
- **npm** v8 or higher
- **PostgreSQL** v14 or higher (for backend)

---

### Frontend Setup

```bash
# Clone the repository
git clone https://github.com/dimmittkeelan/CPSC491-CapstoneProject.git
cd CPSC491-CapstoneProject/frontend

# Install dependencies
npm install

# Start the development server (proxies API calls to localhost:3001)
npm run dev
```

The frontend will be available at **http://localhost:5173**.

---

### Backend Setup

```bash
cd CPSC491-CapstoneProject/backend

# Install dependencies
npm install

# Copy the example environment file and fill in your values
cp .env.example .env

# Start the development server with auto-reload
npm run dev
```

The backend API will be available at **http://localhost:3001**.

To initialize the database tables, the server will automatically run `CREATE TABLE IF NOT EXISTS` for `users`, `session`, `auth_logs`, and `saved_builds` on startup.

---

### Environment Variables

Create a `backend/.env` file based on `backend/.env.example`:

```env
# Required
SESSION_SECRET=your_long_random_secret_here
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pc_builder
PORT=3001

# Allowed frontend origin for CORS (no trailing slash)
FRONTEND_ORIGIN=http://localhost:5173

# Optional — session cookie behavior (auto-configured for dev/prod)
SESSION_COOKIE_SAMESITE=
SESSION_COOKIE_SECURE=
TRUST_PROXY=
```

For the frontend, create a `frontend/.env.local` if you need to point at a non-local backend:

```env
# Leave empty to use the Vite dev proxy (recommended for local dev)
VITE_API_BASE_URL=
```

---

## 📡 API Reference

All responses follow a consistent contract: `{ ok: boolean, ...payload }` or `{ ok: false, error: string }`.

### Auth

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/register` | Create a new account |
| `POST` | `/auth/login` | Log in with email & password |
| `POST` | `/auth/logout` | Destroy session |
| `GET` | `/auth/me` | Get the current logged-in user |
| `GET` | `/auth/logs` | Get recent auth events for current user |

### Builds

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/builds` | Save a new build (auth required) |
| `GET` | `/builds/mine` | Get all saved builds (auth required) |
| `DELETE` | `/builds/:buildId` | Delete a saved build (auth required) |

### Compatibility

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/compatibility` | Check hardware compatibility |

**Example `/api/compatibility` request:**
```json
{
  "cpu":         { "socket": "AM5", "tdp": 105 },
  "motherboard": { "socket": "AM5", "ramType": "DDR5", "maxRam": 128 },
  "ram":         { "type": "DDR5", "capacity": 32 },
  "gpu":         { "tdp": 200 },
  "psu":         { "wattage": 700 }
}
```

**Response:**
```json
{ "compatible": true, "issues": [] }
```

### Price Tracking

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/track` | Start tracking a part price |
| `POST` | `/api/observe` | Report a new price observation |
| `POST` | `/api/price-check` | Check if a price dropped |
| `GET` | `/api/observer/status` | Get observer service status |

### Health

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Check server and database connectivity |

---

## 🏗️ Architecture

The application uses a **layered architecture**:

```
┌─────────────────────────────────┐
│       Presentation Layer        │  React + React Router (Vercel)
├─────────────────────────────────┤
│       Application Layer         │  Auth state, routing, API clients
├─────────────────────────────────┤
│      Business Logic Layer       │  Compatibility engine, price observer
├─────────────────────────────────┤
│       Data Access Layer         │  PostgreSQL via pg, session store
└─────────────────────────────────┘
```

The **price tracking system** implements the **Observer Pattern** — users subscribe to part price changes, and the `PriceObserver` service notifies all subscribers when a price drop is detected.

The **backend is designed for testability** via dependency injection. `createApp()` accepts a `pool`, `bcryptLib`, `sessionMiddleware`, and `authLogger` — allowing all route logic to be tested with in-memory fakes, with no database or real session store required.

---

## 🧪 Testing

### Frontend Tests

```bash
cd frontend
npm test
```

Tests are written with **Vitest** + **React Testing Library**. The core test suite covers `BuildContext` — the global state engine for the build configurator.

| Test | Description |
|---|---|
| TC-01 | Initial state is empty |
| TC-02 | `selectPart` and `removePart` work correctly |
| TC-03 | `clearBuild` resets all parts |
| TC-04 | CPU/mobo socket mismatch generates a compatibility issue |
| TC-05 | Underpowered PSU generates a warning |

### Backend Tests

```bash
cd backend
npm test
```

Tests are written with **Jest** + **Supertest**. Three test suites cover the full API surface:

- **`server.test.js`** — HTTP route-level tests with mocked pool, bcrypt, and session middleware. Covers all auth flows, build CRUD, compatibility, and health endpoints.
- **`compatibilityEngine.test.js`** — Pure unit tests for socket, RAM type, PSU wattage, and RAM capacity checks.
- **`authContract.test.js`** — Regression contract tests using an in-memory user pool to validate the auth API contract end-to-end.

---

## ⚙️ CI/CD

### Continuous Integration

Every push and pull request triggers the GitHub Actions workflow at `.github/workflows/test.yml`:

1. Checks out the repository on `ubuntu-latest`
2. Installs Node.js 20 and frontend dependencies
3. Runs `npm test` (Vitest)

**Pull requests cannot be merged if tests fail.**

### Continuous Deployment

| Target | Trigger | Platform |
|---|---|---|
| Frontend | Merge to `main` | Vercel (auto-deploy) |
| Backend | Push to `serverEdit` branch | Render (deploy hook via GitHub Actions) |

Every pull request also generates a **Vercel Preview Deployment**, allowing visual review of UI changes before merge.

---

## 👥 Team

| Name | GitHub | Role |
|---|---|---|
| Keelan Dimmitt | [@dimmittkeelan](https://github.com/dimmittkeelan) | Frontend UI, Responsive Design, DevOps |
| Noah Scott | [@BareMetal-Alchemist](https://github.com/BareMetal-Alchemist) | Backend, Database, Server Infrastructure |
| Ricky Maung | — | Frontend Boilerplate, Build Results Page, CI |
| Eymard Alarcon | [@Remote1234](https://github.com/Remote1234) | Testing Infrastructure, Price Observer Service |
| Yuuji Kobayashi | [@Yuuji-95](https://github.com/Yuuji-95) | Compatibility Engine, Backend API |

---

## 📄 Auth API Contract

The team maintains a formal API contract at [`docs/auth-contract.md`](docs/auth-contract.md) to keep frontend and backend in sync. **Any auth API change must update this document first before implementation.**

---

## 📝 License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---

<p align="center">Built with 💜 at California State University, Fullerton — CPSC 491 Capstone</p>
