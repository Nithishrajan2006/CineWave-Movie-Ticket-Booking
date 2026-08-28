import { Routes, Route, NavLink } from 'react-router-dom'
import { Film, LayoutDashboard, Clapperboard, CalendarDays, Ticket, Bell } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import Movies from './pages/Movies'
import Shows from './pages/Shows'
import Bookings from './pages/Bookings'
import BookingDetail from './pages/BookingDetail'
import NewBooking from './pages/NewBooking'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/movies', label: 'Movies', icon: Film },
  { to: '/shows', label: 'Shows', icon: CalendarDays },
  { to: '/bookings', label: 'Bookings', icon: Ticket },
]

export default function App() {
  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col fixed inset-y-0 left-0 z-20">
        <div className="px-6 py-6 flex items-center gap-3 border-b border-gray-800">
          <div className="w-10 h-10 rounded-lg bg-primary-600 flex items-center justify-center">
            <Clapperboard className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-display font-bold text-lg leading-tight">CineWave</h1>
            <p className="text-xs text-gray-400">Booking Management</p>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-primary-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-gray-800">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Bell className="w-4 h-4" />
            <span>Staff Console</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-64 min-h-screen">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/movies" element={<Movies />} />
          <Route path="/shows" element={<Shows />} />
          <Route path="/bookings" element={<Bookings />} />
          <Route path="/bookings/new" element={<NewBooking />} />
          <Route path="/bookings/:id" element={<BookingDetail />} />
        </Routes>
      </main>
    </div>
  )
}
