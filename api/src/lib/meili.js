// Fetch-basierter Meili-Client (kein npm-Client — dessen aktuelle Version ist ESM-only,
// inkompatibel mit dem CommonJS-Backend). Node 20 hat global fetch.
const HOST = 'http://127.0.0.1:7700'
const KEY = 'kapbeni-meili-2024-secret'

async function meili(method, path, body) {
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
