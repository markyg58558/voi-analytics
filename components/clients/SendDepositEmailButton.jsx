'use client';

import { useState } from 'react';

export default function SendDepositEmailButton({ appointmentId, disabled = false, compact = false }) {
  const [state, setState] = useState({ sending: false, message: '', error: '' });

  async function handleSend() {
    if (!appointmentId || disabled) return;
    setState({ sending: true, message: '', error: '' });
    try {
      const res = await fetch(`/api/appointments/${appointmentId}/send-deposit-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data?.error || `Failed to send deposit email (${res.status})`);
      }
      setState({
        sending: false,
        message: data?.testOverrideApplied ? `Sent to test override (${data.sentTo})` : `Sent to ${data.sentTo}`,
        error: ''
      });
    } catch (error) {
      setState({
        sending: false,
        message: '',
        error: error instanceof Error ? error.message : 'Failed to send deposit email'
      });
    }
  }

  return (
    <div style={{ display: 'grid', gap: 4, justifyItems: compact ? 'start' : 'end' }}>
      <button
        type="button"
        onClick={handleSend}
        disabled={disabled || state.sending}
        style={{
          border: '1px solid #7dd3fc',
          background: 'rgba(125,211,252,0.1)',
          color: 'inherit',
          borderRadius: 999,
          padding: compact ? '0.25rem 0.55rem' : '0.35rem 0.7rem',
          cursor: state.sending ? 'progress' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          fontSize: compact ? 12 : 13
        }}
      >
        {state.sending ? 'Sending...' : 'Send Deposit Email'}
      </button>
      {state.message ? <span style={{ fontSize: 11, color: '#9de6c1' }}>{state.message}</span> : null}
      {state.error ? <span style={{ fontSize: 11, color: '#ffb4b4' }}>{state.error}</span> : null}
    </div>
  );
}

