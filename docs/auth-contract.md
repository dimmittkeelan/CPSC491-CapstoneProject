# Auth Contract (Team Safe Version)

Purpose: define a shared agreement for auth API behavior so frontend and backend can work in parallel without breaking each other.

Status: current behavior, non-breaking baseline.

## Non-Breaking Rules

1. Do not rename auth routes.
2. Do not remove existing top-level response fields: ok, user, error.
3. New fields are allowed only if optional.
4. Keep current status code behavior unless team agrees first.

## Endpoints

### POST /auth/register

Request body:
- email (string, required)
- password (string, required, minimum length 10)

Success:
- Status: 200
- Body:
  - ok: true
  - user:
    - id (number)
    - email (string)

Errors:
- 400: { ok: false, error: "email/password required" }
- 400: { ok: false, error: "Password needs to be at least length of 10." }
- 409: { ok: false, error: "Email already exists" }
- 500: { ok: false, error: "Server error" }

Session behavior:
- On success, server sets session userId.

### POST /auth/login

Request body:
- email (string, required)
- password (string, required)

Success:
- Status: 200
- Body:
  - ok: true
  - user:
    - id (number)
    - email (string)

Errors:
- 400: { ok: false, error: "email/password required" }
- 401: { ok: false, error: "Invalid credentials" }
- 500: { ok: false, error: "Server error" }

Session behavior:
- On success, server sets session userId.

### GET /auth/me

Auth required:
- Yes (session cookie)

Success:
- Status: 200
- Body:
  - ok: true
  - user:
    - id (number)
    - email (string)

Errors:
- 401: { ok: false, error: "Not Logged in" }
- 500: { ok: false, error: "Server error" }

### POST /auth/logout

Auth required:
- Session should exist

Success:
- Status: 200
- Body:
  - ok: true

Errors:
- 500: { ok: false, error: "Logout failed" }

Session behavior:
- On success, session is destroyed and connect.sid cookie is cleared.

## Team Workflow

1. Any auth API change starts by updating this file first.
2. Team reviews and approves contract change.
3. Implementation PR references contract changes.
4. Frontend uses this file as source of truth.

## Future Additions (Optional)

- Add stable error codes while keeping error text for compatibility.
- Add request validation details (email format, max lengths).
- Add account endpoints (change password, update email).
