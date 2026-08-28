import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Ticket, Film, CalendarDays, CheckCircle2, Clock, AlertTriangle, ArrowRight, Inbox } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Booking, STATUS_COLORS, getSlaStatus } from '../types'
import { formatDate, timeUntil } from '../lib/format'
import PageHeader from '../components/PageHeader'
import Loading from '../components/Loading'

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ movies: 0, shows: 0, bookings: 0, confirmed: 0 })
  const [recent, setRecent] = useState<Booking[]>([])
  const [queueCounts, setQueueCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const [moviesR, showsR, bookingsR, confirmedR, recentR, queueR] = await Promise.all([
      supabase.from('movies').select('id', { count: 'exact', head: true }),
      supabase.from('shows').select('id', { count: 'exact', head: true }),
      supabase.from('bookings').select('id', { count: 'exact', head: true }),
      supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'Confirmed'),
      supabase
        .from('bookings')
        .select('*, show:shows(*), movie:movies(*)')
        .order('created_at', { ascending: false })
        .limit(6),
      supabase.from('bookings').select('work_queue, status').in('status', ['Initial', 'Availability', 'Approval', 'Booking Execution']),
    ])

    setStats({
      movies: moviesR.count || 0,
      shows: showsR.count || 0,
      bookings: bookingsR.count || 0,
      confirmed: confirmedR.count || 0,
    })
    setRecent(recentR.data || [])
    const qc: Record<string, number> = {}
    ;(queueR.data || []).forEach((b: any) => {
      if (b.work_queue) qc[b.work_queue] = (qc[b.work_queue] || 0) + 1
    })
    setQueueCounts(qc)
    setLoading(false)
  }

  if (loading) return <div className="p-8"><Loading /></div>

  const statCards = [
    { label: 'Movies', value: stats.movies, icon: Film, color: 'text-primary-600', bg: 'bg-primary-50' },
    { label: 'Shows', value: stats.shows, icon: CalendarDays, color: 'text-accent-600', bg: 'bg-accent-50' },
    { label: 'Bookings', value: stats.bookings, icon: Ticket, color: 'text-warning-600', bg: 'bg-warning-50' },
    { label: 'Confirmed', value: stats.confirmed, icon: CheckCircle2, color: 'text-success-600', bg: 'bg-success-50' },
  ]

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in">
      <PageHeader title="Dashboard" subtitle="Overview of bookings, shows, and work queues" />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((s) => (
          <div key={s.label} className="card p-5">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl ${s.bg} flex items-center justify-center`}>
                <s.icon className={`w-6 h-6 ${s.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                <p className="text-sm text-gray-500">{s.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Work Queues */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Inbox className="w-5 h-5 text-primary-600" />
            <h3 className="font-semibold text-gray-900">Premium ShowQueue</h3>
            <span className="badge bg-primary-100 text-primary-700 ml-auto">{queueCounts['Premium ShowQueue'] || 0}</span>
          </div>
          <p className="text-sm text-gray-500">Routed automatically from Premium show bookings.</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Inbox className="w-5 h-5 text-accent-600" />
            <h3 className="font-semibold text-gray-900">Standard ShowQueue</h3>
            <span className="badge bg-accent-100 text-accent-700 ml-auto">{queueCounts['Standard ShowQueue'] || 0}</span>
          </div>
          <p className="text-sm text-gray-500">Routed automatically from Standard show bookings.</p>
        </div>
      </div>

      {/* Recent bookings */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Recent Booking Requests</h3>
          <Link to="/bookings" className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
            View all <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-gray-500 py-8 text-center">No bookings yet.</p>
        ) : (
          <div className="space-y-3">
            {recent.map((b) => {
              const sla = getSlaStatus(b.sla_goal_at, b.sla_deadline_at, b.status)
              return (
                <Link
                  key={b.id}
                  to={`/bookings/${b.id}`}
                  className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-900">{b.customer_name}</span>
                      <span className="text-xs text-gray-400">{b.booking_ref}</span>
                    </div>
                    <p className="text-sm text-gray-500 truncate">
                      {b.movie?.title} - {b.show?.theatre_name} - {formatDate(b.show?.show_date || '')}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`badge ${STATUS_COLORS[b.status]}`}>{b.status}</span>
                    {sla !== 'done' && (
                      <p className={`text-xs mt-1 flex items-center gap-1 justify-end ${
                        sla === 'breached' ? 'text-error-600' : sla === 'goal' ? 'text-warning-600' : 'text-gray-400'
                      }`}>
                        {sla === 'breached' ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {timeUntil(b.sla_deadline_at)}
                      </p>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
