ALTER TABLE apontamentos ADD COLUMN periodos_ociosos TEXT NOT NULL DEFAULT '[]'
  CHECK (json_valid(periodos_ociosos) AND json_type(periodos_ociosos) = 'array');
