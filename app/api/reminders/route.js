import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({
    ok: true,
    processed: 0,
    message: 'Reminder worker scaffold in place. Implement due reminder query + Twilio send flow.'
  });
}
