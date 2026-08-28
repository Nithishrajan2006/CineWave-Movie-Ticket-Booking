import { useEffect, useState } from 'react'
import { CalendarDays, Plus, Pencil, Trash2, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Movie, Show } from '../types'
import { formatCurrency, formatDate, formatTime } from '../lib/format'
import PageHeader from '../components/PageHeader'
import Loading, { EmptyState } from '../components/Loading'
import Modal from '../components/Modal'

export default function Shows() {
  const [shows, setShows] = useState<Show[]>([])
  const [movies, setMovies] = useState<Movie[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Show | null>(null)
  const [form, setForm] = useState({
    movie_id: '', theatre_name: '', screen_name: '', show_type: 'Standard',
    show_date: '', show_time: '19:00', total_seats: '100', price_per_seat: '12.00',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('shows')
      .select('*, movie:movies(*)')
      .order('show_date', { ascending: true })
    setShows(data || [])
    const { data: m } = await supabase.from('movies').select('*').order('title')
    setMovies(m || [])
    setLoading(false)
  }

  function openNew() {
    setEditing(null)
    setForm({
      movie_id: movies[0]?.id || '', theatre_name: '', screen_name: '', show_type: 'Standard',
      show_date: '', show_time: '19:00', total_seats: '100', price_per_seat: '12.00',
    })
    setModalOpen(true)
  }

  function openEdit(s: Show) {
    setEditing(s)
    setForm({
      movie_id: s.movie_id, theatre_name: s.theatre_name, screen_name: s.screen_name,
      show_type: s.show_type, show_date: s.show_date, show_time: s.show_time,
      total_seats: s.total_seats.toString(), price_per_seat: s.price_per_seat.toString(),
    })
    setModalOpen(true)
  }

  async function save() {
    if (!form.movie_id || !form.theatre_name || !form.screen_name || !form.show_date) return
    setSaving(true)
    const payload = {
      movie_id: form.movie_id,
      theatre_name: form.theatre_name,
      screen_name: form.screen_name,
      show_type: form.show_type,
      show_date: form.show_date,
      show_time: form.show_time,
      total_seats: parseInt(form.total_seats) || 100,
      price_per_seat: parseFloat(form.price_per_seat) || 0,
    }
    if (editing) {
      await supabase.from('shows').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('shows').insert(payload)
    }
    setSaving(false)
    setModalOpen(false)
    load()
  }

  async function remove(id: string) {
    if (!confirm('Delete this show? Related bookings will also be deleted.')) return
    await supabase.from('shows').delete().eq('id', id)
    load()
  }

  if (loading) return <div className="p-8"><Loading /></div>

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in">
      <PageHeader
        title="Shows"
        subtitle="Manage show schedules and seating availability"
        actions={<button className="btn-primary" onClick={openNew} disabled={movies.length === 0}><Plus className="w-4 h-4" /> Add Show</button>}
      />

      {shows.length === 0 ? (
        <div className="card p-8">
          <EmptyState icon={CalendarDays} title="No shows scheduled" subtitle={movies.length === 0 ? 'Add a movie first.' : 'Schedule your first show.'} />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {shows.map((s) => {
            const available = s.total_seats - s.booked_seats
            const pct = s.total_seats > 0 ? (s.booked_seats / s.total_seats) * 100 : 0
            return (
              <div key={s.id} className="card p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{s.movie?.title}</h3>
                    <p className="text-sm text-gray-500">{s.theatre_name} - {s.screen_name}</p>
                  </div>
                  <span className={`badge ${s.show_type === 'Premium' ? 'bg-primary-100 text-primary-700' : 'bg-accent-100 text-accent-700'}`}>
                    {s.show_type}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                  <span className="flex items-center gap-1"><CalendarDays className="w-4 h-4" /> {formatDate(s.show_date)}</span>
                  <span>{formatTime(s.show_time)}</span>
                  <span className="ml-auto font-semibold text-gray-900">{formatCurrency(s.price_per_seat)}</span>
                </div>
                {/* Seat availability bar */}
                <div>
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                    <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {s.booked_seats}/{s.total_seats} booked</span>
                    <span className={available > 0 ? 'text-success-600' : 'text-error-600'}>
                      {available} available
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${pct >= 90 ? 'bg-error-500' : pct >= 60 ? 'bg-warning-500' : 'bg-success-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                  <button className="btn-ghost flex-1" onClick={() => openEdit(s)}>
                    <Pencil className="w-4 h-4" /> Edit
                  </button>
                  <button className="btn-ghost text-error-600 hover:bg-error-50" onClick={() => remove(s.id)}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Show' : 'Add Show'}>
        <div className="space-y-4">
          <div>
            <label className="label">Movie</label>
            <select className="input" value={form.movie_id} onChange={(e) => setForm({ ...form, movie_id: e.target.value })}>
              {movies.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Theatre</label>
              <input className="input" value={form.theatre_name} onChange={(e) => setForm({ ...form, theatre_name: e.target.value })} placeholder="CineWave Downtown" />
            </div>
            <div>
              <label className="label">Screen</label>
              <input className="input" value={form.screen_name} onChange={(e) => setForm({ ...form, screen_name: e.target.value })} placeholder="Screen 1" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Show Type</label>
              <select className="input" value={form.show_type} onChange={(e) => setForm({ ...form, show_type: e.target.value })}>
                <option value="Standard">Standard</option>
                <option value="Premium">Premium</option>
              </select>
            </div>
            <div>
              <label className="label">Price / Seat</label>
              <input type="number" step="0.01" className="input" value={form.price_per_seat} onChange={(e) => setForm({ ...form, price_per_seat: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" value={form.show_date} onChange={(e) => setForm({ ...form, show_date: e.target.value })} />
            </div>
            <div>
              <label className="label">Time</label>
              <input type="time" className="input" value={form.show_time} onChange={(e) => setForm({ ...form, show_time: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Total Seats</label>
            <input type="number" className="input" value={form.total_seats} onChange={(e) => setForm({ ...form, total_seats: e.target.value })} />
          </div>
          <div className="flex gap-2 pt-2">
            <button className="btn-secondary flex-1" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn-primary flex-1" onClick={save} disabled={saving || !form.movie_id || !form.theatre_name || !form.show_date}>
              {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Show'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
