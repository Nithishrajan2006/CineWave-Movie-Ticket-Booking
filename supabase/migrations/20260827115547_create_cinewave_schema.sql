/*
# CineWave Movie Ticket Booking Management Schema

## Overview
Creates the data model for a Movie Ticket Booking Management application that mirrors
a Pega-style case lifecycle: Initial -> Availability -> Approval -> Booking Execution.

## New Tables
1. `movies` - Catalog of movies available for booking.
   - id, title, genre, duration_minutes, rating, poster_url, description, created_at
2. `shows` - Scheduled showings of a movie at a theatre.
   - id, movie_id (FK), theatre_name, screen_name, show_type (Premium/Standard),
     show_date, show_time, total_seats, booked_seats, price_per_seat, created_at
3. `bookings` - A customer's ticket booking request (the "case").
   - id, booking_ref, customer_name, customer_email, customer_phone,
     show_id (FK), movie_id (FK), tickets, price_per_seat, total_cost,
     status (Initial/Availability/Approval/Booking Execution/Confirmed/Rejected/Cancelled),
     work_queue, assigned_to, sla_goal_at, sla_deadline_at, notes, created_at, updated_at
4. `booking_history` - Audit log of stage transitions for each booking.
   - id, booking_id (FK), stage, action, actor, note, created_at

## Calculated Properties
- `bookings.total_cost` = `tickets * price_per_seat` (enforced via trigger so it always stays in sync).

## SLA
- On insert, `sla_goal_at` = created_at + 1 day, `sla_deadline_at` = created_at + 2 days.

## Work Queue Routing
- Premium shows -> "Premium ShowQueue", Standard shows -> "Standard ShowQueue".
  Set on insert via trigger based on the related show's show_type.

## Security
- Single-tenant, no-auth app. RLS enabled on all tables with anon+authenticated CRUD
  because the data is intentionally shared among staff operators.
*/

-- ========== movies ==========
CREATE TABLE IF NOT EXISTS movies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  genre text,
  duration_minutes int,
  rating text,
  poster_url text,
  description text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE movies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_movies" ON movies;
CREATE POLICY "anon_select_movies" ON movies FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_movies" ON movies;
CREATE POLICY "anon_insert_movies" ON movies FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_movies" ON movies;
CREATE POLICY "anon_update_movies" ON movies FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_movies" ON movies;
CREATE POLICY "anon_delete_movies" ON movies FOR DELETE TO anon, authenticated USING (true);

-- ========== shows ==========
CREATE TABLE IF NOT EXISTS shows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  movie_id uuid NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  theatre_name text NOT NULL,
  screen_name text NOT NULL,
  show_type text NOT NULL DEFAULT 'Standard' CHECK (show_type IN ('Premium','Standard')),
  show_date date NOT NULL,
  show_time time NOT NULL,
  total_seats int NOT NULL DEFAULT 100,
  booked_seats int NOT NULL DEFAULT 0,
  price_per_seat numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE shows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_shows" ON shows;
CREATE POLICY "anon_select_shows" ON shows FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_shows" ON shows;
CREATE POLICY "anon_insert_shows" ON shows FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_shows" ON shows;
CREATE POLICY "anon_update_shows" ON shows FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_shows" ON shows;
CREATE POLICY "anon_delete_shows" ON shows FOR DELETE TO anon, authenticated USING (true);

-- ========== bookings ==========
CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_ref text UNIQUE NOT NULL DEFAULT ('CW-' || upper(substr(encode(gen_random_bytes(4),'hex'),1,6))),
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text,
  show_id uuid NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  movie_id uuid NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  tickets int NOT NULL DEFAULT 1 CHECK (tickets > 0),
  price_per_seat numeric(10,2) NOT NULL DEFAULT 0,
  total_cost numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Initial' CHECK (status IN ('Initial','Availability','Approval','Booking Execution','Confirmed','Rejected','Cancelled')),
  work_queue text,
  assigned_to text,
  sla_goal_at timestamptz,
  sla_deadline_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_bookings" ON bookings;
CREATE POLICY "anon_select_bookings" ON bookings FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_bookings" ON bookings;
CREATE POLICY "anon_insert_bookings" ON bookings FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_bookings" ON bookings;
CREATE POLICY "anon_update_bookings" ON bookings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_bookings" ON bookings;
CREATE POLICY "anon_delete_bookings" ON bookings FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_work_queue ON bookings(work_queue);
CREATE INDEX IF NOT EXISTS idx_bookings_show_id ON bookings(show_id);
CREATE INDEX IF NOT EXISTS idx_shows_movie_id ON shows(movie_id);

-- ========== booking_history ==========
CREATE TABLE IF NOT EXISTS booking_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  stage text NOT NULL,
  action text NOT NULL,
  actor text NOT NULL DEFAULT 'System',
  note text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE booking_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_history" ON booking_history;
CREATE POLICY "anon_select_history" ON booking_history FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_history" ON booking_history;
CREATE POLICY "anon_insert_history" ON booking_history FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_history" ON booking_history;
CREATE POLICY "anon_delete_history" ON booking_history FOR DELETE TO anon, authenticated USING (true);

-- ========== Trigger: set total_cost, SLA, work_queue on insert ==========
CREATE OR REPLACE FUNCTION set_booking_defaults()
RETURNS trigger AS $$
DECLARE
  v_show_type text;
BEGIN
  SELECT show_type INTO v_show_type FROM shows WHERE id = NEW.show_id;

  -- calculated property: total_cost = tickets * price_per_seat
  NEW.total_cost := NEW.tickets * NEW.price_per_seat;

  -- SLA: goal 1 day, deadline 2 days from creation
  NEW.sla_goal_at := COALESCE(NEW.created_at, now()) + interval '1 day';
  NEW.sla_deadline_at := COALESCE(NEW.created_at, now()) + interval '2 days';

  -- work queue routing based on show type
  IF v_show_type = 'Premium' THEN
    NEW.work_queue := 'Premium ShowQueue';
  ELSE
    NEW.work_queue := 'Standard ShowQueue';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_booking_defaults ON bookings;
CREATE TRIGGER trg_booking_defaults
BEFORE INSERT ON bookings
FOR EACH ROW EXECUTE FUNCTION set_booking_defaults();

-- Keep total_cost in sync on update of tickets/price
CREATE OR REPLACE FUNCTION sync_booking_total()
RETURNS trigger AS $$
BEGIN
  NEW.total_cost := NEW.tickets * NEW.price_per_seat;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_booking_total ON bookings;
CREATE TRIGGER trg_booking_total
BEFORE UPDATE OF tickets, price_per_seat ON bookings
FOR EACH ROW EXECUTE FUNCTION sync_booking_total();

-- Auto log stage transitions
CREATE OR REPLACE FUNCTION log_booking_change()
RETURNS trigger AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO booking_history (booking_id, stage, action, actor, note)
    VALUES (NEW.id, NEW.status, 'Status changed to ' || NEW.status, COALESCE(NEW.assigned_to,'System'), NEW.notes);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_booking_log ON bookings;
CREATE TRIGGER trg_booking_log
AFTER UPDATE OF status ON bookings
FOR EACH ROW EXECUTE FUNCTION log_booking_change();
