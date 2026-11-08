-- Admin-Testkonten markieren (gleiches Muster wie users.test_verisi).
-- Fuer UI-Tests des Admins wird ein eigenes Konto mit test_verisi=true angelegt;
-- echte Admin-Konten bleiben unberuehrt.
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS test_verisi boolean NOT NULL DEFAULT false;
