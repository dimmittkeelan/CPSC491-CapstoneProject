# Sprint 4 Local Demo Recovery Setup

## Overview

The original hosted backend/database for the PC Build Generator project is no longer active. This setup allows the project to run fully locally for Sprint 4 testing and demo purposes.

Current local setup:
- Frontend: localhost:5173
- Backend: localhost:3001
- Database: PostgreSQL local instance

---

## 1. Install PostgreSQL

MacOS (Homebrew):

```bash
brew install postgresql@16
brew services start postgresql@16
