# ORCA Development Setup Guide

## 1. Prerequisites

- **Operating System:** Linux (Fedora, Ubuntu, or Debian)
- **Python:** 3.12+ (with virtual environment support)
- **Node.js:** v22.x
- **PostgreSQL:** 15+ (with `psql` client installed)
- **Git**

## 2. Environment Configuration

1. Clone or navigate to the repository:
   ```bash
   cd /home/ckirankumar/orca
   ```

2. Copy the sample environment file:
   ```bash
   cp .env.example .env
   ```

3. Configure credentials in `.env`:
   - Set `DATABASE_URL` (e.g. `postgresql+psycopg://orca:orca@localhost:5432/orca_db`).
   - Add LLM API keys: `GROQ_API_KEY`, `GEMINI_API_KEY`, or `OPENROUTER_API_KEY`.

## 3. Database Setup

Ensure PostgreSQL service is running and create the user and database:

```bash
sudo -u postgres psql -c "CREATE USER orca WITH PASSWORD 'orca';"
sudo -u postgres psql -c "CREATE DATABASE orca_db OWNER orca;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE orca_db TO orca;"
```

Run database migrations via Alembic:
```bash
cd backend
alembic upgrade head
```

Run idempotent data seed/verification script:
```bash
python ../scripts/verify_database.py
```

## 4. Backend Setup

1. Create and activate a Python virtual environment:
   ```bash
   cd backend
   python3 -m venv .venv
   source .venv/bin/activate
   ```

2. Install dependencies:
   ```bash
   pip install -e .
   ```

3. Run backend tests:
   ```bash
   pytest
   ```

4. Start the development server:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

## 5. Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   npm install
   ```

2. Start the Vite dev server:
   ```bash
   npm run dev
   ```

3. Access the application at `http://localhost:5173`.
