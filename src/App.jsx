import { useEffect, useMemo, useState } from 'react'

function StatusBadge({ complete }) {
  const color = complete ? 'bg-emerald-600/20 text-emerald-300 border-emerald-600/30' : 'bg-rose-600/20 text-rose-300 border-rose-600/30'
  const text = complete ? 'Complete' : 'Missing Sections'
  return (
    <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full border ${color}`}>
      {text}
    </span>
  )
}

function App() {
  const baseUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all') // all | complete | incomplete
  const [onlyMissing, setOnlyMissing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const abort = new AbortController()
    async function fetchData() {
      try {
        setLoading(true)
        setError('')
        const params = new URLSearchParams()
        if (search) params.set('search', search)
        if (status === 'complete') params.set('complete', 'true')
        if (status === 'incomplete') params.set('complete', 'false')
        if (onlyMissing) params.set('missing', 'true')
        const url = `${baseUrl}/api/qc?${params.toString()}`
        const res = await fetch(url, { signal: abort.signal })
        if (!res.ok) throw new Error(`Failed to load (${res.status})`)
        const data = await res.json()
        setItems(Array.isArray(data) ? data : [])
      } catch (e) {
        if (e.name !== 'AbortError') setError(e.message || 'Failed to load')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
    return () => abort.abort()
  }, [baseUrl, search, status, onlyMissing, refreshKey])

  const filteredCount = items.length

  const handleImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setImporting(true)
      setError('')
      const text = await file.text()
      const json = JSON.parse(text)
      const itemsArr = Array.isArray(json) ? json : (Array.isArray(json.items) ? json.items : [])
      if (!itemsArr.length) throw new Error('No items found in JSON. Provide an array of QC objects or { items: [...] }')
      // Normalize booleans and arrays if needed
      const normalized = itemsArr.map((x) => ({
        document_id: x.document_id ?? x.id ?? '',
        filename: x.filename ?? null,
        sections_expected: Array.isArray(x.sections_expected) ? x.sections_expected : (x.sections_expected ? String(x.sections_expected).split(/\s*;\s*|\s*,\s*/).filter(Boolean) : []),
        sections_found: Array.isArray(x.sections_found) ? x.sections_found : (x.sections_found ? String(x.sections_found).split(/\s*;\s*|\s*,\s*/).filter(Boolean) : []),
        missing_sections: Array.isArray(x.missing_sections) ? x.missing_sections : (x.missing_sections ? String(x.missing_sections).split(/\s*;\s*|\s*,\s*/).filter(Boolean) : []),
        is_complete: typeof x.is_complete === 'boolean' ? x.is_complete : undefined,
        qc_score: typeof x.qc_score === 'number' ? x.qc_score : (x.qc_score ? Number(x.qc_score) : undefined),
        notes: x.notes ?? null,
      }))

      const res = await fetch(`${baseUrl}/api/qc/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: normalized })
      })
      if (!res.ok) throw new Error(`Import failed (${res.status})`)
      const out = await res.json()
      // Refresh list
      setRefreshKey((k) => k + 1)
      alert(`Imported ${out.inserted} record(s).`)
    } catch (e) {
      setError(e.message || 'Failed to import')
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  const columns = useMemo(() => ([
    { key: 'document_id', label: 'Document ID', width: 'w-48' },
    { key: 'filename', label: 'Filename', width: 'w-56' },
    { key: 'missing_sections', label: 'Missing Sections', width: 'w-[28rem]' },
    { key: 'is_complete', label: 'Status', width: 'w-40' },
    { key: 'qc_score', label: 'Score', width: 'w-24' },
  ]), [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <header className="flex items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Document QC Dashboard</h1>
            <p className="text-slate-400 text-sm">View which documents are missing required sections</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium cursor-pointer transition-colors">
              <input type="file" accept="application/json,.json" onChange={handleImport} className="absolute inset-0 opacity-0 cursor-pointer" disabled={importing} />
              {importing ? 'Importing...' : 'Import JSON'}
            </label>
            <a href="/test" className="px-3 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800/60 text-sm">Check Backend</a>
          </div>
        </header>

        <section className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="col-span-1 md:col-span-1">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by document ID or filename"
              className="w-full rounded-lg bg-slate-900/60 border border-slate-700 px-4 py-2.5 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div className="flex gap-3 items-center">
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg bg-slate-900/60 border border-slate-700 px-3 py-2.5 text-sm">
              <option value="all">All</option>
              <option value="complete">Complete</option>
              <option value="incomplete">Incomplete</option>
            </select>
            <label className="inline-flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" className="accent-blue-600" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />
              Only with missing sections
            </label>
            <button onClick={() => setRefreshKey((k) => k + 1)} className="ml-auto md:ml-0 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-sm">Refresh</button>
          </div>
        </section>

        {error && (
          <div className="mb-4 rounded-lg border border-rose-700/40 bg-rose-900/20 text-rose-200 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-900/50">
          <div className="grid grid-cols-[repeat(5,minmax(0,1fr))] gap-0 border-b border-slate-800/80 bg-slate-900/60">
            {columns.map((c) => (
              <div key={c.key} className={`px-4 py-3 text-xs uppercase tracking-wide text-slate-400 ${c.width}`}>{c.label}</div>
            ))}
          </div>
          {loading ? (
            <div className="p-8 text-center text-slate-400">Loading...</div>
          ) : filteredCount === 0 ? (
            <div className="p-8 text-center text-slate-400">No records found</div>
          ) : (
            <ul className="divide-y divide-slate-800">
              {items.map((it) => (
                <li key={it._id || it.document_id} className="grid grid-cols-[repeat(5,minmax(0,1fr))] gap-0">
                  <div className="px-4 py-3 text-sm font-medium truncate" title={it.document_id}>{it.document_id}</div>
                  <div className="px-4 py-3 text-sm truncate text-slate-300" title={it.filename || ''}>{it.filename || '—'}</div>
                  <div className="px-4 py-3 text-sm text-slate-300">
                    {Array.isArray(it.missing_sections) && it.missing_sections.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {it.missing_sections.map((s, i) => (
                          <span key={i} className="px-2 py-0.5 rounded-full bg-amber-600/20 border border-amber-600/30 text-amber-200 text-xs">{s}</span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-500">None</span>
                    )}
                  </div>
                  <div className="px-4 py-3 text-sm"><StatusBadge complete={!!it.is_complete} /></div>
                  <div className="px-4 py-3 text-sm">{typeof it.qc_score === 'number' ? Math.round(it.qc_score) : '—'}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="mt-6 text-xs text-slate-500">Backend: {baseUrl}</p>
      </div>
    </div>
  )
}

export default App
