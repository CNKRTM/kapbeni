-- Auftragssammlung A/L: Geschlecht fuer die Farbe des Kundennummer-Abzeichens
-- (k = Frau rot, e = Mann blau, NULL = neutral grau; Gewerbliche immer gelb) und
-- Unterlagen gewerblicher Kunden (Vergi levhası, İmza sirküleri, …). Rein additiv.
ALTER TABLE users ADD COLUMN IF NOT EXISTS cinsiyet char(1);
DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT users_cinsiyet_check CHECK (cinsiyet IS NULL OR cinsiyet IN ('k','e'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS musteri_belgeleri (
  id            serial PRIMARY KEY,
  user_id       integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tur           varchar(30) NOT NULL,      -- vergi_levhasi | imza_sirkuleri | ticaret_sicil | faaliyet_belgesi | yetkili_kimlik | iban
  dosya_url     varchar(500),              -- relativ zu uploads/belgeler (nicht oeffentlich); NULL = noch nicht hochgeladen / Platzhalter
  dosya_adi     varchar(255),
  durum         varchar(20) NOT NULL DEFAULT 'bekliyor',   -- bekliyor | onayli | reddedildi
  aciklama      text,                      -- z. B. Gueltigkeit, IBAN-Inhaber
  red_sebebi    text,
  gecerlilik    date,
  inceleyen_admin integer,                 -- admin_users.id
  inceleme_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS musteri_belgeleri_user ON musteri_belgeleri (user_id);

-- Interne Notizen: vorhandene Tabelle admin_kullanici_notlar wird weiterverwendet.
CREATE INDEX IF NOT EXISTS admin_kullanici_notlar_kullanici ON admin_kullanici_notlar (kullanici_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON musteri_belgeleri TO sattigitti;
GRANT USAGE, SELECT ON SEQUENCE musteri_belgeleri_id_seq TO sattigitti;
