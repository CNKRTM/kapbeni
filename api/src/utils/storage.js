// Abstraktionsschicht: lokal jetzt, R2 später – gleiche API
const fs   = require('fs');
const path = require('path');

const UPLOAD_BASE = process.env.UPLOAD_DIR || '/var/www/kapbeni/uploads';
const USE_R2       = !!(process.env.R2_BUCKET && process.env.R2_ACCOUNT_ID);

let r2Client = null;

if (USE_R2) {
  try {
    const { S3Client } = require('@aws-sdk/client-s3');
    r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId:     process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
    console.log('[Storage] Cloudflare R2 aktiv');
  } catch (e) {
    console.warn('[Storage] R2 nicht verfügbar, nutze lokalen Speicher:', e.message);
  }
}

/**
 * Datei speichern: R2 wenn konfiguriert, sonst lokal
 * @param {Buffer} buffer  - Dateiinhalt
 * @param {string} key     - Pfad/Key z.B. "products/bild_1234.webp"
 * @param {string} mimeType
 * @returns {string} öffentliche URL
 */
async function saveFile(buffer, key, mimeType = 'image/webp') {
  if (USE_R2 && r2Client) {
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    await r2Client.send(new PutObjectCommand({
      Bucket:      process.env.R2_BUCKET,
      Key:         key,
      Body:        buffer,
      ContentType: mimeType,
      CacheControl: 'public, max-age=31536000, immutable',
    }));
    const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || 'https://cdn.kapbeni.com';
    return `${R2_PUBLIC_URL}/${key}`;
  } else {
    const localPath = path.join(UPLOAD_BASE, key);
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    fs.writeFileSync(localPath, buffer);
    return `/uploads/${key}`;
  }
}

/**
 * Datei löschen (lokal + R2)
 */
async function deleteFile(key) {
  const localPath = path.join(UPLOAD_BASE, key);
  try { fs.unlinkSync(localPath); } catch {}

  if (USE_R2 && r2Client) {
    try {
      const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
      await r2Client.send(new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: key,
      }));
    } catch (e) {
      console.warn('[Storage] R2 Delete fehlgeschlagen:', e.message);
    }
  }
}

module.exports = { saveFile, deleteFile };
