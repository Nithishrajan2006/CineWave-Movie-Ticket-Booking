import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Ticket, Plus, Search, Inbox, AlertTriangle, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Booking, BookingStatus, STATUS_COLORS, getSlaStatus } from '../types'
import { formatCurrency, formatDate, timeUntil } from '../lib/format'
import PageHeader from '../components/PageHeader'
import Loading, { EmptyState } from '../components/Loading'

export default function Bookings() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | BookingStatus | 'active'>('all')
  const [queueFilter, setQueueFilter] = useState<'all' | 'Premium ShowQueue' | 'Standard ShowQueue'>('all')
  const [search, setSearch] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('bookings')
      .select('*, show:shows(*), movie:movies(*)')
      .order('created_at', { ascending: false })
    setBookings(data || [])
    setLoading(false)
  }

  const activeStatuses: BookingStatus[] = ['Initial', 'Availability', 'Approval', 'Booking Execution']

  let filtered = bookings
  if (filter === 'active') {
    filtered = filtered.filter((b) => activeStatuses.includes(b.status))
  } else if (filter !== 'all') {
    filtered = filtered.filter((b) => b.status === filter)
  }
  if (queueFilter !== 'all') {
    filtered = filtered.filter((b) => b.work_queue === queueFilter)
  }
  if (search.trim()) {
    const q = search.toLowerCase()
    filtered = filtered.filter((b) =>
      b.customer_name.toLowerCase().includes(q) ||
      b.booking_ref.toLowerCase().includes(q) ||
      b.customer_email.toLowerCase().includes(q) ||
      (b.movie?.title || '').toLowerCase().includes(q)
    )
  }

  const statusFilters: ('all' | 'active' | BookingStatus)[] = ['all', 'active', 'Initial', 'Availability', 'Approval', 'Booking Execution', 'Confirmed', 'Rejected', 'Cancelled']

  if (loading) return <div className="p-8"><Loading /></div>

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in">
      <PageHeader
        title="Bookings"
        subtitle="Track and process ticket booking requests"
        actions={<Link to="/bookings/new" className="btn-primary"><Plus className="w-4 h-4" /> New Booking</Link>}
      />

      {/* Filters */}
      <div className="card p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="input pl-9"
              placeholder="Search by name, ref, email, movie..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="input max-w-[160px]" value={queueFilter} onChange={(e) => setQueueFilter(e.target.value as any)}>
            <option value="all">All Queues</option>
            <option value="Premium ShowQueue">Premium Queue</option>
            <option value="Standard ShowQueue">Standard Queue</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {statusFilters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === f ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f === 'all' ? 'All' : f === 'active' ? 'Active' : f}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="card p-8">
          <EmptyState icon={Ticket} title="No bookings found" subtitle="Try adjusting filters or create a new booking." />
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((b) => {
            const sla = getSlaStatus(b.sla_goal_at, b.sla_deadline_at, b.status)
            return (
              <Link
                key={b.id}
                to={`/bookings/${b.id}`}
                className="card p-4 hover:shadow-md transition-shadow flex items-center gap-4"
              >
                <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center shrink-0">
                  <Ticket className="w-5 h-5 text-primary-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">{b.customer_name}</span>
                    <span className="text-xs text-gray-400 font-mono">{b.booking_ref}</span>
                  </div>
                  <p className="text-sm text-gray-500 truncate">
                    {b.movie?.title} - {b.tickets} ticket(s) - {formatCurrency(b.total_cost)}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {b.show?.theatre_name} - {formatDate(b.show?.show_date || '')}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className={`badge ${STATUS_COLORS[b.status]}`}>{b.status}</span>
                  {b.work_queue && (
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Inbox className="w-3 h-3" /> {b.work_queue}
                    </span>
                  )}
                  {sla !== 'done' && (
                    <span className={`text-xs flex items-center gap-1 ${
                      sla === 'breached' ? 'text-error-600' : sla === 'goal' ? 'text-warning-600' : 'text-gray-400'
                    }`}>
                      {sla === 'breached' ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      {timeUntil(b.sla_deadline_at)}
                    </span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
