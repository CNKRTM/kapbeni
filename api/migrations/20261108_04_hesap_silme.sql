-- ═══════════════════════════════════════════════════════════════════════════
--  H – Kontoloeschung: ein Weg ueber users.durum
--    aktif -> silme_bekliyor (30 Tage, Anmeldung = Widerruf) -> silindi
--  Spalten fuer den Admin: durum, silinme_istegi (gibt es schon), silindi_at (neu).
-- ═══════════════════════════════════════════════════════════════════════════
BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS silindi_at timestamptz;
-- Zustand eines Inserats vor dem Loeschantrag, damit ein Widerruf ihn zurueckholt.
ALTER TABLE ilanlar ADD COLUMN IF NOT EXISTS silme_oncesi_durum varchar(20);

-- Altlasten der beiden frueheren Wege vereinheitlichen.
UPDATE users SET durum = 'silme_bekliyor', silinme_istegi = COALESCE(silinme_istegi, NOW())
 WHERE durum = 'deleted' OR (durum = 'aktif' AND silinme_istegi IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_users_durum_silme ON users(durum, silinme_istegi) WHERE durum IN ('silme_bekliyor', 'silindi');

SELECT durum, count(*) FROM users GROUP BY 1 ORDER BY 1;
COMMIT;
