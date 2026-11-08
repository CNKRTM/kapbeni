#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  Bestand nachziehen: zu jedem eigenen Inseratsbild die kleine Variante _sm
//  erzeugen (Auftragssammlung I, v1.27).
//
//    node api/scripts/medya-sm-nachziehen.js            # Trockenlauf (Standard)
//    node api/scripts/medya-sm-nachziehen.js --uygula   # Sicherung + erzeugen
//
//  Das Original wurde nie aufbewahrt, also entsteht _sm aus der vorhandenen
//  1200-px-Datei (bild.kleinAusGross). Das Wasserzeichen steckt dort schon im
//  Bild und wird mitverkleinert — es wird KEIN zweites aufgelegt.
//  Vorhandene Dateien werden nie veraendert, nur neue _sm-Dateien angelegt.
//  Vor --uygula: Sicherung des Ordners nach /opt/_archiv/ (tar.gz).
// ════════════════════════════════════════════════════════════════════════════
require('dotenv').config({ path: '/etc/kapbeni.env' });
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { query, pool } = require('../src/db/pool');
const bild = require('../src/lib/bild');
const medyaAyar = require('../src/lib/medyaAyar');

const UYGULA = process.argv.includes('--uygula');
const VIDEO = process.argv.includes('--video');
const DIR = path.join(process.env.UPLOAD_DIR || '/var/www/kapbeni/uploads', 'ilanlar');

// --video (v1.28): Bestandsvideos ohne Poster als Job an kapbeni-media geben
// (immer umrechnen: 720p H.264 CRF 28, AAC 96k, faststart + Poster). Die Datei
// wird dafuer in das Engine-Verzeichnis KOPIERT; das bisherige Video bleibt
// sichtbar, bis die Engine das neue eintraegt und das alte abraeumt.
async function videosNachziehen() {
  const medyaIs = require('../src/lib/medyaIs');
  const { rows } = await query(`SELECT id, uuid, user_id, video_url FROM ilanlar
     WHERE video_url LIKE '/uploads/ilanlar/%' AND video_poster_url IS NULL AND COALESCE(video_durum,'tamam') <> 'isleniyor' ORDER BY id`);
  console.log(`Videos ohne Poster: ${rows.length}`);
  for (const r of rows) {
    const quelle = path.join(DIR, path.basename(r.video_url));
    if (!fs.existsSync(quelle)) { console.log('  Datei fehlt:', r.video_url); continue; }
    console.log(`  ${UYGULA ? 'Job fuer' : 'wuerde Job anlegen fuer'} ilan ${r.id} (${(fs.statSync(quelle).size / 1048576).toFixed(1)} MB)`);
    if (!UYGULA) continue;
    const kopie = path.join(medyaIs.TMP_MEDYA(), `${r.uuid}_bestand_${Date.now()}.mp4`);
    fs.mkdirSync(medyaIs.TMP_MEDYA(), { recursive: true });
    fs.copyFileSync(quelle, kopie);
    const { rows: j } = await query(`INSERT INTO medya_isleri(tip,durum,ilan_id,ilan_uuid,user_id,kaynak,boyut_once,detay)
       VALUES('video','bekliyor',$1,$2,$3,$4,$5,'{"bestand":true}') RETURNING id`, [r.id, r.uuid, r.user_id, kopie, fs.statSync(kopie).size]);
    await query(`UPDATE ilanlar SET video_is_id=$1, video_durum='isleniyor' WHERE id=$2`, [j[0].id, r.id]);
  }
  if (UYGULA) medyaIs.motorWecken(); else console.log('Trockenlauf — nichts geschrieben. Mit --video --uygula ausfuehren.');
  await new Promise((r) => setTimeout(r, 300));
  await pool.end();
}

(async () => {
  if (VIDEO) return videosNachziehen();
  const { rows } = await query(
    `SELECT f.id, f.url, f.ilan_id, i.uuid, i.user_id FROM ilan_fotograflar f JOIN ilanlar i ON i.id=f.ilan_id
      WHERE f.url LIKE '/uploads/ilanlar/%' ORDER BY f.id`);
  const offen = [];
  let fehlt = 0;
  for (const r of rows) {
    const k = bild.kleinUrl(r.url);
    if (!k || k === r.url) continue;
    const quelle = path.join(DIR, path.basename(r.url));
    const ziel = path.join(DIR, path.basename(k));
    if (!fs.existsSync(quelle)) { fehlt++; continue; }
    if (fs.existsSync(ziel)) continue;
    offen.push({ ...r, quelle, ziel });
  }
  console.log(`Bilder gesamt: ${rows.length}, ohne _sm: ${offen.length}, Quelldatei fehlt: ${fehlt}`);
  if (!UYGULA) {
    for (const o of offen.slice(0, 20)) console.log('  wuerde erzeugen:', path.basename(o.ziel));
    if (offen.length > 20) console.log(`  … und ${offen.length - 20} weitere`);
    console.log('Trockenlauf — nichts geschrieben. Mit --uygula ausfuehren.');
    await pool.end(); return;
  }
  if (offen.length) {
    const stempel = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
    const sicherung = `/opt/_archiv/kapbeni-uploads-ilanlar-${stempel}.tar.gz`;
    fs.mkdirSync('/opt/_archiv', { recursive: true });
    execFileSync('tar', ['-czf', sicherung, '-C', path.dirname(DIR), path.basename(DIR)]);
    console.log('Sicherung:', sicherung);
  }
  const ayar = await medyaAyar.bildAyar();
  let ok = 0, vorher = 0, nachher = 0;
  for (const o of offen) {
    const t0 = Date.now();
    try {
      const ein = fs.readFileSync(o.quelle);
      const sm = await bild.kleinAusGross(ein, ayar);
      fs.writeFileSync(o.ziel, sm, { flag: 'wx' });   // nie ueberschreiben
      ok++; vorher += ein.length; nachher += sm.length;
      await query(`INSERT INTO medya_isleri(tip,durum,senkron,ilan_id,ilan_uuid,user_id,kaynak,hedef,boyut_once,boyut_sonra,sure_ms,deneme,basladi_at,bitti_at,detay)
                   VALUES('bild_sm','tamam',true,$1,$2,$3,$4,$5,$6,$7,$8,1,now(),now(),'{"bestand":true}')`,
        [o.ilan_id, o.uuid, o.user_id, o.url, bild.kleinUrl(o.url), ein.length, sm.length, Date.now() - t0]);
    } catch (e) {
      console.error('  Fehler', path.basename(o.quelle), e.message);
      await query(`INSERT INTO medya_isleri(tip,durum,senkron,ilan_id,ilan_uuid,user_id,kaynak,hata,hata_kullanici,deneme,basladi_at,bitti_at)
                   VALUES('bild_sm','hata',true,$1,$2,$3,$4,$5,'Küçük görsel oluşturulamadı.',1,now(),now())`,
        [o.ilan_id, o.uuid, o.user_id, o.url, e.message.slice(0, 500)]).catch(() => {});
    }
  }
  console.log(`Erzeugt: ${ok}/${offen.length}; _lg gesamt ${(vorher / 1024).toFixed(0)} KB → _sm gesamt ${(nachher / 1024).toFixed(0)} KB`);
  await pool.end();
})().catch((e) => { console.error(e); process.exit(1); });
