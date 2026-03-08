import { NextResponse } from 'next/server';

export async function POST(request) {
  const formData = await request.formData();

  return NextResponse.json({
    ok: true,
    received: true,
    messageSid: formData.get('MessageSid') || null,
    messageStatus: formData.get('MessageStatus') || null
  });
}
