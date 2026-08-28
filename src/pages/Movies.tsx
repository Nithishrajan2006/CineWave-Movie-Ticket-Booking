import { useEffect, useState } from 'react'
import { Film, Plus, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Movie } from '../types'
import PageHeader from '../components/PageHeader'
import Loading, { EmptyState } from '../components/Loading'
import Modal from '../components/Modal'

export default function Movies() {
  const [movies, setMovies] = useState<Movie[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Movie | null>(null)
  const [form, setForm] = useState({ title: '', genre: '', duration_minutes: '', rating: '', description: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('movies').select('*').order('title')
    setMovies(data || [])
    setLoading(false)
  }

  function openNew() {
    setEditing(null)
    setForm({ title: '', genre: '', duration_minutes: '', rating: '', description: '' })
    setModalOpen(true)
  }

  function openEdit(m: Movie) {
    setEditing(m)
    setForm({
      title: m.title,
      genre: m.genre || '',
      duration_minutes: m.duration_minutes?.toString() || '',
      rating: m.rating || '',
      description: m.description || '',
    })
    setModalOpen(true)
  }

  async function save() {
    if (!form.title.trim()) return
    setSaving(true)
    const payload = {
      title: form.title.trim(),
      genre: form.genre || null,
      duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : null,
      rating: form.rating || null,
      description: form.description || null,
    }
    if (editing) {
      await supabase.from('movies').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('movies').insert(payload)
    }
    setSaving(false)
    setModalOpen(false)
    load()
  }

  async function remove(id: string) {
    if (!confirm('Delete this movie? This will also delete its shows and bookings.')) return
    await supabase.from('movies').delete().eq('id', id)
    load()
  }

  if (loading) return <div className="p-8"><Loading /></div>

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in">
      <PageHeader
        title="Movies"
        subtitle="Manage the movie catalog"
        actions={<button className="btn-primary" onClick={openNew}><Plus className="w-4 h-4" /> Add Movie</button>}
      />

      {movies.length === 0 ? (
        <div className="card p-8">
          <EmptyState icon={Film} title="No movies yet" subtitle="Add your first movie to get started." />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {movies.map((m) => (
            <div key={m.id} className="card p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{m.title}</h3>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {m.genre && <span className="badge bg-gray-100 text-gray-600">{m.genre}</span>}
                    {m.rating && <span className="badge bg-accent-100 text-accent-700">{m.rating}</span>}
                    {m.duration_minutes && <span className="badge bg-gray-100 text-gray-600">{m.duration_minutes} min</span>}
                  </div>
                  {m.description && <p className="text-sm text-gray-500 mt-3 line-clamp-2">{m.description}</p>}
                </div>
              </div>
              <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                <button className="btn-ghost flex-1" onClick={() => openEdit(m)}>
                  <Pencil className="w-4 h-4" /> Edit
                </button>
                <button className="btn-ghost text-error-600 hover:bg-error-50" onClick={() => remove(m.id)}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Movie' : 'Add Movie'}>
        <div className="space-y-4">
          <div>
            <label className="label">Title</label>
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Movie title" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Genre</label>
              <input className="input" value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })} placeholder="Action, Drama..." />
            </div>
            <div>
              <label className="label">Rating</label>
              <input className="input" value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })} placeholder="PG-13, R..." />
            </div>
          </div>
          <div>
            <label className="label">Duration (minutes)</label>
            <input type="number" className="input" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} placeholder="120" />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input min-h-[80px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief synopsis..." />
          </div>
          <div className="flex gap-2 pt-2">
            <button className="btn-secondary flex-1" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn-primary flex-1" onClick={save} disabled={saving || !form.title.trim()}>
              {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Movie'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
