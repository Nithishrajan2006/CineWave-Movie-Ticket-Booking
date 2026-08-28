import { createClient } from "npm:@supabase/supabase-js@2.45.0"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    const { booking_id } = await req.json()

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    )

    const { data: booking, error } = await supabase
      .from("bookings")
      .select("*, show:shows(*), movie:movies(*)")
      .eq("id", booking_id)
      .maybeSingle()

    if (error || !booking) {
      return new Response(
        JSON.stringify({ error: "Booking not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    // Build the confirmation email content
    const emailSubject = `CineWave Booking Confirmed - ${booking.booking_ref}`
    const emailBody = `
Dear ${booking.customer_name},

Your movie ticket booking has been confirmed!

Booking Reference: ${booking.booking_ref}
Movie: ${booking.movie?.title}
Theatre: ${booking.show?.theatre_name} (${booking.show?.screen_name})
Date: ${booking.show?.show_date}
Time: ${booking.show?.show_time}
Tickets: ${booking.tickets}
Total Cost: $${booking.total_cost}

Please present your booking reference at the theatre to collect your tickets.

Thank you for choosing CineWave Entertainment!

Best regards,
CineWave Booking Team
`

    // Log the email as a history entry (in production this would call an email provider)
    await supabase.from("booking_history").insert({
      booking_id: booking.id,
      stage: booking.status,
      action: `Confirmation email sent to ${booking.customer_email}`,
      actor: "System",
      note: emailSubject,
    })

    return new Response(
      JSON.stringify({
        success: true,
        to: booking.customer_email,
        subject: emailSubject,
        body: emailBody,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  }
})
