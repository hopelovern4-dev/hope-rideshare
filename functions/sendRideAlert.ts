import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { type, pickup, dropoff, fare, petSurcharge, carSeatVerified } = body;

    if (!pickup || !dropoff || !fare) {
      return new Response(JSON.stringify({ error: 'Missing ride details' }), {
        status: 400,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      });
    }

    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER');
    const toNumber = Deno.env.get('DRIVER_PHONE_NUMBER');

    if (!accountSid || !authToken || !fromNumber || !toNumber) {
      return new Response(JSON.stringify({ error: 'Twilio credentials not configured' }), {
        status: 500,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      });
    }

    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' });
    const petNote = petSurcharge ? ' 🐾 Pet onboard.' : '';
    const carSeatNote = carSeatVerified ? ' 🧒 Car seat confirmed.' : ' ⚠️ No car seat declared!';

    let message = '';

    if (type === 'accepted') {
      message = `✅ RIDE ACCEPTED [${time}]
From: ${pickup}
To: ${dropoff}
Fare: $${parseFloat(fare).toFixed(2)}${petNote}${carSeatNote}

You're on your way! Drive safe. 💗`;
    } else if (type === 'arrived') {
      message = `🚗 YOUR HOPE DRIVER HAS ARRIVED! [${time}]

Your driver is outside and waiting.
You have 5 minutes to get to the car.

📍 Pickup: ${pickup}
💗 HOPE Rideshare — Chattanooga's trusted rides for women`;
    } else if (type === 'completed') {
      message = `🏁 RIDE COMPLETED [${time}]
From: ${pickup}
To: ${dropoff}
Fare collected: $${parseFloat(fare).toFixed(2)}

Thank you for riding with HOPE! 💗
Please pay via CashApp: $HopeCasey75`;
    } else if (type === 'cancelled') {
      message = `🛑 RIDE CANCELLED [${time}]
From: ${pickup}
To: ${dropoff}
Cancellation fee: $${parseFloat(fare).toFixed(2)}

Contact: hopechatt4women@zohomail.com`;
    } else {
      // Default: new ride request
      message = `🚗 HOPE RIDE REQUEST [${time}]
From: ${pickup}
To: ${dropoff}
Fare: $${parseFloat(fare).toFixed(2)}${petNote}${carSeatNote}

Switch to Driver tab to accept or decline.`;
    }

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const credentials = btoa(`${accountSid}:${authToken}`);

    const twilioRes = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: fromNumber,
        To: toNumber,
        Body: message,
      }),
    });

    const twilioData = await twilioRes.json();

    if (!twilioRes.ok) {
      return new Response(JSON.stringify({ error: twilioData.message || 'Twilio error' }), {
        status: 500,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, sid: twilioData.sid }), {
      status: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
    });
  }
});
