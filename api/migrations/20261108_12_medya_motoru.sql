-- Auftragssammlung I/J (v1.27): Einstellungen und Job-Tabelle der Medien-Engine.
BEGIN;

CREATE TABLE IF NOT EXISTS medya_ayarlari (
  anahtar     varchar(40) PRIMARY KEY,
  deger       jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  admin_id    integer
);

-- Ein Job je Datei. Bilder laufen synchron in der API (Mischform, s. CLAUDE.md)
-- und werden hier nur protokolliert (senkron=true); Videos und Bestandsarbeiten
-- verarbeitet der Dienst kapbeni-media.
CREATE TABLE IF NOT EXISTS medya_isleri (
  id               serial PRIMARY KEY,
  tip              varchar(20) NOT NULL CHECK (tip IN ('bild','bild_sm','video')),
  durum            varchar(12) NOT NULL DEFAULT 'bekliyor' CHECK (durum IN ('bekliyor','isleniyor','tamam','hata')),
  senkron          boolean NOT NULL DEFAULT false,
  ilan_id          integer REFERENCES ilanlar(id) ON DELETE SET NULL,
  ilan_uuid        uuid,
  user_id          integer REFERENCES users(id) ON DELETE SET NULL,
  kaynak           text,           -- Rohdatei (Zwischenverzeichnis) bzw. Quelldatei
  hedef            text,           -- Ergebnis-URL(s)
  deneme           integer NOT NULL DEFAULT 0,
  hata             text,           -- technisch (Admin)
  hata_kullanici   text,           -- verstaendlich (Kunde)
  boyut_once       bigint,
  boyut_sonra      bigint,
  sure_ms          integer,
  detay            jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  basladi_at       timestamptz,
  bitti_at         timestamptz
);
CREATE INDEX IF NOT EXISTS medya_isleri_durum_idx ON medya_isleri (durum, id);
CREATE INDEX IF NOT EXISTS medya_isleri_ilan_idx ON medya_isleri (ilan_id);
CREATE INDEX IF NOT EXISTS medya_isleri_zeit_idx ON medya_isleri (created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON medya_ayarlari, medya_isleri TO sattigitti;
GRANT USAGE, SELECT ON SEQUENCE medya_isleri_id_seq TO sattigitti;

COMMIT;
