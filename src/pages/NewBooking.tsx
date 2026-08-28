import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Ticket } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Show } from '../types'
import { formatCurrency, formatDate, formatTime } from '../lib/format'
import PageHeader from '../components/PageHeader'
import Loading from '../components/Loading'

export default function NewBooking() {
  const navigate = useNavigate()
  const [shows, setShows] = useState<Show[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    customer_name: '', customer_email: '', customer_phone: '',
    show_id: '', tickets: '1',
  })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: s } = await supabase
      .from('shows')
      .select('*, movie:movies(*)')
      .gte('show_date', new Date().toISOString().split('T')[0])
      .order('show_date')
    setShows(s || [])
    setLoading(false)
  }

  const selectedShow = shows.find((s) => s.id === form.show_id)
  const available = selectedShow ? selectedShow.total_seats - selectedShow.booked_seats : 0
  const tickets = parseInt(form.tickets) || 0
  const totalCost = selectedShow ? tickets * selectedShow.price_per_seat : 0

  async function submit() {
    setError('')
    if (!form.customer_name.trim() || !form.customer_email.trim() || !form.show_id || tickets < 1) {
      setError('Please fill in all required fields.')
      return
    }
    if (tickets > available) {
      setError(`Only ${available} seats available for this show.`)
      return
    }
    setSaving(true)
    const { data, error: insErr } = await supabase
      .from('bookings')
      .insert({
        customer_name: form.customer_name.trim(),
        customer_email: form.customer_email.trim(),
        customer_phone: form.customer_phone.trim() || null,
        show_id: form.show_id,
        movie_id: selectedShow!.movie_id,
        tickets,
        price_per_seat: selectedShow!.price_per_seat,
        status: 'Initial',
      })
      .select()
      .single()

    if (insErr) {
      setError(insErr.message)
      setSaving(false)
      return
    }

    // Log initial history
    await supabase.from('booking_history').insert({
      booking_id: data.id, stage: 'Initial', action: 'Booking request created', actor: 'Customer',
    })

    setSaving(false)
    navigate(`/bookings/${data.id}`)
  }

  if (loading) return <div className="p-8"><Loading /></div>

  return (
    <div className="p-8 max-w-3xl mx-auto animate-fade-in">
      <button onClick={() => navigate('/bookings')} className="btn-ghost mb-4 -ml-2">
        <ArrowLeft className="w-4 h-4" /> Back to Bookings
      </button>
      <PageHeader title="New Booking Request" subtitle="Submit a customer's movie ticket booking request" />

      <div className="card p-6 space-y-5">
        {/* Customer info */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Customer Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Customer Name *</label>
              <input className="input" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} placeholder="John Smith" />
            </div>
            <div>
              <label className="label">Email *</label>
              <input type="email" className="input" value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} placeholder="john@email.com" />
            </div>
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} placeholder="(555) 123-4567" />
          </div>
        </div>

        {/* Show selection */}
        <div className="space-y-4 pt-4 border-t border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Show Selection</h3>
          {shows.length === 0 ? (
            <p className="text-sm text-gray-500">No upcoming shows available. Add shows first.</p>
          ) : (
            <>
              <div>
                <label className="label">Select Show *</label>
                <select className="input" value={form.show_id} onChange={(e) => setForm({ ...form, show_id: e.target.value })}>
                  <option value="">Choose a show...</option>
                  {shows.map((s) => (
                    <option key={s.id} value={s.id} disabled={s.total_seats - s.booked_seats <= 0}>
                      {s.movie?.title} - {s.theatre_name} ({s.screen_name}) - {formatDate(s.show_date)} {formatTime(s.show_time)} - {formatCurrency(s.price_per_seat)} ({s.total_seats - s.booked_seats} left)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Number of Tickets *</label>
                <input type="number" min="1" className="input max-w-[120px]" value={form.tickets} onChange={(e) => setForm({ ...form, tickets: e.target.value })} />
              </div>
            </>
          )}
        </div>

        {/* Total cost summary */}
        {selectedShow && (
          <div className="bg-primary-50 rounded-xl p-4 border border-primary-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-700">
                <Ticket className="w-5 h-5 text-primary-600" />
                <span className="text-sm font-medium">Total Cost</span>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">{tickets} x {formatCurrency(selectedShow.price_per_seat)}</p>
                <p className="text-2xl font-bold text-primary-700">{formatCurrency(totalCost)}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-primary-100 text-xs text-gray-600">
              <span>Available: {available} seats</span>
              <span>Type: {selectedShow.show_type}</span>
              <span>Queue: {selectedShow.show_type === 'Premium' ? 'Premium ShowQueue' : 'Standard ShowQueue'}</span>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-error-50 text-error-700 text-sm rounded-lg p-3 border border-error-100">
            {error}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button className="btn-secondary flex-1" onClick={() => navigate('/bookings')}>Cancel</button>
          <button className="btn-primary flex-1" onClick={submit} disabled={saving || !form.show_id || tickets < 1}>
            {saving ? 'Creating...' : 'Create Booking Request'}
          </button>
        </div>
      </div>
    </div>
  )
}
