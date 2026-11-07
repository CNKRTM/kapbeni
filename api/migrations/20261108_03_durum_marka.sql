-- ═══════════════════════════════════════════════════════════════════════════
--  M – Einheitlicher Zustand (4 Stufen) + Marke/Merkmale je Kategorie (EAV)
--  Vorher Sicherung: /usr/local/sbin/kapbeni-freeze.sh
-- ═══════════════════════════════════════════════════════════════════════════
BEGIN;

-- ── 1) Zustand: sifir | yeni_gibi | az_kullanilmis | kullanilmis ───────────
UPDATE ilanlar SET durum = 'kullanilmis' WHERE durum = 'ikinci_el';
UPDATE ilanlar SET durum = 'kullanilmis' WHERE durum IS NOT NULL
   AND durum NOT IN ('sifir', 'yeni_gibi', 'az_kullanilmis', 'kullanilmis');
ALTER TABLE ilanlar ALTER COLUMN durum SET DEFAULT 'kullanilmis';
ALTER TABLE ilanlar DROP CONSTRAINT IF EXISTS ilanlar_durum_check;
-- NULL bleibt erlaubt: Kategorien ohne Zustand (z. B. Dienstleistungen) setzen keinen.
ALTER TABLE ilanlar ADD CONSTRAINT ilanlar_durum_check
  CHECK (durum IS NULL OR durum IN ('sifir', 'yeni_gibi', 'az_kullanilmis', 'kullanilmis'));

-- Das doppelte EAV-Merkmal "durum" (Yeni/Yeni Gibi/İyi/Makul/Yıpranmış) entfaellt.
-- ilan_ozellik_degerleri ist leer (geprueft), die Optionen gehen per CASCADE mit.
DELETE FROM ilan_ozellik_degerleri WHERE tanim_id IN (SELECT id FROM kategori_ozellik_tanimlari WHERE alan_adi = 'durum');
DELETE FROM kategori_ozellik_tanimlari WHERE alan_adi = 'durum';

-- ── 2) Fahrzeugfelder an die Fahrzeug-Unterkategorie haengen ──────────────
-- Sonst erbten Ersatzteile, Felgen oder Mietwagen Pflichtfelder wie KM und Baujahr.
UPDATE kategori_ozellik_tanimlari SET kategori_id = (SELECT id FROM kategoriler WHERE slug = 'araba-araba')
 WHERE kategori_id = (SELECT id FROM kategoriler WHERE slug = 'araba')
   AND alan_adi IN ('model', 'yil', 'km', 'yakit', 'vites', 'renk', 'kasa', 'hasar')
   AND EXISTS (SELECT 1 FROM kategoriler WHERE slug = 'araba-araba');
UPDATE kategori_ozellik_tanimlari SET kategori_id = (SELECT id FROM kategoriler WHERE slug = 'motosiklet-marka')
 WHERE kategori_id = (SELECT id FROM kategoriler WHERE slug = 'motosiklet')
   AND alan_adi IN ('model', 'yil', 'km', 'cc')
   AND EXISTS (SELECT 1 FROM kategoriler WHERE slug = 'motosiklet-marka');

-- Pflicht nur, wo es ein Kaeufer wirklich braucht (Auto: Modell, Baujahr, KM).
UPDATE kategori_ozellik_tanimlari SET zorunlu = false;
UPDATE kategori_ozellik_tanimlari SET zorunlu = true
 WHERE kategori_id = (SELECT id FROM kategoriler WHERE slug = 'araba-araba') AND alan_adi IN ('model', 'yil', 'km');

-- ── 3) Marke als Auswahlliste je Hauptkategorie (Unterkategorien erben) ────
-- Einheitlicher Feldname "marka" (vorher arac_markasi / urun_markasi), tip 'secim'.
-- Freie Eingabe erlaubt die API fuer alan_adi='marka' ausdruecklich (Combobox).
UPDATE kategori_ozellik_tanimlari SET alan_adi = 'marka', etiket = 'Marka', tip = 'secim', sira = 0
 WHERE alan_adi IN ('arac_markasi', 'urun_markasi');

