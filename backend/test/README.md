# Backend Test README

## Overview

This backend now has route-level tests for [`server.js`](/Users/baremetal/GithubRepos/CPSC491-CapstoneProject/backend/server.js) in addition to the existing unit tests for:

- [`backend/__tests__/compatibilityEngine.test.js`](/Users/baremetal/GithubRepos/CPSC491-CapstoneProject/backend/__tests__/compatibilityEngine.test.js)
- [`backend/test/priceObserver.test.js`](/Users/baremetal/GithubRepos/CPSC491-CapstoneProject/backend/test/priceObserver.test.js)

The new server test file is:

- [`backend/__tests__/server.test.js`](/Users/baremetal/GithubRepos/CPSC491-CapstoneProject/backend/__tests__/server.test.js)

## Why `server.js` Was Refactored

Before these tests were added, `server.js` immediately created a Postgres pool, attached a Postgres-backed session store, and started listening on a real port as soon as the module was imported. That makes route testing difficult because tests need to import the app without:

- opening a real TCP listener too early
- connecting to a real database
- requiring a real session table

To make the file testable, `server.js` now exports:

- `createPool()`
- `createSessionMiddleware()`
- `createApp()`
- `startServer()`

`startServer()` is still the normal runtime entrypoint, but tests can now call `createApp()` with mocked dependencies.

## Test Strategy

The server tests use dependency injection instead of a real database or real `express-session` store.

Injected fakes:

- `pool.query`: mocked so each test controls the database response
- `bcrypt.hash` and `bcrypt.compare`: mocked so auth tests stay deterministic
- `sessionMiddleware`: replaced with a lightweight test middleware that creates `req.session`

This keeps the suite:

- fast
- deterministic
- isolated from environment setup
- focused on route behavior

## What `server.test.js` Covers

### Basic server endpoints

- `GET /` returns plain text `ok`
- `GET /favicon.ico` returns `204`

### Compatibility route

- `POST /api/compatibility` returns `compatible: true` when all parts match
- `POST /api/compatibility` returns `compatible: false` and aggregated issues when parts conflict

### Register route

- rejects missing credentials with `400`
- rejects passwords shorter than 10 characters with `400`
- hashes the password and inserts a lowercase email on success
- returns `409` when Postgres reports a duplicate email (`23505`)

### Login route

- rejects missing credentials with `400`
- rejects unknown users with `401`
- rejects incorrect passwords with `401`
- returns the sanitized user payload on success

### Authenticated user route

- `GET /auth/me` returns `401` when no session user is present
- `GET /auth/me` returns the current user when a session user id exists

### Logout route

- `POST /auth/logout` returns `200` when session destruction succeeds
- `POST /auth/logout` returns `500` when session destruction fails

### Health route

- `GET /health` returns database status on success
- `GET /health` returns `500` when the health query fails

## How the Test Session Middleware Works

The custom test middleware assigns `req.session` for every request.

Supported request headers:

- `x-test-user-id`: simulates an authenticated session for routes like `GET /auth/me`
- `x-test-destroy-error: 1`: forces `req.session.destroy()` to fail for logout error-path testing

This allows auth route behavior to be tested without relying on cookies or a real session backend.

## How to Run the Tests

From the `backend` directory:

```bash
npm test
```

To run only the server route tests:

```bash
node --experimental-vm-modules ./node_modules/jest/bin/jest.js __tests__/server.test.js
```

## Notes and Limitations

- These tests are route-level tests, not full integration tests against a real Postgres instance.
- The suite verifies HTTP behavior, validation, and error handling, but it does not validate session persistence across real requests.
- Existing `priceObserver` tests use `node:test`, while the rest of the backend suite uses Jest. That inconsistency already existed before this change.

## Recommended Next Steps

- Add tests for the routes in [`backend/routes/priceTracking.js`](/Users/baremetal/GithubRepos/CPSC491-CapstoneProject/backend/routes/priceTracking.js)
- Consider standardizing all backend tests on one runner
- If you want end-to-end confidence, add a separate integration suite backed by a disposable test database
