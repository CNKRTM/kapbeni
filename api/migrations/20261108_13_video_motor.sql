-- Auftragssammlung J (v1.28): Videos laufen asynchron ueber kapbeni-media.
BEGIN;
ALTER TABLE ilanlar ADD COLUMN IF NOT EXISTS video_durum varchar(12)
  CHECK (video_durum IS NULL OR video_durum IN ('isleniyor','tamam','hata'));
ALTER TABLE ilanlar ADD COLUMN IF NOT EXISTS video_poster_url varchar(500);
ALTER TABLE ilanlar ADD COLUMN IF NOT EXISTS video_hata text;
-- Der zuletzt angelegte Video-Job; ein aelterer (ueberholter) Job darf das
-- Ergebnis nicht mehr eintragen.
ALTER TABLE ilanlar ADD COLUMN IF NOT EXISTS video_is_id integer;
UPDATE ilanlar SET video_durum='tamam' WHERE video_url IS NOT NULL AND video_durum IS NULL;
COMMIT;
