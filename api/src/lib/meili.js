// Fetch-basierter Meili-Client (kein npm-Client — dessen aktuelle Version ist ESM-only,
// inkompatibel mit dem CommonJS-Backend). Node 20 hat global fetch.
// Host und Schluessel: Admin → Entegrasyonlar → Meilisearch (DB -> .env MEILI_HOST/
// MEILI_MASTER_KEY -> Standard). Der Schluessel stand frueher fest in dieser Datei.
const entegrasyon = require('./entegrasyon')

async function zugang() {
  try { const a = await entegrasyon.ayar('meilisearch'); return { host: a.degerler.host.replace(/\/$/, ''), key: a.degerler.apiKey } }
  catch { return { host: process.env.MEILI_HOST || 'http://127.0.0.1:7700', key: process.env.MEILI_MASTER_KEY || '' } }
}

async function meili(method, path, body) {
  const { host: HOST, key: KEY } = await zugang()
  const res = await fetch(`${HOST}${path}`, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (res.status >= 400) {
    const t = await res.text().catch(() => '')
    throw new Error(`Meili ${res.status}: ${t.slice(0, 200)}`)
  }
  return res.json().catch(() => ({}))
}

const ilanlarIndex = {
  addDocuments: (docs) => meili('POST', '/indexes/ilanlar/documents?primaryKey=uuid', docs),
  deleteDocument: (uuid) => meili('DELETE', `/indexes/ilanlar/documents/${encodeURIComponent(uuid)}`),
  search: (q, opts = {}) => meili('POST', '/indexes/ilanlar/search', { q, ...opts }),
}

module.exports = { meili, ilanlarIndex }
