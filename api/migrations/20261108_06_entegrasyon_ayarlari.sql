-- Entegrasyonlar (Admin → Sistem): je Anbieter eine Zeile.
-- credentials: AES-256-GCM-Umschlag {v,iv,tag,ct} (Schluessel INTEGRATION_ENCRYPTION_KEY
-- in /etc/kapbeni.env), nie Klartext. config: nicht geheime Felder als JSON.
CREATE TABLE IF NOT EXISTS entegrasyon_ayarlari (
  id              serial PRIMARY KEY,
  provider        varchar(40)  NOT NULL UNIQUE,
  kategori        varchar(40),
  mod             varchar(10)  NOT NULL DEFAULT 'disabled' CHECK (mod IN ('disabled','fake','test','live')),
  aktif           boolean      NOT NULL DEFAULT false,
  credentials     jsonb,
  config          jsonb        NOT NULL DEFAULT '{}'::jsonb,
  son_test_at     timestamptz,
  son_test_sonuc  varchar(10)  CHECK (son_test_sonuc IN ('ok','hata')),
  son_test_mesaj  text,
  guncelleyen     integer      REFERENCES admin_users(id) ON DELETE SET NULL,
  guncellendi_at  timestamptz,
  created_at      timestamptz  NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON entegrasyon_ayarlari TO sattigitti;
GRANT USAGE, SELECT ON SEQUENCE entegrasyon_ayarlari_id_seq TO sattigitti;
