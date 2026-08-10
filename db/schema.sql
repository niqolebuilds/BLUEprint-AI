-- Blueprint Postgres schema (Neon). Idempotent — safe to run repeatedly.
-- Mirrors apps-script/Code.gs's Users / Processes / AuditLog sheets.

CREATE TABLE IF NOT EXISTS users (
  username      text PRIMARY KEY,
  name          text NOT NULL,
  email         text NOT NULL,
  level         text NOT NULL CHECK (level IN ('L1', 'L2', 'L3', 'L4', 'Admin')),
  sub_function  text NOT NULL DEFAULT 'All',
  password_hash text NOT NULL,
  salt          text NOT NULL,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_login    timestamptz
);

CREATE TABLE IF NOT EXISTS processes (
  id                        uuid PRIMARY KEY,
  title                     text NOT NULL,
  description               text NOT NULL DEFAULT '',
  sub_function              text NOT NULL,
  owner_username            text NOT NULL REFERENCES users(username),
  owner_name                text NOT NULL,
  owner_email               text NOT NULL DEFAULT '',
  owner_level               text NOT NULL,
  status                    text NOT NULL DEFAULT 'Draft',
  last_updated              timestamptz NOT NULL DEFAULT now(),
  completeness_score        int NOT NULL DEFAULT 0,
  effort_rating             int NOT NULL DEFAULT 1,
  repetitiveness_rating     int NOT NULL DEFAULT 1,
  volume_rating             int NOT NULL DEFAULT 1,
  error_sensitivity_rating  int NOT NULL DEFAULT 1,
  automation_suitability    int NOT NULL DEFAULT 0,
  category                  text NOT NULL DEFAULT '',
  is_candidate_for_ai       boolean NOT NULL DEFAULT false,
  problem_statement         text NOT NULL DEFAULT '',
  ai_opportunity            text NOT NULL DEFAULT '',
  steps_agentic_count       int NOT NULL DEFAULT 0,
  steps_automation_count    int NOT NULL DEFAULT 0,
  steps_human_count         int NOT NULL DEFAULT 0,
  gaps                      text NOT NULL DEFAULT '',
  is_shared                 boolean NOT NULL DEFAULT false,
  created_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS processes_owner_idx ON processes(owner_username);
CREATE INDEX IF NOT EXISTS processes_sub_function_idx ON processes(sub_function);

CREATE TABLE IF NOT EXISTS audit_log (
  id         bigserial PRIMARY KEY,
  username   text NOT NULL,
  action     text NOT NULL,
  detail     text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Consolidated PRD & Engine Hub. Rows are soft-deleted (deleted_at) rather
-- than removed so "Erase" is auditable and reversible at the DB level.
CREATE TABLE IF NOT EXISTS prd_engines (
  id                     uuid PRIMARY KEY,
  title                  text NOT NULL,
  icon_key               text NOT NULL DEFAULT 'Sparkles',
  description            text NOT NULL DEFAULT '',
  target_audience        text NOT NULL DEFAULT '',
  master_users           text NOT NULL DEFAULT '',
  ecosystem_apps         text NOT NULL DEFAULT '',
  overlapping_processes  jsonb NOT NULL DEFAULT '[]',
  capex_logic            text NOT NULL DEFAULT '',
  opex_logic             text NOT NULL DEFAULT '',
  metrics                jsonb NOT NULL DEFAULT '{}',
  specifications         jsonb NOT NULL DEFAULT '[]',
  is_seed                boolean NOT NULL DEFAULT false,
  created_by             text NOT NULL DEFAULT '',
  deleted_at             timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS prd_engines_active_idx ON prd_engines(deleted_at);