CREATE TEMP TABLE marka_liste(slug text, markalar text[]) ON COMMIT DROP;
INSERT INTO marka_liste VALUES
('araba', ARRAY['Alfa Romeo','Audi','BMW','BYD','Chery','Chevrolet','Citroen','Cupra','Dacia','DS Automobiles','Fiat','Ford','Honda','Hyundai','Jaguar','Jeep','Kia','Land Rover','Lexus','Mazda','Mercedes-Benz','MG','Mini','Mitsubishi','Nissan','Opel','Peugeot','Porsche','Renault','Seat','Skoda','Smart','SsangYong','Subaru','Suzuki','Tesla','Tofaş','Togg','Toyota','Volkswagen','Volvo']),
('telefon', ARRAY['Apple','Samsung','Xiaomi','Huawei','Honor','Oppo','Realme','Vivo','OnePlus','Google','Poco','Tecno','Infinix','Nokia','Motorola','Sony','TCL','General Mobile','Reeder','Casper']),
('elektronik', ARRAY['Apple','Samsung','LG','Sony','Philips','Xiaomi','Huawei','Lenovo','HP','Dell','Asus','Acer','MSI','Monster','Casper','Microsoft','Arçelik','Beko','Vestel','Bosch','Siemens','Profilo','Altus','Regal','Grundig','Toshiba','Panasonic','Canon','Nikon','Fujifilm','GoPro','JBL','Bose','Marshall','Dyson','Tefal','Fakir','Arzum','Sinbo','Karcher','Daikin','Mitsubishi Electric','Baymak','Demirdöküm','Vaillant','Nintendo','PlayStation','Xbox']),
('ev-yasam', ARRAY['IKEA','Bellona','İstikbal','Doğtaş','Kelebek','Enza Home','Mondi','Yataş','Çilek','Alfemo','Koçtaş','English Home','Madame Coco','Karaca','Paşabahçe','Korkmaz','Tefal','Emsan','Schafer','Taç','Özdilek','Linens']),
('motosiklet', ARRAY['Honda','Yamaha','Suzuki','Kawasaki','BMW','KTM','Ducati','Harley-Davidson','Triumph','Vespa','Piaggio','Kymco','SYM','Bajaj','TVS','CFMoto','Mondial','Kuba','RKS','Arora','Benelli','Aprilia','Royal Enfield']),
('giyim-aksesuar', ARRAY['LC Waikiki','Koton','DeFacto','Mavi','Zara','H&M','Mango','Pull&Bear','Bershka','Nike','Adidas','Puma','New Balance','Skechers','Converse','Vans','Levi''s','Tommy Hilfiger','Lacoste','Beymen','Vakko','Network','İpekyol','Colin''s','LTB','Kiğılı','Altınyıldız Classics','Damat','Hotiç','Derimod','Guess','Michael Kors']),
('kisisel-bakim-kozmetik', ARRAY['L''Oréal Paris','Maybelline','Flormar','Golden Rose','Nivea','Garnier','Pantene','Elidor','Dove','The Purest Solutions','Philips','Braun','Remington','Rowenta','Arzum','Dyson','Gillette','MAC','Estée Lauder','Clinique','La Roche-Posay','Vichy','CeraVe','Bioderma','Farmasi','Avon','Oriflame','Chanel','Dior']),
('anne-bebek-oyuncak', ARRAY['Chicco','Kraft','Joie','Cybex','Graco','Baby Jogger','Bugaboo','Maxi-Cosi','Britax Römer','Mamas & Papas','Philips Avent','Dr. Brown''s','Tommee Tippee','Wee Baby','Fisher-Price','LEGO','Mattel','Hasbro','Playmobil','Hot Wheels']),
('hobi-kitap-muzik', ARRAY['Yamaha','Casio','Roland','Korg','Fender','Gibson','Ibanez','Cort','Squier','Epiphone','LEGO','Ravensburger','Faber-Castell']),
('ofis-kirtasiye', ARRAY['Faber-Castell','Staedtler','Pelikan','Rotring','Stabilo','Pilot','Uni-ball','Bic','Adel','Mopak','Gıpta','Keskin Color','Canon','HP','Epson','Brother','Xerox','Kyocera']),
('spor-outdoor', ARRAY['Nike','Adidas','Puma','Under Armour','Asics','New Balance','Salomon','The North Face','Columbia','Jack Wolfskin','Decathlon','Bianchi','Salcano','Kron','Bisan','Carraro','Trek','Giant','Specialized','Cannondale','Scott','Head','Wilson','Babolat','Voit','Molten','Delta']),
('diger-araclar', ARRAY['Ford Trucks','Mercedes-Benz','MAN','Scania','Volvo','Iveco','DAF','Renault Trucks','Isuzu','BMC','Otokar','Temsa','Karsan','Hyundai','Fiat','Hymer','Knaus','Adria','Hobby','Beneteau','Jeanneau','Bavaria','Yamaha']),
('yapi-market-bahce', ARRAY['Bosch','Makita','DeWalt','Black+Decker','Stanley','Einhell','Metabo','Hilti','Milwaukee','Ryobi','Stihl','Husqvarna','Karcher','Gardena','Viko','Legrand','Schneider Electric','Philips','Osram','ECA','Artema','VitrA','Grohe','Hansgrohe','Kale','Weber']),
('pet-shop', ARRAY['Royal Canin','Pro Plan','Hill''s','Acana','Orijen','Brit','N&D','Reflex','Whiskas','Pedigree','Felix','Purina','Trixie','Ferplast','Tetra','JBL','Versele-Laga']);
-- Antika bekommt bewusst keine Marke. Immobilien/Dienstleistungen gibt es im Baum (noch) nicht.

