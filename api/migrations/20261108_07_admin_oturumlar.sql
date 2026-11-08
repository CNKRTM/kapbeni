-- Admin-Sitzungen (v1.17): Token traegt die Sitzungs-ID (sid). Abmelden und die
-- Bildschirmsperre (v1.18) wirken serverseitig. kilit_hata zaehlt Fehlversuche
-- beim Entsperren; nach 5 wird die Sitzung geschlossen.
CREATE TABLE IF NOT EXISTS admin_oturumlar (
  id            uuid PRIMARY KEY,
  admin_id      integer NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  ip            varchar(45),
  user_agent    text,
  kilitli       boolean NOT NULL DEFAULT false,
  kilit_at      timestamptz,
  kilit_hata    integer NOT NULL DEFAULT 0,
  son_aktivite  timestamptz NOT NULL DEFAULT now(),
  bitis         timestamptz NOT NULL,
  kapandi_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_oturumlar_admin ON admin_oturumlar(admin_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON admin_oturumlar TO sattigitti;
