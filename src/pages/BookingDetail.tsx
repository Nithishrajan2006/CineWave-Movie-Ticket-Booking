import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Ticket, Mail, Phone, Calendar, Clock, MapPin, Users,
  CheckCircle2, XCircle, AlertTriangle, Inbox, History, Send, ChevronRight,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Booking, BookingHistory, BookingStatus, STAGES, STATUS_COLORS, getSlaStatus } from '../types'
import { formatCurrency, formatDateTime, formatDate, formatTime, timeUntil } from '../lib/format'
import PageHeader from '../components/PageHeader'
import Loading from '../components/Loading'
import Modal from '../components/Modal'

export default function BookingDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [booking, setBooking] = useState<Booking | null>(null)
  const [history, setHistory] = useState<BookingHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [sending, setSending] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => { load() }, [id])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('bookings')
      .select('*, show:shows(*), movie:movies(*)')
      .eq('id', id)
      .maybeSingle()
    setBooking(data)
    const { data: hist } = await supabase
      .from('booking_history')
      .select('*')
      .eq('booking_id', id)
      .order('created_at', { ascending: true })
    setHistory(hist || [])
    setLoading(false)
  }

  async function advanceStatus(newStatus: BookingStatus, note?: string) {
    if (!booking) return
    setActionLoading(true)
    const updates: any = { status: newStatus }
    if (note) updates.notes = note
    if (newStatus === 'Availability') updates.assigned_to = 'Availability Desk'
    if (newStatus === 'Approval') updates.assigned_to = 'Booking Manager'
    if (newStatus === 'Booking Execution') updates.assigned_to = 'Booking Execution'
    if (newStatus === 'Confirmed') updates.assigned_to = 'System'

    await supabase.from('bookings').update(updates).eq('id', booking.id)

    // When confirming: increment booked seats and send email
    if (newStatus === 'Confirmed') {
      const newBooked = (booking.show?.booked_seats || 0) + booking.tickets
      await supabase.from('shows').update({ booked_seats: newBooked }).eq('id', booking.show_id)
    }

    setActionLoading(false)
    load()
  }

  async function reject() {
    if (!rejectReason.trim()) return
    setActionLoading(true)
    await supabase.from('bookings').update({ status: 'Rejected', notes: rejectReason }).eq('id', booking!.id)
    setActionLoading(false)
    setRejectOpen(false)
    setRejectReason('')
    load()
  }

  async function sendConfirmationEmail() {
    if (!booking) return
    setSending(true)
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-booking-email`
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ booking_id: booking.id }),
      })
      if (res.ok) {
        setEmailSent(true)
        await supabase.from('booking_history').insert({
          booking_id: booking.id, stage: booking.status, action: 'Confirmation email sent to customer', actor: 'System',
        })
        load()
      }
    } catch (e) {
      // ignore
    }
    setSending(false)
  }

  if (loading) return <div className="p-8"><Loading /></div>
  if (!booking) return <div className="p-8"><p className="text-gray-500">Booking not found.</p></div>

  const sla = getSlaStatus(booking.sla_goal_at, booking.sla_deadline_at, booking.status)
  const currentStageIdx = STAGES.indexOf(booking.status as any)
  const available = (booking.show?.total_seats || 0) - (booking.show?.booked_seats || 0)
  const canConfirm = booking.tickets <= available + (booking.status === 'Booking Execution' ? 0 : 0)
  const isTerminal = ['Confirmed', 'Rejected', 'Cancelled'].includes(booking.status)

  return (
    <div className="p-8 max-w-6xl mx-auto animate-fade-in">
      <button onClick={() => navigate('/bookings')} className="btn-ghost mb-4 -ml-2">
        <ArrowLeft className="w-4 h-4" /> Back to Bookings
      </button>

      <PageHeader
        title={`${booking.customer_name}`}
        subtitle={`${booking.booking_ref} - Created ${formatDateTime(booking.created_at)}`}
        actions={
          <span className={`badge ${STATUS_COLORS[booking.status]} text-sm px-3 py-1.5`}>
            {booking.status}
          </span>
        }
      />

      {/* Lifecycle stepper */}
      <div className="card p-6 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Case Lifecycle</h3>
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {STAGES.map((stage, idx) => {
            const done = idx < currentStageIdx
            const current = idx === currentStageIdx
            return (
              <div key={stage} className="flex items-center gap-1 shrink-0">
                <div className="flex flex-col items-center gap-1.5 min-w-[100px]">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                    done ? 'bg-success-500 text-white' :
                    current ? 'bg-primary-600 text-white ring-4 ring-primary-100' :
                    'bg-gray-100 text-gray-400'
                  }`}>
                    {done ? <CheckCircle2 className="w-5 h-5" /> : idx + 1}
                  </div>
                  <span className={`text-xs font-medium text-center ${current ? 'text-primary-700' : done ? 'text-gray-700' : 'text-gray-400'}`}>
                    {stage}
                  </span>
                </div>
                {idx < STAGES.length - 1 && (
                  <ChevronRight className={`w-5 h-5 ${done ? 'text-success-500' : 'text-gray-300'}`} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer + Show details */}
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Booking Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                  <Ticket className="w-4 h-4 text-gray-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Customer</p>
                  <p className="text-sm font-medium text-gray-900">{booking.customer_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                  <Mail className="w-4 h-4 text-gray-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Email</p>
                  <p className="text-sm font-medium text-gray-900">{booking.customer_email}</p>
                </div>
              </div>
              {booking.customer_phone && (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                    <Phone className="w-4 h-4 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Phone</p>
                    <p className="text-sm font-medium text-gray-900">{booking.customer_phone}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                  <Users className="w-4 h-4 text-gray-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Tickets</p>
                  <p className="text-sm font-medium text-gray-900">{booking.tickets}</p>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-5 border-t border-gray-100">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Show Information</h4>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <p className="font-semibold text-gray-900">{booking.movie?.title}</p>
                <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                  <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {formatDate(booking.show?.show_date || '')}</span>
                  <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {formatTime(booking.show?.show_time || '')}</span>
                  <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {booking.show?.theatre_name} ({booking.show?.screen_name})</span>
                </div>
                <div className="flex flex-wrap gap-3 pt-2">
                  <span className={`badge ${booking.show?.show_type === 'Premium' ? 'bg-primary-100 text-primary-700' : 'bg-accent-100 text-accent-700'}`}>
                    {booking.show?.show_type}
                  </span>
                  <span className="badge bg-gray-100 text-gray-600">{available} seats available</span>
                  {booking.work_queue && (
                    <span className="badge bg-gray-100 text-gray-600 flex items-center gap-1">
                      <Inbox className="w-3 h-3" /> {booking.work_queue}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Total cost */}
            <div className="mt-5 pt-5 border-t border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400">Total Cost (calculated)</p>
                <p className="text-xs text-gray-400">{booking.tickets} x {formatCurrency(booking.price_per_seat)}</p>
              </div>
              <p className="text-3xl font-bold text-primary-700">{formatCurrency(booking.total_cost)}</p>
            </div>
          </div>

          {/* History */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <History className="w-5 h-5 text-gray-500" />
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Case History</h3>
            </div>
            {history.length === 0 ? (
              <p className="text-sm text-gray-500">No history recorded.</p>
            ) : (
              <div className="space-y-3">
                {history.map((h) => (
                  <div key={h.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-primary-500 mt-1.5 shrink-0" />
                      {h !== history[history.length - 1] && <div className="w-0.5 flex-1 bg-gray-200 mt-1" />}
                    </div>
                    <div className="pb-3">
                      <p className="text-sm font-medium text-gray-900">{h.action}</p>
                      <p className="text-xs text-gray-400">{formatDateTime(h.created_at)} - by {h.actor}</p>
                      {h.note && <p className="text-xs text-gray-500 mt-1">{h.note}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: SLA + Actions */}
        <div className="space-y-6">
          {/* SLA card */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">SLA Tracking</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Goal (1 day)</span>
                <span className="text-sm font-medium text-gray-900">{booking.sla_goal_at ? formatDateTime(booking.sla_goal_at) : '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Deadline (2 days)</span>
                <span className="text-sm font-medium text-gray-900">{booking.sla_deadline_at ? formatDateTime(booking.sla_deadline_at) : '—'}</span>
              </div>
              <div className={`rounded-lg p-3 text-sm font-medium flex items-center gap-2 ${
                sla === 'breached' ? 'bg-error-50 text-error-700' :
                sla === 'goal' ? 'bg-warning-50 text-warning-700' :
                sla === 'done' ? 'bg-gray-50 text-gray-600' :
                'bg-success-50 text-success-700'
              }`}>
                {sla === 'breached' ? <AlertTriangle className="w-4 h-4" /> : sla === 'done' ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                {sla === 'breached' ? `Deadline breached - ${timeUntil(booking.sla_deadline_at)}` :
                 sla === 'goal' ? `Past goal - ${timeUntil(booking.sla_deadline_at)}` :
                 sla === 'done' ? 'Completed' :
                 `On track - ${timeUntil(booking.sla_deadline_at)}`}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Actions</h3>
            {isTerminal ? (
              <div className="space-y-3">
                {booking.status === 'Confirmed' && (
                  <>
                    {emailSent ? (
                      <div className="bg-success-50 text-success-700 text-sm rounded-lg p-3 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" /> Confirmation email sent!
                      </div>
                    ) : (
                      <button className="btn-primary w-full" onClick={sendConfirmationEmail} disabled={sending}>
                        <Send className="w-4 h-4" /> {sending ? 'Sending...' : 'Send Confirmation Email'}
                      </button>
                    )}
                  </>
                )}
                {booking.status === 'Rejected' && (
                  <div className="bg-error-50 text-error-700 text-sm rounded-lg p-3 flex items-center gap-2">
                    <XCircle className="w-4 h-4" /> This booking was rejected.
                  </div>
                )}
                <button className="btn-secondary w-full" onClick={() => navigate('/bookings')}>
                  Back to Bookings
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Stage-specific actions */}
                {booking.status === 'Initial' && (
                  <button className="btn-primary w-full" onClick={() => advanceStatus('Availability')} disabled={actionLoading}>
                    Check Availability <ChevronRight className="w-4 h-4" />
                  </button>
                )}
                {booking.status === 'Availability' && (
                  <>
                    {canConfirm ? (
                      <button className="btn-primary w-full" onClick={() => advanceStatus('Approval')} disabled={actionLoading}>
                        Send for Approval <ChevronRight className="w-4 h-4" />
                      </button>
                    ) : (
                      <div className="bg-error-50 text-error-700 text-sm rounded-lg p-3">
                        Not enough seats available ({available} left, {booking.tickets} requested).
                      </div>
                    )}
                  </>
                )}
                {booking.status === 'Approval' && (
                  <>
                    <button className="btn-success w-full" onClick={() => advanceStatus('Booking Execution')} disabled={actionLoading}>
                      Approve & Execute <CheckCircle2 className="w-4 h-4" />
                    </button>
                    <button className="btn-danger w-full" onClick={() => setRejectOpen(true)} disabled={actionLoading}>
                      <XCircle className="w-4 h-4" /> Reject
                    </button>
                  </>
                )}
                {booking.status === 'Booking Execution' && (
                  <button className="btn-success w-full" onClick={() => advanceStatus('Confirmed')} disabled={actionLoading}>
                    Confirm Booking <CheckCircle2 className="w-4 h-4" />
                  </button>
                )}
                <button className="btn-ghost w-full text-error-600 hover:bg-error-50" onClick={async () => {
                  if (!confirm('Cancel this booking?')) return
                  await supabase.from('bookings').update({ status: 'Cancelled' }).eq('id', booking.id)
                  load()
                }}>
                  Cancel Booking
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reject modal */}
      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} title="Reject Booking" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Provide a reason for rejecting this booking request.</p>
          <textarea className="input min-h-[100px]" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason for rejection..." />
          <div className="flex gap-2">
            <button className="btn-secondary flex-1" onClick={() => setRejectOpen(false)}>Cancel</button>
            <button className="btn-danger flex-1" onClick={reject} disabled={!rejectReason.trim()}>Reject Booking</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