DO $$
DECLARE r record; t_id int; i int;
BEGIN
  FOR r IN SELECT m.slug, m.markalar, k.id AS kid FROM marka_liste m JOIN kategoriler k ON k.slug = m.slug LOOP
    SELECT id INTO t_id FROM kategori_ozellik_tanimlari WHERE kategori_id = r.kid AND alan_adi = 'marka' LIMIT 1;
    IF t_id IS NULL THEN
      INSERT INTO kategori_ozellik_tanimlari(kategori_id, alan_adi, etiket, zorunlu, tip, sira)
      VALUES (r.kid, 'marka', 'Marka', false, 'secim', 0) RETURNING id INTO t_id;
    END IF;
    DELETE FROM kategori_ozellik_secenekleri WHERE tanim_id = t_id;
    FOR i IN 1 .. array_length(r.markalar, 1) LOOP
      INSERT INTO kategori_ozellik_secenekleri(tanim_id, deger, sira) VALUES (t_id, r.markalar[i], i);
    END LOOP;
    -- "Diğer" immer als letzter Eintrag.
    INSERT INTO kategori_ozellik_secenekleri(tanim_id, deger, sira) VALUES (t_id, 'Diğer', 999);
  END LOOP;
END $$;

-- Ein Wert je Inserat und Merkmal.
CREATE UNIQUE INDEX IF NOT EXISTS ilan_ozellik_degerleri_ilan_tanim_uq ON ilan_ozellik_degerleri(ilan_id, tanim_id);
CREATE INDEX IF NOT EXISTS ilan_ozellik_degerleri_tanim_deger ON ilan_ozellik_degerleri(tanim_id, deger);

-- Kontrolle
SELECT durum, count(*) FROM ilanlar GROUP BY 1 ORDER BY 1;
SELECT k.slug, t.alan_adi, t.zorunlu, (SELECT count(*) FROM kategori_ozellik_secenekleri s WHERE s.tanim_id = t.id) AS secenek
  FROM kategori_ozellik_tanimlari t JOIN kategoriler k ON k.id = t.kategori_id
 WHERE t.alan_adi = 'marka' OR t.zorunlu ORDER BY k.id, t.sira;
COMMIT;
