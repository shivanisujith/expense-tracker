# Expense Tracker

## Specs come first
- Before changing any code, read every file in `specs/`:
  `goal-spec.md`, `frontend-spec.md`, `backend-spec.md`,
  `api-contract-spec.md`.
- The specs are the source of truth. `goal-spec.md` wins over the others.
- If a request, the existing code, or two specs conflict with each other,
  **stop and report the conflict to the user**. Do not guess or pick one
  yourself.
- Do not edit anything in `specs/` unless the user explicitly asks.
- Stay within the goal spec's scope. Its "Out of Scope" list is binding.

## Layout
- `backend/`: FastAPI app (`app/`) and pytest tests (`tests/`). SQLite
  data file is `backend/expenses.db` (git-ignored).
- `frontend/`: React app built with Vite (plain JavaScript).

## Backend
The virtual environment must be created with miniforge's Python, not the
system Python:

```
~/miniforge3/bin/python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt
```

Run (from `backend/`):

```
.venv/bin/uvicorn app.main:app --reload     # http://localhost:8000, docs at /docs
.venv/bin/pytest                            # run all backend tests
```

## Frontend
Run (from `frontend/`):

```
npm install
npm run dev     # http://localhost:5173
npm test        # run frontend tests
```

## Working style
- Work in the phases of the approved plan. Stop after each phase so the
  user can check it, and commit only after the user approves.
- The user is a beginner: explain technical terms in plain language.
