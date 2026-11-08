-- Auftragssammlung A: IP- und Ereignisprotokoll je Kunde (5651: Aufbewahrung 2 Jahre,
-- Loeschung per Cron in lib/cron.js). Geschrieben ueber api/src/lib/olay.js.
-- Rein additiv, veraendert keine Bestandsdaten.
CREATE TABLE IF NOT EXISTS musteri_olaylari (
  id          bigserial PRIMARY KEY,
  user_id     integer REFERENCES users(id) ON DELETE CASCADE,   -- Konten werden nie hart geloescht (Anonymisierung), nur Testkonten
  olay        varchar(40)  NOT NULL,          -- giris, giris_basarisiz, kayit, ilan_olustur, ilan_duzenle, ilan_sil, mesaj, teklif, sikayet, belge, hesap_silme_talebi …
  hedef_tip   varchar(30),
  hedef_id    varchar(64),                    -- id oder uuid des Ziels (Inserat, Nachricht, Gebot …)
  ip          varchar(45),
  sehir       varchar(120),
  ulke        varchar(60),
  isp         varchar(120),
  cihaz       varchar(120),
  tarayici    varchar(120),
  os          varchar(120),
  user_agent  varchar(500),
  detay       jsonb,
  created_at  timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS musteri_olaylari_user_zaman ON musteri_olaylari (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS musteri_olaylari_zaman      ON musteri_olaylari (created_at);
CREATE INDEX IF NOT EXISTS musteri_olaylari_ip         ON musteri_olaylari (ip);
CREATE INDEX IF NOT EXISTS musteri_olaylari_olay       ON musteri_olaylari (olay);

GRANT SELECT, INSERT, UPDATE, DELETE ON musteri_olaylari TO sattigitti;
GRANT USAGE, SELECT ON SEQUENCE musteri_olaylari_id_seq TO sattigitti;
