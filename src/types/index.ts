export type BookingStatus =
  | 'Initial'
  | 'Availability'
  | 'Approval'
  | 'Booking Execution'
  | 'Confirmed'
  | 'Rejected'
  | 'Cancelled'

export interface Movie {
  id: string
  title: string
  genre: string | null
  duration_minutes: number | null
  rating: string | null
  poster_url: string | null
  description: string | null
  created_at: string
}

export interface Show {
  id: string
  movie_id: string
  theatre_name: string
  screen_name: string
  show_type: 'Premium' | 'Standard'
  show_date: string
  show_time: string
  total_seats: number
  booked_seats: number
  price_per_seat: number
  created_at: string
  movie?: Movie
}

export interface Booking {
  id: string
  booking_ref: string
  customer_name: string
  customer_email: string
  customer_phone: string | null
  show_id: string
  movie_id: string
  tickets: number
  price_per_seat: number
  total_cost: number
  status: BookingStatus
  work_queue: string | null
  assigned_to: string | null
  sla_goal_at: string | null
  sla_deadline_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
  show?: Show
  movie?: Movie
}

export interface BookingHistory {
  id: string
  booking_id: string
  stage: string
  action: string
  actor: string
  note: string | null
  created_at: string
}

export const STAGES: BookingStatus[] = [
  'Initial',
  'Availability',
  'Approval',
  'Booking Execution',
  'Confirmed',
]

export const STATUS_COLORS: Record<BookingStatus, string> = {
  'Initial': 'bg-gray-100 text-gray-700',
  'Availability': 'bg-accent-100 text-accent-700',
  'Approval': 'bg-warning-100 text-warning-700',
  'Booking Execution': 'bg-primary-100 text-primary-700',
  'Confirmed': 'bg-success-100 text-success-700',
  'Rejected': 'bg-error-100 text-error-700',
  'Cancelled': 'bg-gray-200 text-gray-600',
}

export function getSlaStatus(goal: string | null, deadline: string | null, status: BookingStatus): 'ok' | 'goal' | 'deadline' | 'breached' | 'done' {
  if (status === 'Confirmed' || status === 'Rejected' || status === 'Cancelled') return 'done'
  const now = new Date()
  if (deadline && now > new Date(deadline)) return 'breached'
  if (goal && now > new Date(goal)) return 'goal'
  return 'ok'
}
