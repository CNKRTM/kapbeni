-- Auftragssammlung G: Archiv beendeter Inserate (Loeschen, Ablehnen, Entfernen durch den
-- Admin, Kontoschliessung). Snapshot + Bilddateien unter
-- /var/www/kapbeni/uploads/archiv/<musteri_no>/<ilan-uuid>/ (nicht oeffentlich).
-- Aufbewahrung 2 Jahre, Loeschlauf in lib/cron.js. Rein additiv.
CREATE TABLE IF NOT EXISTS ilan_arsiv (
  id               bigserial PRIMARY KEY,
  ilan_uuid        uuid NOT NULL,
  ilan_id          integer,                       -- urspruengliche id (Zeile kann geloescht sein)
  ilan_no          bigint,
  user_id          integer REFERENCES users(id) ON DELETE CASCADE,
  musteri_no       varchar(20),
  baslik           varchar(255),
  aciklama         text,
  fiyat            numeric,
  kategori_id      integer,
  kategori_ad      varchar(255),
  marka            varchar(120),
  durum            varchar(30),                   -- Zustand (sifir, yeni_gibi, …)
  sehir            varchar(100),
  ilce             varchar(100),
  ilan_durum_onceki varchar(30),
  bilder           jsonb NOT NULL DEFAULT '[]',   -- [{url, arsiv}] arsiv = Pfad relativ zu uploads/archiv, null = externes Bild
  video            jsonb,                         -- {url, arsiv} oder null
  ozellikler       jsonb,
  grund            varchar(30) NOT NULL,          -- silindi | reddedildi | admin_kaldirdi | hesap_kapatildi
  grund_detay      text,
  kaynak           varchar(20) NOT NULL,          -- kullanici | admin | cron
  admin_id         integer,                       -- admin_users.id (Express-Admin) bzw. users.id (SPA-Admin, s. detay)
  ip               varchar(45),
  ilan_created_at  timestamptz,
  created_at       timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ilan_arsiv_user  ON ilan_arsiv (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ilan_arsiv_uuid  ON ilan_arsiv (ilan_uuid);
CREATE INDEX IF NOT EXISTS ilan_arsiv_zaman ON ilan_arsiv (created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON ilan_arsiv TO sattigitti;
GRANT USAGE, SELECT ON SEQUENCE ilan_arsiv_id_seq TO sattigitti;
