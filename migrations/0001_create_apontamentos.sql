CREATE TABLE IF NOT EXISTS apontamentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dispositivo TEXT NOT NULL DEFAULT '',
  pessoa TEXT NOT NULL,
  funcao TEXT NOT NULL DEFAULT '',
  data TEXT NOT NULL,
  dia TEXT NOT NULL CHECK (json_valid(dia)),
  atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (dispositivo, data)
);
