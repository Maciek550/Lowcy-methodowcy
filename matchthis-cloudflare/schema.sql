PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS athletes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  club TEXT,
  user_enabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cycles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  season INTEGER,
  rounds_count INTEGER NOT NULL DEFAULT 6,
  finalists_count INTEGER NOT NULL DEFAULT 45,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS competitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cycle_id INTEGER,
  name TEXT NOT NULL,
  event_date TEXT,
  venue TEXT,
  competition_type TEXT NOT NULL CHECK (competition_type IN ('ONE_ROUND','TWO_ROUND','CYCLE_ROUND')),
  round_number INTEGER,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  users_enabled INTEGER NOT NULL DEFAULT 0,
  published_draw INTEGER NOT NULL DEFAULT 0,
  published_results INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (cycle_id) REFERENCES cycles(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS competition_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  competition_id INTEGER NOT NULL,
  athlete_id INTEGER NOT NULL,
  UNIQUE (competition_id, athlete_id),
  FOREIGN KEY (competition_id) REFERENCES competitions(id) ON DELETE CASCADE,
  FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rounds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  competition_id INTEGER NOT NULL,
  round_no INTEGER NOT NULL,
  UNIQUE (competition_id, round_no),
  FOREIGN KEY (competition_id) REFERENCES competitions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sectors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id INTEGER NOT NULL,
  code TEXT NOT NULL,
  shore_order INTEGER NOT NULL,
  athlete_count INTEGER NOT NULL,
  peg_from INTEGER NOT NULL,
  peg_to INTEGER NOT NULL,
  UNIQUE (round_id, code),
  FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS disabled_pegs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id INTEGER NOT NULL,
  peg_no INTEGER NOT NULL,
  UNIQUE (round_id, peg_no),
  FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS draws (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id INTEGER NOT NULL,
  athlete_id INTEGER NOT NULL,
  sector_id INTEGER NOT NULL,
  peg_no INTEGER NOT NULL,
  draw_mode TEXT NOT NULL DEFAULT 'AUTO' CHECK (draw_mode IN ('AUTO','MANUAL')),
  UNIQUE (round_id, athlete_id),
  UNIQUE (round_id, peg_no),
  FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE,
  FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE CASCADE,
  FOREIGN KEY (sector_id) REFERENCES sectors(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS weights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id INTEGER NOT NULL,
  athlete_id INTEGER NOT NULL,
  net_1_g INTEGER NOT NULL DEFAULT 0,
  net_2_g INTEGER NOT NULL DEFAULT 0,
  entered_by TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (round_id, athlete_id),
  FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE,
  FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS judges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  pin_hash TEXT,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS judge_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  judge_id INTEGER NOT NULL,
  round_id INTEGER NOT NULL,
  sector_id INTEGER,
  FOREIGN KEY (judge_id) REFERENCES judges(id) ON DELETE CASCADE,
  FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE,
  FOREIGN KEY (sector_id) REFERENCES sectors(id) ON DELETE SET NULL
);

-- Reguła losowania implementowana w aplikacji:
-- 1) zawody 2-turowe: zawodnik, który w T1 dostał pierwsze LUB ostatnie stanowisko całego brzegu,
--    w T2 nie może dostać żadnego z tych dwóch stanowisk;
-- 2) cykl: po otrzymaniu pierwszego LUB ostatniego stanowiska całego brzegu,
--    oba skrajne stanowiska są zablokowane dla zawodnika do końca cyklu.
