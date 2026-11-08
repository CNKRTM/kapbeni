-- Admin „Şifremi unuttum“ (v1.19): Einmal-Token, nur als SHA-256 gespeichert,
-- 30 Minuten gueltig, einmal nutzbar.
CREATE TABLE IF NOT EXISTS admin_sifre_sifirlama (
  id             serial PRIMARY KEY,
  admin_id       integer NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash     char(64) NOT NULL UNIQUE,
  expires_at     timestamptz NOT NULL,
  kullanildi_at  timestamptz,
  ip             varchar(45),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_sifre_sifirlama_admin ON admin_sifre_sifirlama(admin_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON admin_sifre_sifirlama TO sattigitti;
GRANT USAGE, SELECT ON SEQUENCE admin_sifre_sifirlama_id_seq TO sattigitti;
