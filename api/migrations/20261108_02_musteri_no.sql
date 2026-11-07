-- ═══════════════════════════════════════════════════════════════════════════
--  L – Kundennummer KP-<Registrierungsjahr>-<7-stellig>, z. B. KP-2026-0000001
--  Fortlaufend ueber EINE Sequenz, kein Neustart pro Jahr (Vorschlag in L).
--  Vergabe per BEFORE-INSERT-Trigger -> greift bei jeder Registrierung,
--  auch bei einem spaeteren Google-Login, ohne dass die Route daran denken muss.
-- ═══════════════════════════════════════════════════════════════════════════
BEGIN;

CREATE SEQUENCE IF NOT EXISTS musteri_no_seq START 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS musteri_no varchar(24);

-- Nummer formatieren: unter 10 Mio. 7-stellig mit Nullen, darueber ungekuerzt
-- (lpad wuerde laengere Zahlen abschneiden).
CREATE OR REPLACE FUNCTION kp_musteri_no(jahr_ab timestamptz, n bigint) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT 'KP-' || to_char(jahr_ab AT TIME ZONE 'Europe/Istanbul', 'YYYY') || '-'
         || lpad(n::text, greatest(7, length(n::text)), '0')
$$;

-- Bestand in der Reihenfolge der Registrierung nachziehen.
UPDATE users u SET musteri_no = kp_musteri_no(u.created_at, x.rn)
  FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn
          FROM users WHERE musteri_no IS NULL) x
 WHERE x.id = u.id;
SELECT setval('musteri_no_seq', GREATEST((SELECT count(*) FROM users), 1), (SELECT count(*) FROM users) > 0);

CREATE OR REPLACE FUNCTION kp_musteri_no_ver() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.musteri_no IS NULL THEN
    NEW.musteri_no := kp_musteri_no(coalesce(NEW.created_at, now()), nextval('musteri_no_seq'));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_musteri_no ON users;
CREATE TRIGGER trg_musteri_no BEFORE INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION kp_musteri_no_ver();

ALTER TABLE users ALTER COLUMN musteri_no SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_musteri_no_key') THEN
    ALTER TABLE users ADD CONSTRAINT users_musteri_no_key UNIQUE (musteri_no);
  END IF;
END $$;

-- Rechte fuer den App-Benutzer: der Trigger laeuft mit dessen Rechten und braucht nextval.
GRANT USAGE, SELECT, UPDATE ON SEQUENCE musteri_no_seq TO sattigitti;

SELECT id, created_at::date, musteri_no FROM users ORDER BY created_at, id;
COMMIT;
