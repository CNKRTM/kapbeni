-- ═══════════════════════════════════════════════════════════════════════════
--  F – Formulare: Telefon E.164, gewerbliche Angaben, Testdaten-Markierung
--  Ausfuehren: sudo -u postgres psql -d sattigitti_db -v ON_ERROR_STOP=1 -f <datei>
--  Vorher Sicherung: /usr/local/sbin/kapbeni-freeze.sh
-- ═══════════════════════════════════════════════════════════════════════════
BEGIN;

-- Testdaten-Markierung (Grundlage fuer spaetere Testkunden, Filter im Admin).
ALTER TABLE users ADD COLUMN IF NOT EXISTS test_verisi boolean NOT NULL DEFAULT false;
-- Testkonto aus den Agentenregeln.
UPDATE users SET test_verisi = true WHERE id = 15;

-- Gewerbliche Angaben: firma_adi, vkn, mersis_no gibt es schon, Vergi Dairesi fehlte.
ALTER TABLE users ADD COLUMN IF NOT EXISTS vergi_dairesi varchar(120);

-- Gleiche Regel wie api/src/lib/dogrula.js -> telefonNormalize().
CREATE OR REPLACE FUNCTION kp_telefon_e164(p text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN d ~ '^5[0-9]{9}$' THEN '+90' || d END
  FROM (SELECT CASE
                 WHEN x LIKE '0090%'                 THEN substr(x, 5)
                 WHEN x LIKE '90%' AND length(x) = 12 THEN substr(x, 3)
                 WHEN x LIKE '0%'  AND length(x) = 11 THEN substr(x, 2)
                 ELSE x END AS d
        FROM (SELECT regexp_replace(coalesce(p, ''), '\D', '', 'g') AS x) a) b
$$;

-- Konflikte mit users_phone_key vorab zeigen (zwei Konten, gleiche Nummer nach Normalisierung).
SELECT kp_telefon_e164(phone) AS e164, array_agg(id ORDER BY id) AS konten
  FROM users WHERE kp_telefon_e164(phone) IS NOT NULL
 GROUP BY 1 HAVING count(*) > 1;

-- Nicht normalisierbare Nummern bleiben unveraendert und werden gemeldet.
SELECT id, phone AS ungueltig FROM users WHERE kp_telefon_e164(phone) IS NULL ORDER BY id;

-- Umstellen, nur wo eindeutig: keine zweite Zeile mit derselben Zielnummer.
UPDATE users u SET phone = kp_telefon_e164(u.phone)
 WHERE kp_telefon_e164(u.phone) IS NOT NULL
   AND u.phone <> kp_telefon_e164(u.phone)
   AND NOT EXISTS (SELECT 1 FROM users o
                    WHERE o.id <> u.id
                      AND (o.phone = kp_telefon_e164(u.phone)
                           OR kp_telefon_e164(o.phone) = kp_telefon_e164(u.phone)));

SELECT id, phone FROM users ORDER BY id;
COMMIT;
