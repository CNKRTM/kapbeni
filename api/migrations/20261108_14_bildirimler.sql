-- Benachrichtigungen (v1.35): Quelle je Meldung, damit
--  - eine Konversation nur EINE ungelesene Chat-Meldung erzeugt (neue Nachricht aktualisiert sie),
--  - das Oeffnen der Konversation die Meldung als gelesen markiert,
--  - Tests ihre eigenen Meldungen gezielt entfernen koennen.
BEGIN;
ALTER TABLE bildirimler ADD COLUMN IF NOT EXISTS kaynak_tip varchar(20);
ALTER TABLE bildirimler ADD COLUMN IF NOT EXISTS kaynak_id integer;
CREATE INDEX IF NOT EXISTS idx_bildirimler_kaynak ON bildirimler(user_id, kaynak_tip, kaynak_id) WHERE okundu = false;
CREATE INDEX IF NOT EXISTS idx_bildirimler_liste ON bildirimler(user_id, olusturma_tarihi DESC);
COMMIT;
