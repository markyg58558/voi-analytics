'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import luxon3Plugin from '@fullcalendar/luxon3';
import { DateTime } from 'luxon';

const APPOINTMENT_STATUSES = ['requested', 'pending_deposit', 'confirmed', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show'];
const APPOINTMENT_SOURCES = ['walk_in', 'phone_call', 'instagram_dm', 'email_elementor', 'manual'];
const BOARD_START_HOUR = 8;
const BOARD_END_HOUR = 22;
const BOARD_BUSINESS_START_HOUR = 10;
const BOARD_BUSINESS_END_HOUR = 18;
const BOARD_HOUR_HEIGHT = 56;
const BOARD_SNAP_MINUTES = 15;
const BOARD_TIME_GUTTER_WIDTH = 86;
const APPOINTMENT_DURATION_OPTIONS = Array.from({ length: 32 }, (_, idx) => (idx + 1) * 15);
const BOARD_UNAVAILABLE_OVERLAY =
  'repeating-linear-gradient(135deg, rgba(18,18,20,0.72), rgba(18,18,20,0.72) 8px, rgba(255,255,255,0.055) 8px, rgba(255,255,255,0.055) 16px)';

function formatDurationOptionLabel(minutes) {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (!hrs) return `${mins} min`;
  if (!mins) return hrs === 1 ? '1 hr' : `${hrs} hrs`;
  return `${hrs}h ${mins}m`;
}

function buildDetailsDraftFromEvent(event) {
  if (!event) return null;
  return {
    artistId: event.extendedProps?.artistId || '',
    status: event.extendedProps?.status || 'requested',
    source: event.extendedProps?.source || 'manual',
    depositRequiredAmount: String(event.extendedProps?.depositRequiredAmount ?? 0),
    quotedTotalAmount: event.extendedProps?.quotedTotalAmount == null ? '' : String(event.extendedProps.quotedTotalAmount),
    designBrief: event.extendedProps?.designBrief || '',
    internalNotes: event.extendedProps?.internalNotes || '',
    changeNote: ''
  };
}

function formatInTimezone(isoString, timezone) {
  try {
    return new Intl.DateTimeFormat('en-AU', {
      timeZone: timezone,
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(isoString));
  } catch {
    return isoString;
  }
}

function statusColor(status) {
  switch (status) {
    case 'pending_deposit':
      return '#f7b955';
    case 'confirmed':
      return '#6bd39d';
    case 'cancelled':
    case 'no_show':
      return '#ef8f8f';
    default:
      return '#9bb0ff';
  }
}

function getDepositPaymentState(props) {
  const required = Number(props?.depositRequiredAmount || 0);
  const paid = Number(props?.depositPaidAmount || 0);
  const hasCheckoutSession = Boolean(props?.stripeCheckoutSessionId);

  if (required <= 0) return { label: 'No Deposit', tone: '#8b93a7' };
  if (paid >= required) return { label: 'Paid', tone: '#6bd39d' };
  if (hasCheckoutSession) return { label: 'Link Sent', tone: '#7dd3fc' };
  return { label: 'Due', tone: '#f7b955' };
}

function getStatusDisplayLabel(status) {
  if (status === 'checked_in') return 'arrived';
  return status || 'requested';
}

function shouldStripeAppointmentCard(props) {
  const status = props?.status;
  if (status === 'cancelled' || status === 'no_show') return true;
  if (status === 'requested' || status === 'pending_deposit') return true;
  return false;
}

function getAppointmentIconBadges(props) {
  const badges = [];
  const paymentState = getDepositPaymentState(props);
  if (paymentState.label === 'Due') {
    badges.push({ key: 'deposit_due', icon: '$', tone: paymentState.tone, title: 'Deposit due' });
  } else if (paymentState.label === 'Link Sent') {
    badges.push({ key: 'deposit_link', icon: '↗', tone: paymentState.tone, title: 'Deposit link generated' });
  } else if (paymentState.label === 'Paid') {
    badges.push({ key: 'deposit_paid', icon: '✓', tone: paymentState.tone, title: 'Deposit paid' });
  }
  if (props?.depositEmailSentAt) {
    badges.push({ key: 'deposit_email', icon: '✉', tone: '#7dd3fc', title: 'Deposit email sent' });
  }
  if (props?.reminder72hEmailSentAt) {
    badges.push({ key: 'reminder_72h', icon: '🔔', tone: '#c4b5fd', title: '72h reminder sent' });
  }
  if (props?.status === 'checked_in' || props?.arrivedAt) {
    badges.push({ key: 'arrived', icon: '•', tone: '#f7b955', title: 'Client arrived' });
  }
  if (props?.status === 'completed' && props?.paidInFullAt) {
    badges.push({ key: 'paid_in_full', icon: '$', tone: '#6bd39d', title: 'Paid in full / checked out' });
  }
  return badges;
}

function artistInitials(name = '') {
  const parts = String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return 'A';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
}

function artistAccent(name = '') {
  const palette = ['#2ec4b6', '#ff6047', '#f7b955', '#7dd3fc', '#e879f9', '#8b5cf6', '#34d399'];
  const hash = [...String(name)].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return palette[hash % palette.length];
}

function toStudioDateKey(isoString, timezone) {
  return DateTime.fromISO(isoString, { zone: 'utc' }).setZone(timezone).toISODate();
}

function formatStudioDateLabel(dateKey, timezone) {
  try {
    return DateTime.fromISO(dateKey, { zone: timezone }).toFormat('cccc, d LLLL yyyy');
  } catch {
    return dateKey;
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function parseLocalTimeToMinutes(localTime) {
  if (!localTime) return null;
  const match = String(localTime).match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function minutesFromBoardStart(isoString, timezone) {
  const dt = DateTime.fromISO(isoString, { zone: 'utc' }).setZone(timezone);
  return dt.hour * 60 + dt.minute - BOARD_START_HOUR * 60;
}

function eventIntersectsBoardDay(event, boardDate, timezone) {
  const dayStart = DateTime.fromISO(boardDate, { zone: timezone }).startOf('day');
  const dayEnd = dayStart.plus({ days: 1 });
  const start = DateTime.fromISO(event.start, { zone: 'utc' }).setZone(timezone);
  const end = DateTime.fromISO(event.end, { zone: 'utc' }).setZone(timezone);
  return start < dayEnd && end > dayStart;
}

function getBoardCardStyle(event, boardDate, timezone) {
  const dayStart = DateTime.fromISO(boardDate, { zone: timezone }).startOf('day');
  const dayEnd = dayStart.plus({ days: 1 });
  const eventStart = DateTime.fromISO(event.start, { zone: 'utc' }).setZone(timezone);
  const eventEnd = DateTime.fromISO(event.end, { zone: 'utc' }).setZone(timezone);
  const clippedStart = eventStart < dayStart ? dayStart : eventStart;
  const clippedEnd = eventEnd > dayEnd ? dayEnd : eventEnd;

  const startMinutes = clippedStart.hour * 60 + clippedStart.minute - BOARD_START_HOUR * 60;
  const endMinutes = clippedEnd.hour * 60 + clippedEnd.minute - BOARD_START_HOUR * 60;
  const totalMinutes = (BOARD_END_HOUR - BOARD_START_HOUR) * 60;
  const topMinutes = clamp(startMinutes, 0, totalMinutes);
  const bottomMinutes = clamp(endMinutes, 0, totalMinutes);

  const top = (topMinutes / 60) * BOARD_HOUR_HEIGHT;
  const height = Math.max(((bottomMinutes - topMinutes) / 60) * BOARD_HOUR_HEIGHT, 28);

  return { top, height };
}

function getBoardRangeStyle(startIso, endIso, boardDate, timezone) {
  return getBoardCardStyle({ start: startIso, end: endIso }, boardDate, timezone);
}

function boardCardBackground(event) {
  const status = event.extendedProps?.status;
  const isStriped = shouldStripeAppointmentCard(event.extendedProps);

  if (status === 'cancelled' || status === 'no_show') {
    return 'repeating-linear-gradient(135deg, rgba(239,143,143,0.13), rgba(239,143,143,0.13) 10px, rgba(255,255,255,0.02) 10px, rgba(255,255,255,0.02) 20px)';
  }

  if (isStriped) {
    return 'repeating-linear-gradient(135deg, rgba(247,185,85,0.12), rgba(247,185,85,0.12) 10px, rgba(255,255,255,0.02) 10px, rgba(255,255,255,0.02) 20px)';
  }

  return 'linear-gradient(135deg, rgba(46,196,182,0.1), rgba(255,255,255,0.02))';
}

function blockOverlayBackground(block) {
  if (block.colorHex) {
    return `linear-gradient(135deg, ${block.colorHex}22, rgba(255,255,255,0.03))`;
  }
  switch (block.blockType) {
    case 'time_off':
      return 'repeating-linear-gradient(135deg, rgba(148,163,184,0.16), rgba(148,163,184,0.16) 10px, rgba(255,255,255,0.03) 10px, rgba(255,255,255,0.03) 20px)';
    case 'break':
      return 'repeating-linear-gradient(135deg, rgba(247,185,85,0.12), rgba(247,185,85,0.12) 8px, rgba(255,255,255,0.02) 8px, rgba(255,255,255,0.02) 16px)';
    case 'busy_hold':
      return 'repeating-linear-gradient(135deg, rgba(125,211,252,0.12), rgba(125,211,252,0.12) 8px, rgba(255,255,255,0.02) 8px, rgba(255,255,255,0.02) 16px)';
    default:
      return 'repeating-linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.04) 8px, rgba(255,255,255,0.02) 8px, rgba(255,255,255,0.02) 16px)';
  }
}

function getArtistAvailabilityBoardWindow(entries, dayOfWeek) {
  const dayEntry = (entries || []).find((row) => Number(row?.dayOfWeek) === Number(dayOfWeek));
  const boardTotalMinutes = (BOARD_END_HOUR - BOARD_START_HOUR) * 60;

  if (!entries || entries.length === 0) {
    return {
      source: 'weekly_availability',
      startMinutes: 0,
      endMinutes: 0
    };
  }

  if (!dayEntry) {
    return {
      source: 'weekly_availability',
      startMinutes: 0,
      endMinutes: 0
    };
  }

  if (!dayEntry.active) {
    return {
      source: 'weekly_availability',
      startMinutes: 0,
      endMinutes: 0
    };
  }

  const startLocal = parseLocalTimeToMinutes(dayEntry.startLocalTime);
  const endLocal = parseLocalTimeToMinutes(dayEntry.endLocalTime);

  if (startLocal == null || endLocal == null || endLocal <= startLocal) {
    return {
      source: 'fallback_business_hours',
      startMinutes: clamp((BOARD_BUSINESS_START_HOUR - BOARD_START_HOUR) * 60, 0, boardTotalMinutes),
      endMinutes: clamp((BOARD_BUSINESS_END_HOUR - BOARD_START_HOUR) * 60, 0, boardTotalMinutes)
    };
  }

  return {
    source: 'weekly_availability',
    startMinutes: clamp(startLocal - BOARD_START_HOUR * 60, 0, boardTotalMinutes),
    endMinutes: clamp(endLocal - BOARD_START_HOUR * 60, 0, boardTotalMinutes)
  };
}

function formatDateTimeLocalValue(isoString, timezone) {
  if (!isoString) return '';
  try {
    return DateTime.fromISO(isoString, { zone: 'utc' }).setZone(timezone).toFormat("yyyy-LL-dd'T'HH:mm");
  } catch {
    return '';
  }
}

function buildCreateDraft({ artistId, boardDate, minutesFromStart, timezone }) {
  const roundedMinutes = Math.round(minutesFromStart / BOARD_SNAP_MINUTES) * BOARD_SNAP_MINUTES;
  const clampedMinutes = clamp(
    roundedMinutes,
    0,
    (BOARD_END_HOUR - BOARD_START_HOUR) * 60 - BOARD_SNAP_MINUTES
  );
  const start = DateTime.fromISO(boardDate, { zone: timezone })
    .startOf('day')
    .plus({ hours: BOARD_START_HOUR, minutes: clampedMinutes });

  return {
    artistId,
    servicePresetId: '',
    selectedClientId: '',
    selectedClient: null,
    startAtLocal: start.toFormat("yyyy-LL-dd'T'HH:mm"),
    durationMinutes: '60',
    source: 'manual',
    serviceName: '',
    depositRequested: false,
    depositRequiredAmount: '0',
    quotedTotalAmount: '',
    firstName: '',
    lastName: '',
    phoneE164: '',
    email: '',
    designBrief: '',
    internalNotes: ''
  };
}

function buildBlockedTimeDraft({ artistId, boardDate, minutesFromStart, timezone }) {
  const roundedMinutes = Math.round(minutesFromStart / 15) * 15;
  const clampedMinutes = clamp(roundedMinutes, 0, (BOARD_END_HOUR - BOARD_START_HOUR) * 60 - 15);
  const start = DateTime.fromISO(boardDate, { zone: timezone })
    .startOf('day')
    .plus({ hours: BOARD_START_HOUR, minutes: clampedMinutes });
  const end = start.plus({ minutes: 30 });

  return {
    artistId,
    blockType: 'busy_hold',
    startAtLocal: start.toFormat("yyyy-LL-dd'T'HH:mm"),
    endAtLocal: end.toFormat("yyyy-LL-dd'T'HH:mm"),
    label: 'Hold',
    note: '',
    affectsBooking: true
  };
}

function stableStringify(value) {
  return JSON.stringify(value ?? null);
}

function timeStringToMinutes(timeValue) {
  const raw = String(timeValue || '').trim();
  if (!raw) return null;
  const [h, m] = raw.split(':');
  const hour = Number(h);
  const minute = Number(m);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

function boardMinutesToDateTime(boardDate, minutesFromStart, timezone) {
  return DateTime.fromISO(boardDate, { zone: timezone })
    .startOf('day')
    .plus({ hours: BOARD_START_HOUR, minutes: minutesFromStart });
}

function snapMinutes(minutes, increment = BOARD_SNAP_MINUTES) {
  return Math.round(minutes / increment) * increment;
}

function clampBoardMinutes(minutes) {
  const maxMinutes = (BOARD_END_HOUR - BOARD_START_HOUR) * 60;
  return clamp(minutes, 0, maxMinutes);
}

function normalizeAustralianPhoneToE164(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  const digits = value.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (/^0\d{9}$/.test(digits)) return `+61${digits.slice(1)}`;
  if (/^61\d{9}$/.test(digits)) return `+${digits}`;
  if (/^\d{9,15}$/.test(digits)) return `+${digits}`;
  return value;
}

export default function CalendarBoard({ studioTimezone = 'Australia/Melbourne' }) {
  const calendarRef = useRef(null);
  const boardColumnsRef = useRef({});
  const boardDragRef = useRef(null);
  const boardCardHoverTimerRef = useRef(null);
  const suppressBoardClickRef = useRef(0);
  const createDraftBaseRef = useRef(null);
  const blockedDraftBaseRef = useRef(null);
  const createClientFirstNameInputRef = useRef(null);
  const toastSeqRef = useRef(1);
  const [state, setState] = useState({
    loading: true,
    error: '',
    events: [],
    range: null
  });
  const [activeEventId, setActiveEventId] = useState('');
  const [detailsDraft, setDetailsDraft] = useState(null);
  const [createDraft, setCreateDraft] = useState(null);
  const [blockedDraft, setBlockedDraft] = useState(null);
  const [slotActionMenu, setSlotActionMenu] = useState(null);
  const [bookingActionMenu, setBookingActionMenu] = useState(null);
  const [boardHoverTime, setBoardHoverTime] = useState(null);
  const [boardCardHoverPreview, setBoardCardHoverPreview] = useState(null);
  const [boardIconTooltip, setBoardIconTooltip] = useState(null);
  const [boardHoveredCardId, setBoardHoveredCardId] = useState('');
  const [saveState, setSaveState] = useState({ saving: false, message: '', error: '' });
  const [toasts, setToasts] = useState([]);
  const [depositAction, setDepositAction] = useState({ sending: false, error: '' });
  const [depositEmailAction, setDepositEmailAction] = useState({ sending: false, error: '' });
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [checkoutDrawer, setCheckoutDrawer] = useState({
    open: false,
    loading: false,
    refreshing: false,
    error: '',
    data: null,
    appointmentId: '',
    lastUpdatedAt: null
  });
  const [checkoutUi, setCheckoutUi] = useState({
    actionLoading: false,
    actionError: '',
    addPaymentAmount: '',
    addPaymentMethod: 'cash',
    overrideTotalAmount: '',
    overrideNote: ''
  });
  const [clientSearch, setClientSearch] = useState({
    query: '',
    loading: false,
    error: '',
    results: []
  });
  const [createClientDrawer, setCreateClientDrawer] = useState({
    open: false,
    mode: 'new',
    loading: false,
    saving: false,
    error: '',
    clientId: '',
    draft: null
  });
  const [createServiceSearch, setCreateServiceSearch] = useState('');
  const [artistState, setArtistState] = useState({
    loading: true,
    error: '',
    artists: []
  });
  const [servicePresetState, setServicePresetState] = useState({
    loading: true,
    error: '',
    services: []
  });

  useEffect(() => {
    return () => {
      if (boardCardHoverTimerRef.current) {
        window.clearTimeout(boardCardHoverTimerRef.current);
      }
    };
  }, []);
  const [blockState, setBlockState] = useState({
    loading: false,
    error: '',
    warning: '',
    blocks: []
  });
  const [weeklyAvailabilityState, setWeeklyAvailabilityState] = useState({
    loading: false,
    error: '',
    byArtistId: {}
  });
  const [selectedArtistId, setSelectedArtistId] = useState('');
  const [boardDate, setBoardDate] = useState(() => DateTime.now().setZone(studioTimezone).toISODate());
  const [activeView, setActiveView] = useState('studio_day');
  const [boardInteraction, setBoardInteraction] = useState(null);
  const [melbourneNowIso, setMelbourneNowIso] = useState(() => DateTime.now().setZone(studioTimezone).toISO());

  useEffect(() => {
    let cancelled = false;

    async function loadArtists() {
      setArtistState({ loading: true, error: '', artists: [] });
      try {
        const response = await fetch('/api/artists', { cache: 'no-store' });
        const data = await response.json();

        if (!response.ok || !data.ok) {
          throw new Error(data?.error || `Failed to load artists (${response.status})`);
        }

        if (!cancelled) {
          setArtistState({
            loading: false,
            error: '',
            artists: data.artists || []
          });
        }
      } catch (error) {
        if (!cancelled) {
          setArtistState({
            loading: false,
            error: error instanceof Error ? error.message : 'Failed to load artists',
            artists: []
          });
        }
      }
    }

    loadArtists();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadServices() {
      setServicePresetState({ loading: true, error: '', services: [] });
      try {
        const response = await fetch('/api/services?includeAllPricing=true', { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok || !data.ok) {
          throw new Error(data?.error || `Failed to load services (${response.status})`);
        }
        if (!cancelled) {
          setServicePresetState({ loading: false, error: '', services: data.services || [] });
        }
      } catch (error) {
        if (!cancelled) {
          setServicePresetState({
            loading: false,
            error: error instanceof Error ? error.message : 'Failed to load services',
            services: []
          });
        }
      }
    }
    loadServices();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const tick = () => setMelbourneNowIso(DateTime.now().setZone(studioTimezone).toISO());
    tick();
    const timer = window.setInterval(tick, 30_000);
    return () => window.clearInterval(timer);
  }, [studioTimezone]);

  useEffect(() => {
    if (activeView !== 'studio_day') return;

    let cancelled = false;

    async function loadBoardDayEvents() {
      const dayStart = DateTime.fromISO(boardDate, { zone: studioTimezone }).startOf('day').toUTC();
      const dayEnd = dayStart.plus({ days: 1 });

      setState((prev) => ({ ...prev, loading: true, error: '' }));
      try {
        const params = new URLSearchParams({
          start: dayStart.toISO(),
          end: dayEnd.toISO()
        });
        if (selectedArtistId) params.set('artistId', selectedArtistId);

        const response = await fetch(`/api/calendar/events?${params.toString()}`, { cache: 'no-store' });
        const data = await response.json();

        if (!response.ok || !data.ok) {
          throw new Error(data?.error || `Failed to load events (${response.status})`);
        }

        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: '',
            events: data.events || [],
            range: data.range || { start: dayStart.toISO(), end: dayEnd.toISO() }
          }));
        }
      } catch (error) {
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: error instanceof Error ? error.message : 'Failed to load day board events',
            events: []
          }));
        }
      }
    }

    loadBoardDayEvents();
    return () => {
      cancelled = true;
    };
  }, [activeView, boardDate, selectedArtistId, studioTimezone]);

  useEffect(() => {
    let cancelled = false;

    async function loadAvailabilityBlocks() {
      const dayStart = DateTime.fromISO(boardDate, { zone: studioTimezone }).startOf('day').toUTC();
      const dayEnd = dayStart.plus({ days: 1 });
      setBlockState((prev) => ({ ...prev, loading: true, error: '', warning: '' }));

      try {
        const params = new URLSearchParams({
          start: dayStart.toISO(),
          end: dayEnd.toISO()
        });
        if (selectedArtistId) {
          params.set('artistId', selectedArtistId);
        }

        const response = await fetch(`/api/artists/availability-blocks?${params.toString()}`, {
          cache: 'no-store'
        });
        const data = await response.json();

        if (!response.ok || !data.ok) {
          throw new Error(data?.error || `Failed to load availability blocks (${response.status})`);
        }

        if (!cancelled) {
          setBlockState({
            loading: false,
            error: '',
            warning: data.warning || '',
            blocks: data.blocks || []
          });
        }
      } catch (error) {
        if (!cancelled) {
          setBlockState({
            loading: false,
            error: error instanceof Error ? error.message : 'Failed to load availability blocks',
            warning: '',
            blocks: []
          });
        }
      }
    }

    loadAvailabilityBlocks();
    return () => {
      cancelled = true;
    };
  }, [boardDate, selectedArtistId, studioTimezone]);

  useEffect(() => {
    let cancelled = false;
    async function loadWeeklyAvailability() {
      setWeeklyAvailabilityState((prev) => ({ ...prev, loading: true, error: '' }));
      try {
        const response = await fetch('/api/artists/weekly-availability', { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok || !data.ok) {
          throw new Error(data?.error || `Failed to load weekly availability (${response.status})`);
        }
        if (cancelled) return;
        const byArtistId = {};
        for (const artist of data.artists || []) {
          byArtistId[artist.id] = artist.weeklyAvailability || [];
        }
        setWeeklyAvailabilityState({ loading: false, error: '', byArtistId });
      } catch (error) {
        if (!cancelled) {
          setWeeklyAvailabilityState((prev) => ({
            ...prev,
            loading: false,
            error: error instanceof Error ? error.message : 'Failed to load weekly availability'
          }));
        }
      }
    }
    loadWeeklyAvailability();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedEventData = state.events.find((event) => event.id === activeEventId) || null;
  const boardEvents = state.events.filter((event) => eventIntersectsBoardDay(event, boardDate, studioTimezone));
  const boardBlocks = blockState.blocks.filter((block) =>
    eventIntersectsBoardDay({ start: block.startAt, end: block.endAt }, boardDate, studioTimezone)
  );
  const totalBoardHeight = (BOARD_END_HOUR - BOARD_START_HOUR) * BOARD_HOUR_HEIGHT;
  const melbourneNow = DateTime.fromISO(melbourneNowIso, { zone: studioTimezone });
  const isBoardTodayInStudio = boardDate === melbourneNow.toISODate();
  const nowMinutesFromBoardStart = melbourneNow.hour * 60 + melbourneNow.minute - BOARD_START_HOUR * 60;
  const maxBoardMinutes = (BOARD_END_HOUR - BOARD_START_HOUR) * 60;
  const showNowLine = isBoardTodayInStudio && nowMinutesFromBoardStart >= 0 && nowMinutesFromBoardStart <= maxBoardMinutes;
  const nowLineTop = showNowLine ? (nowMinutesFromBoardStart / 60) * BOARD_HOUR_HEIGHT : null;
  const nowLineLabel = melbourneNow.toFormat('h:mma').toLowerCase();
  const boardDayOfWeek = DateTime.fromISO(boardDate, { zone: studioTimezone }).weekday % 7; // Luxon: Mon=1..Sun=7 => Sun=0
  const rosteredArtistIdsForBoardDay = new Set(
    artistState.artists
      .filter((artist) => {
        const entries = weeklyAvailabilityState.byArtistId?.[artist.id] || [];
        const dayEntry = entries.find((row) => Number(row?.dayOfWeek) === Number(boardDayOfWeek));
        return Boolean(dayEntry?.active);
      })
      .map((artist) => artist.id)
  );
  const visibleArtists = (
    selectedArtistId
      ? artistState.artists.filter((artist) => artist.id === selectedArtistId)
      : activeView === 'studio_day'
        ? artistState.artists.filter((artist) => rosteredArtistIdsForBoardDay.has(artist.id))
        : artistState.artists
  ).slice();
  const noRosteredArtistsForBoardDay = activeView === 'studio_day' && !selectedArtistId && visibleArtists.length === 0;

  const getServicePresetForArtist = useCallback(
    (serviceId, artistId) => {
      const service = servicePresetState.services.find((item) => item.id === serviceId);
      if (!service) return null;
      const artistPricing = (service.artistPricing || []).find((row) => row.artistId === artistId && row.active !== false) || null;
      const effectiveDuration = artistPricing?.durationMinutes ?? service.durationMinutes ?? null;
      const effectivePrice = artistPricing?.priceAmount ?? service.basePrice ?? null;
      return {
        service,
        durationMinutes: effectiveDuration == null ? '' : String(effectiveDuration),
        quotedTotalAmount: effectivePrice == null ? '' : String(effectivePrice)
      };
    },
    [servicePresetState.services]
  );

  const applyCreateServicePresetSelection = useCallback(
    (nextServiceId, artistIdOverride) => {
      setCreateDraft((prev) => {
        if (!prev) return prev;
        const artistId = artistIdOverride || prev.artistId;
        const preset = nextServiceId ? getServicePresetForArtist(nextServiceId, artistId) : null;
        return {
          ...prev,
          servicePresetId: nextServiceId,
          serviceName: preset?.service?.name || prev.serviceName,
          durationMinutes: preset?.durationMinutes || prev.durationMinutes,
          quotedTotalAmount:
            preset?.quotedTotalAmount !== undefined ? preset.quotedTotalAmount : prev.quotedTotalAmount
        };
      });
    },
    [getServicePresetForArtist]
  );
  const plannerCalendarView = activeView === 'artist_month' ? 'dayGridMonth' : 'timeGridWeek';
  const detailsBaseline = selectedEventData ? buildDetailsDraftFromEvent(selectedEventData) : null;
  const isDetailsDirty =
    !!detailsDraft &&
    !!detailsBaseline &&
    stableStringify({ ...detailsDraft, changeNote: '' }) !== stableStringify({ ...detailsBaseline, changeNote: '' });
  const isCreateDirty =
    !!createDraft && !!createDraftBaseRef.current && stableStringify(createDraft) !== stableStringify(createDraftBaseRef.current);
  const isBlockedDirty =
    !!blockedDraft &&
    !!blockedDraftBaseRef.current &&
    stableStringify(blockedDraft) !== stableStringify(blockedDraftBaseRef.current);

  const pushToast = useCallback((type, message) => {
    const id = toastSeqRef.current++;
    setToasts((prev) => [...prev, { id, type, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3200);
  }, []);

  const confirmDiscard = useCallback((label) => {
    return window.confirm(`Discard unsaved ${label} changes?`);
  }, []);

  const closeCreateDrawer = useCallback(() => {
    if (isCreateDirty && !confirmDiscard('appointment')) return false;
    setCreateDraft(null);
    createDraftBaseRef.current = null;
    return true;
  }, [confirmDiscard, isCreateDirty]);

  const closeBlockedDrawer = useCallback(() => {
    if (isBlockedDirty && !confirmDiscard('blocked time')) return false;
    setBlockedDraft(null);
    blockedDraftBaseRef.current = null;
    return true;
  }, [confirmDiscard, isBlockedDirty]);

  const closeDetailsPanel = useCallback(() => {
    if (isDetailsDirty && !confirmDiscard('appointment details')) return false;
    setActiveEventId('');
    setDetailsDraft(null);
    setEditDrawerOpen(false);
    return true;
  }, [confirmDiscard, isDetailsDirty]);

  const markDepositLinkReadyInState = useCallback((appointmentId, sessionId) => {
    if (!appointmentId || !sessionId) return;
    const now = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      events: prev.events.map((item) =>
        item.id === appointmentId
          ? {
              ...item,
              extendedProps: {
                ...item.extendedProps,
                stripeCheckoutSessionId: sessionId,
                depositLinkLastGeneratedAt: now
              }
            }
          : item
      )
    }));
  }, []);

  const markDepositEmailSentInState = useCallback((appointmentId) => {
    if (!appointmentId) return;
    const now = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      events: prev.events.map((item) =>
        item.id === appointmentId
          ? {
              ...item,
              extendedProps: {
                ...item.extendedProps,
                depositEmailSentAt: now
              }
            }
          : item
      )
    }));
  }, []);

  const sendDepositLink = useCallback(async () => {
    if (!selectedEventData) return;
    const depositRequired = Number(selectedEventData.extendedProps?.depositRequiredAmount || 0);
    const depositPaid = Number(selectedEventData.extendedProps?.depositPaidAmount || 0);
    const depositRemaining = Math.max(depositRequired - depositPaid, 0);
    if (depositRemaining <= 0) {
      pushToast('info', 'Deposit already paid');
      return;
    }

    setDepositAction({ sending: true, error: '' });
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId: selectedEventData.id
        })
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data?.error || `Failed to create deposit link (${response.status})`);
      }

      setDepositAction({ sending: false, error: '' });
      if (data.sessionId) {
        markDepositLinkReadyInState(selectedEventData.id, data.sessionId);
      }
      pushToast('success', 'Deposit link created');
      if (data.checkoutUrl) {
        window.open(data.checkoutUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create deposit link';
      setDepositAction({ sending: false, error: message });
      pushToast('error', message);
    }
  }, [markDepositLinkReadyInState, pushToast, selectedEventData]);

  const sendDepositEmail = useCallback(async () => {
    if (!selectedEventData) return;
    const depositRequired = Number(selectedEventData.extendedProps?.depositRequiredAmount || 0);
    const depositPaid = Number(selectedEventData.extendedProps?.depositPaidAmount || 0);
    const depositRemaining = Math.max(depositRequired - depositPaid, 0);
    if (depositRemaining <= 0) {
      pushToast('info', 'Deposit already paid');
      return;
    }

    setDepositEmailAction({ sending: true, error: '' });
    try {
      const response = await fetch(`/api/appointments/${selectedEventData.id}/send-deposit-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data?.error || `Failed to send deposit email (${response.status})`);
      }

      setDepositEmailAction({ sending: false, error: '' });
      if (data.sessionId) {
        markDepositLinkReadyInState(selectedEventData.id, data.sessionId);
      }
      markDepositEmailSentInState(selectedEventData.id);
      pushToast(
        'success',
        data?.testOverrideApplied
          ? `Deposit email sent to test override (${data.sentTo})`
          : `Deposit email sent to ${data.sentTo}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send deposit email';
      setDepositEmailAction({ sending: false, error: message });
      pushToast('error', message);
    }
  }, [markDepositEmailSentInState, markDepositLinkReadyInState, pushToast, selectedEventData]);

  function selectView(nextView) {
    if (nextView === 'artist_week' || nextView === 'artist_month') {
      if (!selectedArtistId && artistState.artists.length > 0) {
        setSelectedArtistId(artistState.artists[0].id);
      }
    }
    setActiveView(nextView);
  }

  useEffect(() => {
    if (!selectedEventData) return;
    setDetailsDraft(buildDetailsDraftFromEvent(selectedEventData));
    setDepositAction({ sending: false, error: '' });
    setDepositEmailAction({ sending: false, error: '' });
  }, [selectedEventData]);

  useEffect(() => {
    if (!checkoutDrawer.open || !checkoutDrawer.data?.order) return;
    setCheckoutUi((prev) => ({
      ...prev,
      actionError: '',
      overrideTotalAmount:
        prev.overrideTotalAmount === '' ? String(checkoutDrawer.data.order.totalAmount ?? '') : prev.overrideTotalAmount
    }));
  }, [checkoutDrawer.data?.order?.totalAmount, checkoutDrawer.open]);

  useEffect(() => {
    function isTypingTarget(target) {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return target.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    }

    function onKeyDown(event) {
      if (isTypingTarget(event.target)) return;

      if (event.key === 'Escape') {
        if (editDrawerOpen) {
          setEditDrawerOpen(false);
          return;
        }
        if (bookingActionMenu) {
          setBookingActionMenu(null);
          return;
        }
        if (slotActionMenu) {
          setSlotActionMenu(null);
          return;
        }
        if (createDraft) {
          closeCreateDrawer();
          return;
        }
        if (blockedDraft) {
          closeBlockedDrawer();
          return;
        }
        if (checkoutDrawer.open) {
          setCheckoutDrawer((prev) => ({ ...prev, open: false }));
          return;
        }
        if (selectedEventData) {
          closeDetailsPanel();
          return;
        }
      }

      if (activeView === 'studio_day') {
        if (event.key.toLowerCase() === 't') {
          setBoardDate(DateTime.now().setZone(studioTimezone).toISODate());
          pushToast('info', 'Jumped to today');
          return;
        }
        if (event.key === 'ArrowLeft') {
          setBoardDate((prev) => DateTime.fromISO(prev).minus({ days: 1 }).toISODate());
          return;
        }
        if (event.key === 'ArrowRight') {
          setBoardDate((prev) => DateTime.fromISO(prev).plus({ days: 1 }).toISODate());
          return;
        }
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activeView,
    blockedDraft,
    editDrawerOpen,
    checkoutDrawer.open,
    closeBlockedDrawer,
    closeCreateDrawer,
    closeDetailsPanel,
    createDraft,
    pushToast,
    selectedEventData,
    bookingActionMenu,
    slotActionMenu,
    studioTimezone
  ]);

  useEffect(() => {
    const hasUnsaved = isCreateDirty || isBlockedDirty || isDetailsDirty;
    function onBeforeUnload(event) {
      if (!hasUnsaved) return;
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isBlockedDirty, isCreateDirty, isDetailsDirty]);

  useEffect(() => {
    if (!createDraft) {
      setClientSearch({ query: '', loading: false, error: '', results: [] });
      return;
    }
  }, [createDraft]);

  useEffect(() => {
    if (!createDraft) return;
    const query = clientSearch.query.trim();
    if (query.length < 2) {
      setClientSearch((prev) => ({ ...prev, loading: false, error: '', results: [] }));
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setClientSearch((prev) => ({ ...prev, loading: true, error: '' }));
      try {
        const params = new URLSearchParams({ q: query });
        const response = await fetch(`/api/clients/search?${params.toString()}`, { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok || !data.ok) {
          throw new Error(data?.error || `Failed to search clients (${response.status})`);
        }
        if (!cancelled) {
          setClientSearch((prev) => ({
            ...prev,
            loading: false,
            error: '',
            results: data.clients || []
          }));
        }
      } catch (error) {
        if (!cancelled) {
          setClientSearch((prev) => ({
            ...prev,
            loading: false,
            error: error instanceof Error ? error.message : 'Failed to search clients',
            results: []
          }));
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [clientSearch.query, createDraft]);

  useEffect(() => {
    if (!createDraft?.servicePresetId) return;
    const preset = getServicePresetForArtist(createDraft.servicePresetId, createDraft.artistId);
    if (!preset) return;
    setCreateDraft((prev) => {
      if (!prev || prev.servicePresetId !== createDraft.servicePresetId) return prev;
      return {
        ...prev,
        serviceName: preset.service.name,
        durationMinutes: preset.durationMinutes || prev.durationMinutes,
        quotedTotalAmount: preset.quotedTotalAmount,
      };
    });
  }, [createDraft?.artistId, createDraft?.servicePresetId, getServicePresetForArtist]);

  const createDrawerArtistServices = createDraft
    ? servicePresetState.services
        .filter((service) => service.active !== false)
        .filter((service) => {
          const q = createServiceSearch.trim().toLowerCase();
          if (!q) return true;
          return (
            String(service.name || '').toLowerCase().includes(q) ||
            String(service.category || '').toLowerCase().includes(q)
          );
        })
        .map((service) => ({
          service,
          preset: getServicePresetForArtist(service.id, createDraft.artistId)
        }))
    : [];

  const openCreateClientDrawerNew = useCallback(() => {
    setCreateClientDrawer({
      open: true,
      mode: 'new',
      loading: false,
      saving: false,
      error: '',
      clientId: '',
      draft: {
        firstName: '',
        lastName: '',
        phoneE164: '',
        email: '',
        instagramHandle: '',
        status: 'active',
        clientType: 'new',
        source: 'manual',
        notes: ''
      }
    });
    window.setTimeout(() => {
      createClientFirstNameInputRef.current?.focus?.();
    }, 0);
  }, []);

  const openCreateClientDrawerExisting = useCallback((client) => {
    if (!client?.id) return;
    setCreateClientDrawer({
      open: true,
      mode: 'existing',
      loading: false,
      saving: false,
      error: '',
      clientId: client.id,
      draft: {
        firstName: client.firstName || '',
        lastName: client.lastName || '',
        phoneE164: client.phoneE164 || '',
        email: client.email || '',
        instagramHandle: client.instagramHandle || '',
        status: client.status || 'active',
        clientType: client.clientType || 'new',
        source: client.source || 'manual',
        notes: client.notes || ''
      }
    });
  }, []);

  const saveClientFromCreateDrawer = useCallback(async () => {
    if (!createClientDrawer.draft) return;
    const draft = createClientDrawer.draft;
    if (!draft.firstName?.trim() || !draft.lastName?.trim()) {
      setCreateClientDrawer((prev) => ({ ...prev, error: 'First name and last name are required' }));
      return;
    }
    if (!draft.phoneE164?.trim() || !draft.email?.trim()) {
      setCreateClientDrawer((prev) => ({ ...prev, error: 'Phone and email are required' }));
      return;
    }
    setCreateClientDrawer((prev) => ({ ...prev, saving: true, error: '' }));
    try {
      const payload = {
        firstName: draft.firstName.trim(),
        lastName: draft.lastName.trim(),
        phoneE164: normalizeAustralianPhoneToE164(draft.phoneE164),
        email: draft.email.trim(),
        instagramHandle: draft.instagramHandle || '',
        status: draft.status || 'active',
        clientType: draft.clientType || 'new',
        source: draft.source || 'manual',
        notes: draft.notes || ''
      };
      const isExisting = createClientDrawer.mode === 'existing' && createClientDrawer.clientId;
      const response = await fetch(
        isExisting ? `/api/clients/${createClientDrawer.clientId}` : '/api/clients',
        {
          method: isExisting ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }
      );
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data?.error || `Failed to ${isExisting ? 'update' : 'create'} client`);
      }
      const client = data.client;
      setCreateDraft((prev) =>
        prev
          ? {
              ...prev,
              selectedClientId: client.id,
              selectedClient: client,
              firstName: client.firstName || '',
              lastName: client.lastName || '',
              phoneE164: client.phoneE164 || '',
              email: client.email || ''
            }
          : prev
      );
      setCreateClientDrawer((prev) => ({ ...prev, open: false, saving: false, error: '' }));
      setClientSearch((prev) => ({ ...prev, query: '', loading: false, error: '', results: [] }));
      pushToast('success', isExisting ? 'Client updated' : 'Client created and selected');
    } catch (error) {
      setCreateClientDrawer((prev) => ({
        ...prev,
        saving: false,
        error: error instanceof Error ? error.message : 'Failed to save client'
      }));
    }
  }, [createClientDrawer, pushToast]);

  const loadEventsForRange = useCallback(async (fetchInfo, successCallback, failureCallback) => {
    const range = {
      start: fetchInfo.startStr,
      end: fetchInfo.endStr
    };

    setState((prev) => ({ ...prev, loading: true, error: '', range }));

    try {
      const params = new URLSearchParams({
        start: range.start,
        end: range.end
      });
      if (selectedArtistId) {
        params.set('artistId', selectedArtistId);
      }
      const response = await fetch(`/api/calendar/events?${params.toString()}`, {
        cache: 'no-store'
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data?.error || `Failed to load events (${response.status})`);
      }

      const events = data.events || [];
      setState({
        loading: false,
        error: '',
        events,
        range: data.range || range
      });
      successCallback(events);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load calendar events';
      setState((prev) => ({
        ...prev,
        loading: false,
        error: message,
        events: []
      }));
      failureCallback(error);
    }
  }, [selectedArtistId]);

  const applyPatchedAppointmentToState = useCallback(
    (appointment) => {
      const updatedArtistName =
        artistState.artists.find((artist) => artist.id === appointment.artistId)?.displayName || null;

      setState((prev) => ({
        ...prev,
        events: prev.events.map((item) =>
          item.id === appointment.id
            ? {
                ...item,
                start: appointment.startAt,
                end: appointment.endAt,
                extendedProps: {
                  ...item.extendedProps,
                  artistId: appointment.artistId,
                  artistName: updatedArtistName || item.extendedProps?.artistName || null,
                  status: appointment.status,
                  source: appointment.source,
                  depositRequiredAmount: appointment.depositRequiredAmount,
                  depositPaidAmount: appointment.depositPaidAmount,
                  quotedTotalAmount: appointment.quotedTotalAmount,
                  designBrief: appointment.designBrief,
                  internalNotes: appointment.internalNotes,
                  depositEmailSentAt:
                    appointment.depositEmailSentAt !== undefined
                      ? appointment.depositEmailSentAt
                      : item.extendedProps?.depositEmailSentAt || null,
                  depositLinkLastGeneratedAt:
                    appointment.depositLinkLastGeneratedAt !== undefined
                      ? appointment.depositLinkLastGeneratedAt
                      : item.extendedProps?.depositLinkLastGeneratedAt || null,
                  reminder72hEmailSentAt:
                    appointment.reminder72hEmailSentAt !== undefined
                      ? appointment.reminder72hEmailSentAt
                      : item.extendedProps?.reminder72hEmailSentAt || null,
                  arrivedAt:
                    appointment.arrivedAt !== undefined
                      ? appointment.arrivedAt
                      : item.extendedProps?.arrivedAt || null,
                  checkedOutAt:
                    appointment.checkedOutAt !== undefined
                      ? appointment.checkedOutAt
                      : item.extendedProps?.checkedOutAt || null,
                  paidInFullAt:
                    appointment.paidInFullAt !== undefined
                      ? appointment.paidInFullAt
                      : item.extendedProps?.paidInFullAt || null
                }
              }
            : item
        )
      }));
    },
    [artistState.artists]
  );

  const patchAppointmentRequest = useCallback(async (appointmentId, patch) => {
    const response = await fetch(`/api/appointments/${appointmentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data?.error || `Failed to update appointment (${response.status})`);
    }
    return data.appointment;
  }, []);

  const markAppointmentStatusQuick = useCallback(
    async (nextStatus) => {
      if (!selectedEventData) return;
      setSaveState({ saving: true, message: '', error: '' });
      try {
        const appointment = await patchAppointmentRequest(selectedEventData.id, { status: nextStatus });
        applyPatchedAppointmentToState(appointment);
        setSaveState({ saving: false, message: `Appointment marked ${getStatusDisplayLabel(nextStatus)}`, error: '' });
        pushToast('success', `Marked ${getStatusDisplayLabel(nextStatus)}`);
        if (calendarRef.current) calendarRef.current.getApi().refetchEvents();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update appointment status';
        setSaveState({ saving: false, message: '', error: message });
        pushToast('error', message);
      }
    },
    [applyPatchedAppointmentToState, patchAppointmentRequest, pushToast, selectedEventData]
  );

  const cancelAppointmentQuick = useCallback(async () => {
    if (!selectedEventData) return;
    if (!window.confirm('Cancel this appointment?')) return;
    await markAppointmentStatusQuick('cancelled');
  }, [markAppointmentStatusQuick, selectedEventData]);

  const openCheckoutDrawer = useCallback(async () => {
    if (!selectedEventData) return;
    const appointmentId = selectedEventData.id;
    setCheckoutDrawer({
      open: true,
      loading: true,
      refreshing: false,
      error: '',
      data: null,
      appointmentId,
      lastUpdatedAt: null
    });
    try {
      const response = await fetch(`/api/appointments/${appointmentId}/checkout-summary`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data?.error || `Failed to load checkout summary (${response.status})`);
      }
      setCheckoutDrawer({
        open: true,
        loading: false,
        refreshing: false,
        error: '',
        data,
        appointmentId,
        lastUpdatedAt: Date.now()
      });
    } catch (error) {
      setCheckoutDrawer({
        open: true,
        loading: false,
        refreshing: false,
        error: error instanceof Error ? error.message : 'Failed to load checkout summary',
        data: null,
        appointmentId,
        lastUpdatedAt: null
      });
    }
  }, [selectedEventData]);

  const refreshCheckoutDrawer = useCallback(async ({ soft = true } = {}) => {
    const appointmentId = checkoutDrawer.appointmentId || selectedEventData?.id || '';
    if (!appointmentId) return;
    setCheckoutDrawer((prev) => ({
      ...prev,
      loading: soft ? prev.loading : true,
      refreshing: soft ? true : prev.refreshing,
      error: ''
    }));
    try {
      const response = await fetch(`/api/appointments/${appointmentId}/checkout-summary`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data?.error || `Failed to load checkout summary (${response.status})`);
      }
      setCheckoutDrawer((prev) => ({
        ...prev,
        open: true,
        loading: false,
        refreshing: false,
        error: '',
        data,
        appointmentId,
        lastUpdatedAt: Date.now()
      }));
    } catch (error) {
      setCheckoutDrawer((prev) => ({
        ...prev,
        loading: false,
        refreshing: false,
        error: error instanceof Error ? error.message : 'Failed to load checkout summary'
      }));
    }
  }, [checkoutDrawer.appointmentId, selectedEventData]);

  useEffect(() => {
    if (!checkoutDrawer.open || !checkoutDrawer.appointmentId) return;
    const timer = window.setInterval(() => {
      refreshCheckoutDrawer({ soft: true });
    }, 7000);
    return () => window.clearInterval(timer);
  }, [checkoutDrawer.open, checkoutDrawer.appointmentId, refreshCheckoutDrawer]);

  useEffect(() => {
    if (!checkoutDrawer.open || !checkoutDrawer.appointmentId) return;

    function handleFocusRefresh() {
      refreshCheckoutDrawer({ soft: true });
    }

    function handleVisibilityChange() {
      if (!document.hidden) {
        refreshCheckoutDrawer({ soft: true });
      }
    }

    window.addEventListener('focus', handleFocusRefresh);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('focus', handleFocusRefresh);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkoutDrawer.open, checkoutDrawer.appointmentId, refreshCheckoutDrawer]);

  const runCheckoutAction = useCallback(
    async (payload, successMessage) => {
      if (!selectedEventData) return;
      setCheckoutUi((prev) => ({ ...prev, actionLoading: true, actionError: '' }));
      try {
        const response = await fetch(`/api/appointments/${selectedEventData.id}/checkout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!response.ok || !data.ok) {
          throw new Error(data?.error || `Checkout action failed (${response.status})`);
        }
        setCheckoutDrawer((prev) => ({
          ...prev,
          open: true,
          loading: false,
          refreshing: false,
          error: '',
          data,
          appointmentId: prev.appointmentId || selectedEventData.id,
          lastUpdatedAt: Date.now()
        }));
        setCheckoutUi((prev) => ({ ...prev, actionLoading: false, actionError: '' }));
        pushToast('success', successMessage);

        // Sync event state immediately using returned appointment/order summary data.
        const summary = data;
        setState((prev) => ({
          ...prev,
          events: prev.events.map((item) =>
            item.id === selectedEventData.id
              ? {
                  ...item,
                  extendedProps: {
                    ...item.extendedProps,
                    status: summary.appointment?.status || item.extendedProps?.status,
                    quotedTotalAmount:
                      summary.appointment?.quotedTotalAmount ?? item.extendedProps?.quotedTotalAmount ?? null,
                    paidInFullAt: summary.appointment?.paidInFullAt ?? item.extendedProps?.paidInFullAt ?? null,
                    checkedOutAt: summary.appointment?.checkedOutAt ?? item.extendedProps?.checkedOutAt ?? null,
                    arrivedAt: summary.appointment?.arrivedAt ?? item.extendedProps?.arrivedAt ?? null
                  }
                }
              : item
          )
        }));
        if (calendarRef.current) calendarRef.current.getApi().refetchEvents();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Checkout action failed';
        setCheckoutUi((prev) => ({ ...prev, actionLoading: false, actionError: message }));
        pushToast('error', message);
      }
    },
    [pushToast, selectedEventData]
  );

  const addCheckoutPayment = useCallback(async () => {
    const amount = Number(checkoutUi.addPaymentAmount || 0);
    if (!amount || amount <= 0) {
      setCheckoutUi((prev) => ({ ...prev, actionError: 'Enter a valid payment amount greater than 0' }));
      return;
    }
    if (checkoutUi.addPaymentMethod === 'stripe_link') {
      await runCheckoutAction(
        { action: 'send_stripe_link_email', amount },
        'Stripe payment link emailed'
      );
      return;
    }
    await runCheckoutAction(
      {
        action: 'add_payment',
        amount,
        method: checkoutUi.addPaymentMethod
      },
      'Payment added'
    );
    setCheckoutUi((prev) => ({ ...prev, addPaymentAmount: '' }));
  }, [checkoutUi.addPaymentAmount, checkoutUi.addPaymentMethod, runCheckoutAction]);

  const applyCheckoutPriceOverride = useCallback(async () => {
    const amount = Number(checkoutUi.overrideTotalAmount || 0);
    if (!Number.isFinite(amount) || amount < 0) {
      setCheckoutUi((prev) => ({ ...prev, actionError: 'Enter a valid manual total' }));
      return;
    }
    await runCheckoutAction(
      {
        action: 'override_price',
        totalAmount: amount,
        note: checkoutUi.overrideNote || ''
      },
      'Manual price override applied'
    );
  }, [checkoutUi.overrideNote, checkoutUi.overrideTotalAmount, runCheckoutAction]);

  const completeCheckoutAction = useCallback(async () => {
    const balanceDue = Number(checkoutDrawer.data?.order?.balanceDueAmount || 0);
    if (balanceDue > 0) {
      const proceed = window.confirm(
        `This order still has ${balanceDue} AUD owing. Complete checkout anyway?`
      );
      if (!proceed) return;
    }
    await runCheckoutAction({ action: 'complete_checkout' }, 'Checkout completed');
  }, [checkoutDrawer.data?.order?.balanceDueAmount, runCheckoutAction]);

  const patchCalendarAppointment = useCallback(async ({ event, revert }) => {
    const startAt = event.start?.toISOString?.();
    const endAt = event.end?.toISOString?.();

    if (!startAt || !endAt) {
      revert();
      setSaveState({ saving: false, message: '', error: 'Calendar event is missing start/end time' });
      return;
    }

    setSaveState({ saving: true, message: '', error: '' });

    try {
      const appointment = await patchAppointmentRequest(event.id, { startAt, endAt });

      setSaveState({ saving: false, message: 'Appointment rescheduled', error: '' });
      pushToast('success', 'Appointment rescheduled');
      applyPatchedAppointmentToState(appointment);
      if (calendarRef.current) {
        calendarRef.current.getApi().refetchEvents();
      }
    } catch (error) {
      revert();
      setSaveState({
        saving: false,
        message: '',
        error: error instanceof Error ? error.message : 'Failed to update appointment'
      });
      pushToast('error', error instanceof Error ? error.message : 'Failed to update appointment');
    }
  }, [applyPatchedAppointmentToState, patchAppointmentRequest, pushToast]);

  const saveAppointmentDetails = useCallback(async () => {
    if (!selectedEventData || !detailsDraft) return;

    const previousStatus = selectedEventData.extendedProps?.status;
    const nextStatus = detailsDraft.status;
    if (
      nextStatus &&
      ['cancelled', 'no_show'].includes(nextStatus) &&
      nextStatus !== previousStatus &&
      !window.confirm(`Mark this appointment as "${nextStatus}"?`)
    ) {
      return;
    }

    let nextInternalNotes = detailsDraft.internalNotes || null;
    const trimmedChangeNote = (detailsDraft.changeNote || '').trim();
    if (trimmedChangeNote) {
      const stamp = DateTime.now().setZone(studioTimezone).toFormat('yyyy-LL-dd HH:mm');
      nextInternalNotes = [nextInternalNotes, `[${stamp}] Change note: ${trimmedChangeNote}`].filter(Boolean).join('\n');
    }

    setSaveState({ saving: true, message: '', error: '' });

    try {
      const appointment = await patchAppointmentRequest(selectedEventData.id, {
        artistId: detailsDraft.artistId || undefined,
        status: detailsDraft.status,
        source: detailsDraft.source,
        depositRequiredAmount: Number(detailsDraft.depositRequiredAmount || 0),
        quotedTotalAmount: detailsDraft.quotedTotalAmount === '' ? null : Number(detailsDraft.quotedTotalAmount),
        designBrief: detailsDraft.designBrief || null,
        internalNotes: nextInternalNotes
      });

      applyPatchedAppointmentToState(appointment);

      setSaveState({ saving: false, message: 'Appointment details saved', error: '' });
      pushToast('success', 'Appointment details saved');
      if (calendarRef.current) {
        calendarRef.current.getApi().refetchEvents();
      }
    } catch (error) {
      setSaveState({
        saving: false,
        message: '',
        error: error instanceof Error ? error.message : 'Failed to save appointment details'
      });
      pushToast('error', error instanceof Error ? error.message : 'Failed to save appointment details');
    }
  }, [applyPatchedAppointmentToState, detailsDraft, patchAppointmentRequest, pushToast, selectedEventData, studioTimezone]);

  const createAppointmentFromBoard = useCallback(async () => {
    if (!createDraft) return;

    setSaveState({ saving: true, message: '', error: '' });

    try {
      const startLocal = DateTime.fromFormat(createDraft.startAtLocal, "yyyy-LL-dd'T'HH:mm", {
        zone: studioTimezone
      });

      if (!startLocal.isValid) {
        throw new Error('Invalid start date/time');
      }
      if (!createDraft.servicePresetId) {
        throw new Error('Select an appointment type');
      }
      if (!createDraft.serviceName) {
        throw new Error('Appointment type is missing a service name');
      }
      if (!createDraft.selectedClientId) {
        throw new Error('Select or create a client before saving the appointment');
      }
      const durationMinutes = Number(createDraft.durationMinutes);
      if (!Number.isFinite(durationMinutes) || durationMinutes < 15 || durationMinutes > 480 || durationMinutes % 15 !== 0) {
        throw new Error('Duration must be in 15 minute increments (15 min to 8 hrs)');
      }

      const payload = {
        artistId: createDraft.artistId,
        startAt: startLocal.toUTC().toISO(),
        durationMinutes,
        timezone: studioTimezone,
        source: createDraft.source,
        serviceName: createDraft.serviceName,
        clientId: createDraft.selectedClientId,
        depositRequiredAmount: createDraft.depositRequested
          ? Number(createDraft.depositRequiredAmount || 0)
          : 0,
        quotedTotalAmount: createDraft.quotedTotalAmount === '' ? undefined : Number(createDraft.quotedTotalAmount),
        designBrief: createDraft.designBrief || undefined,
        internalNotes: createDraft.internalNotes || undefined
      };

      const response = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data?.error || `Failed to create appointment (${response.status})`);
      }

      setSaveState({ saving: false, message: 'Appointment created', error: '' });
      pushToast('success', 'Appointment created');
      setCreateDraft(null);
      createDraftBaseRef.current = null;
      setActiveEventId(data.appointment.id);

      if (calendarRef.current) {
        calendarRef.current.getApi().refetchEvents();
      }

      if (activeView === 'studio_day') {
        const dayStart = DateTime.fromISO(boardDate, { zone: studioTimezone }).startOf('day').toUTC();
        const dayEnd = dayStart.plus({ days: 1 });
        const params = new URLSearchParams({
          start: dayStart.toISO(),
          end: dayEnd.toISO()
        });
        if (selectedArtistId) params.set('artistId', selectedArtistId);
        const refreshResponse = await fetch(`/api/calendar/events?${params.toString()}`, { cache: 'no-store' });
        const refreshData = await refreshResponse.json();
        if (refreshResponse.ok && refreshData.ok) {
          setState((prev) => ({
            ...prev,
            events: refreshData.events || [],
            range: refreshData.range || prev.range,
            loading: false,
            error: ''
          }));
        }
      }
    } catch (error) {
      setSaveState({
        saving: false,
        message: '',
        error: error instanceof Error ? error.message : 'Failed to create appointment'
      });
      pushToast('error', error instanceof Error ? error.message : 'Failed to create appointment');
    }
  }, [activeView, boardDate, createDraft, pushToast, selectedArtistId, studioTimezone]);

  const createBlockedTimeFromBoard = useCallback(async () => {
    if (!blockedDraft) return;
    setSaveState({ saving: true, message: '', error: '' });

    try {
      const startLocal = DateTime.fromFormat(blockedDraft.startAtLocal, "yyyy-LL-dd'T'HH:mm", { zone: studioTimezone });
      const endLocal = DateTime.fromFormat(blockedDraft.endAtLocal, "yyyy-LL-dd'T'HH:mm", { zone: studioTimezone });
      if (!startLocal.isValid || !endLocal.isValid) throw new Error('Invalid blocked time range');
      if (endLocal <= startLocal) throw new Error('Blocked time end must be after start');

      const response = await fetch('/api/artists/availability-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistId: blockedDraft.artistId,
          blockType: blockedDraft.blockType,
          startAt: startLocal.toUTC().toISO(),
          endAt: endLocal.toUTC().toISO(),
          timezone: studioTimezone,
          label: blockedDraft.label,
          note: blockedDraft.note,
          affectsBooking: blockedDraft.affectsBooking
        })
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data?.error || `Failed to create blocked time (${response.status})`);
      }

      setSaveState({ saving: false, message: 'Blocked time created', error: '' });
      pushToast('success', 'Blocked time created');
      setBlockedDraft(null);
      blockedDraftBaseRef.current = null;
      setBlockState((prev) => ({ ...prev, blocks: [...prev.blocks, data.block] }));
    } catch (error) {
      setSaveState({
        saving: false,
        message: '',
        error: error instanceof Error ? error.message : 'Failed to create blocked time'
      });
      pushToast('error', error instanceof Error ? error.message : 'Failed to create blocked time');
    }
  }, [blockedDraft, pushToast, studioTimezone]);

  const updateBoardInteractionFromPointer = useCallback(
    (clientX, clientY) => {
      const drag = boardDragRef.current;
      if (!drag) return;

      let hoveredArtistId = drag.artistId;
      let hoveredRect = null;

      for (const [artistId, el] of Object.entries(boardColumnsRef.current)) {
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
          hoveredArtistId = artistId;
          hoveredRect = rect;
          break;
        }
      }

      if (!hoveredRect && boardColumnsRef.current[hoveredArtistId]) {
        hoveredRect = boardColumnsRef.current[hoveredArtistId].getBoundingClientRect();
      }
      if (!hoveredRect) return;

      const y = clamp(clientY - hoveredRect.top, 0, totalBoardHeight);
      const rawMinutes = (y / BOARD_HOUR_HEIGHT) * 60;

      if (drag.mode === 'move') {
        const durationMinutes = drag.durationMinutes;
        const snappedStart = clamp(
          snapMinutes(rawMinutes - drag.pointerOffsetMinutes, BOARD_SNAP_MINUTES),
          0,
          (BOARD_END_HOUR - BOARD_START_HOUR) * 60 - durationMinutes
        );
        const start = boardMinutesToDateTime(boardDate, snappedStart, studioTimezone);
        const end = start.plus({ minutes: durationMinutes });
        setBoardInteraction({
          mode: 'move',
          appointmentId: drag.appointmentId,
          artistId: hoveredArtistId,
          startAt: start.toUTC().toISO(),
          endAt: end.toUTC().toISO()
        });
      } else if (drag.mode === 'resize') {
        const minDuration = BOARD_SNAP_MINUTES;
        const startMinutes = drag.startMinutes;
        const snappedEnd = clamp(
          snapMinutes(rawMinutes, BOARD_SNAP_MINUTES),
          startMinutes + minDuration,
          (BOARD_END_HOUR - BOARD_START_HOUR) * 60
        );
        const start = boardMinutesToDateTime(boardDate, startMinutes, studioTimezone);
        const end = boardMinutesToDateTime(boardDate, snappedEnd, studioTimezone);
        setBoardInteraction({
          mode: 'resize',
          appointmentId: drag.appointmentId,
          artistId: drag.artistId,
          startAt: start.toUTC().toISO(),
          endAt: end.toUTC().toISO()
        });
      }
    },
    [boardDate, studioTimezone, totalBoardHeight]
  );

  const commitBoardInteraction = useCallback(async () => {
    const drag = boardDragRef.current;
    const preview = boardInteraction;
    boardDragRef.current = null;
    if (!drag || !preview) {
      setBoardInteraction(null);
      return;
    }

    const original = state.events.find((event) => event.id === drag.appointmentId);
    if (!original) {
      setBoardInteraction(null);
      return;
    }

    const startChanged = original.start !== preview.startAt;
    const endChanged = original.end !== preview.endAt;
    const artistChanged = original.extendedProps?.artistId !== preview.artistId;

    if (!startChanged && !endChanged && !artistChanged) {
      setBoardInteraction(null);
      return;
    }

    setSaveState({ saving: true, message: '', error: '' });
    try {
      const appointment = await patchAppointmentRequest(drag.appointmentId, {
        artistId: preview.artistId,
        startAt: preview.startAt,
        endAt: preview.endAt
      });
      applyPatchedAppointmentToState(appointment);
      setSaveState({ saving: false, message: 'Appointment updated', error: '' });
      pushToast('success', 'Appointment updated');
      if (calendarRef.current) {
        calendarRef.current.getApi().refetchEvents();
      }
    } catch (error) {
      setSaveState({
        saving: false,
        message: '',
        error: error instanceof Error ? error.message : 'Failed to update appointment'
      });
      pushToast('error', error instanceof Error ? error.message : 'Failed to update appointment');
    } finally {
      setBoardInteraction(null);
      suppressBoardClickRef.current = Date.now() + 200;
    }
  }, [applyPatchedAppointmentToState, boardInteraction, patchAppointmentRequest, pushToast, state.events]);

  useEffect(() => {
    function onMouseMove(event) {
      if (!boardDragRef.current) return;
      updateBoardInteractionFromPointer(event.clientX, event.clientY);
    }

    function onMouseUp() {
      if (!boardDragRef.current) return;
      commitBoardInteraction();
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [commitBoardInteraction, updateBoardInteractionFromPointer]);

  const startBoardMove = useCallback(
    (event, artistId, mouseEvent) => {
      mouseEvent.stopPropagation();
      mouseEvent.preventDefault();
      const columnEl = boardColumnsRef.current[artistId];
      if (!columnEl) return;
      const rect = columnEl.getBoundingClientRect();
      const pointerY = clamp(mouseEvent.clientY - rect.top, 0, totalBoardHeight);
      const { top, height } = getBoardCardStyle(event, boardDate, studioTimezone);
      const pointerOffsetMinutes = ((pointerY - top) / BOARD_HOUR_HEIGHT) * 60;
      const durationMinutes = Math.max(
        BOARD_SNAP_MINUTES,
        Math.round((DateTime.fromISO(event.end, { zone: 'utc' }).diff(DateTime.fromISO(event.start, { zone: 'utc' }), 'minutes').minutes || 0))
      );

      boardDragRef.current = {
        mode: 'move',
        appointmentId: event.id,
        artistId,
        durationMinutes,
        pointerOffsetMinutes: clamp(pointerOffsetMinutes, 0, (height / BOARD_HOUR_HEIGHT) * 60)
      };
      setCreateDraft(null);
      setSlotActionMenu(null);
      setBookingActionMenu(null);
      setBoardHoverTime(null);
      setBlockedDraft(null);
      setActiveEventId(event.id);
      setBoardInteraction({
        mode: 'move',
        appointmentId: event.id,
        artistId,
        startAt: event.start,
        endAt: event.end
      });
      suppressBoardClickRef.current = Date.now() + 200;
    },
    [boardDate, studioTimezone, totalBoardHeight]
  );

  const startBoardResize = useCallback(
    (event, artistId, mouseEvent) => {
      mouseEvent.stopPropagation();
      mouseEvent.preventDefault();
      const startLocal = DateTime.fromISO(event.start, { zone: 'utc' }).setZone(studioTimezone);
      const startMinutes = startLocal.hour * 60 + startLocal.minute - BOARD_START_HOUR * 60;

      boardDragRef.current = {
        mode: 'resize',
        appointmentId: event.id,
        artistId,
        startMinutes
      };
      setCreateDraft(null);
      setSlotActionMenu(null);
      setBookingActionMenu(null);
      setBoardHoverTime(null);
      setBlockedDraft(null);
      setActiveEventId(event.id);
      setBoardInteraction({
        mode: 'resize',
        appointmentId: event.id,
        artistId,
        startAt: event.start,
        endAt: event.end
      });
      suppressBoardClickRef.current = Date.now() + 200;
    },
    [studioTimezone]
  );

  function getEventBorderColor(status) {
    switch (status) {
      case 'pending_deposit':
        return '#f7b955';
      case 'confirmed':
        return '#6bd39d';
      case 'cancelled':
      case 'no_show':
        return '#ef8f8f';
      default:
        return '#9bb0ff';
    }
  }

  return (
    <section style={{ display: 'grid', gap: '0.7rem', minHeight: 'calc(100vh - 130px)' }}>
      {toasts.length ? (
        <div
          style={{
            position: 'fixed',
            top: 16,
            right: 16,
            zIndex: 60,
            display: 'grid',
            gap: '0.45rem',
            width: 'min(360px, calc(100vw - 32px))'
          }}
        >
          {toasts.map((toast) => (
            <div
              key={toast.id}
              style={{
                border: `1px solid ${
                  toast.type === 'error' ? '#ef8f8f' : toast.type === 'success' ? '#6bd39d' : '#7dd3fc'
                }`,
                background: 'rgba(16,12,12,0.96)',
                borderRadius: 10,
                padding: '0.6rem 0.75rem',
                boxShadow: '0 8px 26px rgba(0,0,0,0.25)'
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'capitalize', opacity: 0.9 }}>{toast.type}</div>
              <div style={{ fontSize: 13, opacity: 0.9 }}>{toast.message}</div>
            </div>
          ))}
        </div>
      ) : null}

      <article style={{ border: '1px solid #2e2e2e', borderRadius: 12, padding: '0.75rem', background: 'rgba(0,0,0,0.16)' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
          {[
            { id: 'studio_day', label: 'Day' },
            { id: 'artist_week', label: 'Week' },
            { id: 'artist_month', label: 'Month' }
          ].map((view) => (
            <button
              key={view.id}
              type="button"
              onClick={() => selectView(view.id)}
              style={{
                border: activeView === view.id ? '1px solid #ff6047' : '1px solid #333',
                background: activeView === view.id ? 'rgba(255,96,71,0.12)' : 'transparent',
                color: 'inherit',
                borderRadius: 999,
                padding: '0.35rem 0.7rem',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              {view.label}
            </button>
          ))}
        </div>

        {artistState.loading ? <p style={{ margin: '0 0 0.5rem', opacity: 0.7, fontSize: 13 }}>Loading artists...</p> : null}
        {artistState.error ? <p style={{ margin: '0 0 0.5rem', color: '#ffb4b4', fontSize: 13 }}>Artist load error: {artistState.error}</p> : null}

        {activeView !== 'studio_day' ? (
          <div
            style={{
              border: '1px solid #2f2f2f',
              borderRadius: 12,
              padding: '0.5rem',
              background: 'rgba(0,0,0,0.18)',
              overflow: 'hidden'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              <select
                value={selectedArtistId || ''}
                onChange={(e) => setSelectedArtistId(e.target.value)}
                style={{
                  border: '1px solid #334',
                  background: 'rgba(255,255,255,0.02)',
                  color: 'inherit',
                  borderRadius: 10,
                  padding: '0.45rem 0.65rem',
                  fontSize: 14,
                  minWidth: 240
                }}
              >
                <option value="">Select artist...</option>
                {artistState.artists.map((artist) => (
                  <option key={artist.id} value={artist.id}>
                    {artist.displayName}
                  </option>
                ))}
              </select>
            </div>
            {!selectedArtistId ? (
              <p style={{ margin: '0.5rem', color: '#f7b955' }}>Select an artist to use Artist Week/Month views.</p>
            ) : null}
            {selectedArtistId ? (
              <FullCalendar
            ref={calendarRef}
            key={`${activeView}-${selectedArtistId || 'none'}`}
            plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin, luxon3Plugin]}
            initialView={plannerCalendarView}
            firstDay={1}
            height="auto"
            timeZone={studioTimezone}
            nowIndicator
            editable
            eventStartEditable
            eventDurationEditable
            allDaySlot={false}
            slotMinTime="08:00:00"
            slotMaxTime="22:00:00"
            businessHours={{
              daysOfWeek: [1, 2, 3, 4, 5, 6],
              startTime: '10:00',
              endTime: '18:00'
            }}
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: ''
            }}
            eventTimeFormat={{
              hour: 'numeric',
              minute: '2-digit',
              meridiem: 'short'
            }}
            events={loadEventsForRange}
            eventClick={(info) => {
              setActiveEventId(info.event.id);
            }}
            eventDrop={(info) => {
              patchCalendarAppointment({ event: info.event, revert: info.revert });
            }}
            eventResize={(info) => {
              patchCalendarAppointment({ event: info.event, revert: info.revert });
            }}
            eventDidMount={(info) => {
              const status = info.event.extendedProps?.status;
              const border = getEventBorderColor(status);
              info.el.style.border = `1px solid ${border}`;
              info.el.style.background = 'rgba(255,255,255,0.04)';
              info.el.style.boxShadow = 'inset 0 0 0 1px rgba(255,255,255,0.02)';
            }}
            slotLaneDidMount={(arg) => {
              const hour = arg.date.getHours();
              if (hour < 10 || hour >= 18) {
                arg.el.style.background =
                  'repeating-linear-gradient(135deg, rgba(255,255,255,0.02), rgba(255,255,255,0.02) 6px, rgba(255,255,255,0.035) 6px, rgba(255,255,255,0.035) 12px)';
              }
            }}
            eventContent={(arg) => {
              const props = arg.event.extendedProps || {};
              const border = getEventBorderColor(props.status);
              if (arg.view.type.startsWith('dayGrid')) {
                return (
                  <div style={{ borderLeft: `3px solid ${border}`, padding: '0.15rem 0.2rem' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.1 }}>{arg.event.title.split(' • ')[0]}</div>
                    <div style={{ fontSize: 10, opacity: 0.8 }}>{props.serviceName || 'Appointment'}</div>
                  </div>
                );
              }
              const hasDeposit = Number(props.depositRequiredAmount || 0) > 0;
              const paid = Number(props.depositPaidAmount || 0);
              const required = Number(props.depositRequiredAmount || 0);
              const serviceName = props.serviceName || arg.event.title;
              const striped = shouldStripeAppointmentCard(props);

              return (
                <div
                  style={{
                    borderLeft: `3px solid ${border}`,
                    padding: '0.2rem 0.3rem',
                    minHeight: '100%',
                    background: striped
                      ? 'repeating-linear-gradient(135deg, rgba(247,185,85,0.12), rgba(247,185,85,0.12) 8px, rgba(255,255,255,0.02) 8px, rgba(255,255,255,0.02) 16px)'
                      : hasDeposit
                        ? 'linear-gradient(135deg, rgba(247,185,85,0.09), rgba(255,255,255,0.02))'
                        : 'linear-gradient(135deg, rgba(107,211,157,0.06), rgba(255,255,255,0.02))'
                  }}
                >
                  <div style={{ fontSize: 11, opacity: 0.9, marginBottom: 2 }}>{arg.timeText}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.15, whiteSpace: 'normal' }}>
                    {arg.event.title.split(' • ')[0]}
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.9, lineHeight: 1.15, whiteSpace: 'normal' }}>{serviceName}</div>
                  <div style={{ fontSize: 10, opacity: 0.8, marginTop: 2 }}>
                    {getStatusDisplayLabel(props.status)}
                    {hasDeposit ? ` • ${paid}/${required} AUD` : ''}
                  </div>
                </div>
              );
            }}
              />
            ) : null}
          </div>
        ) : null}

        {noRosteredArtistsForBoardDay ? (
          <div
            style={{
              marginTop: '0.5rem',
              border: '1px solid #6b7280',
              background: 'rgba(107,114,128,0.08)',
              color: '#d1d5db',
              borderRadius: 10,
              padding: '0.6rem 0.75rem',
              fontSize: 13
            }}
          >
            No artists are rostered for this day. Select an individual artist from the dropdown if you need to book on a day off.
          </div>
        ) : null}

        {activeView === 'studio_day' ? (
        <div style={{ marginTop: '0.35rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              flexWrap: 'wrap',
              marginBottom: '0.75rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <select
                value={selectedArtistId || '__ALL_ROSTERED__'}
                onChange={(e) => {
                  const next = e.target.value;
                  if (next === '__ALL_ROSTERED__') {
                    setSelectedArtistId('');
                    return;
                  }
                  setSelectedArtistId(next);
                }}
                style={{
                  border: '1px solid #333',
                  background: '#111',
                  color: 'inherit',
                  borderRadius: 999,
                  padding: '0.35rem 0.75rem',
                  fontSize: 14,
                  minWidth: 240,
                  maxWidth: 320
                }}
                title="Artist filter"
              >
                <option value="__ALL_ROSTERED__">{`All rostered artists (${visibleArtists.length})`}</option>
                {artistState.artists.map((artist) => {
                  const isRosteredToday = rosteredArtistIdsForBoardDay.has(artist.id);
                  return (
                    <option key={artist.id} value={artist.id}>
                      {artist.displayName}
                      {!isRosteredToday ? ' (off today)' : ''}
                    </option>
                  );
                })}
              </select>
              <button
                type="button"
                onClick={() => setBoardDate((prev) => DateTime.fromISO(prev).minus({ days: 1 }).toISODate())}
                style={{
                  border: '1px solid #333',
                  background: 'transparent',
                  color: 'inherit',
                  borderRadius: 999,
                  padding: '0.35rem 0.65rem',
                  cursor: 'pointer'
                }}
              >
                Prev Day
              </button>
              <button
                type="button"
                onClick={() => setBoardDate(DateTime.now().setZone(studioTimezone).toISODate())}
                style={{
                  border: '1px solid #333',
                  background: 'transparent',
                  color: 'inherit',
                  borderRadius: 999,
                  padding: '0.35rem 0.65rem',
                  cursor: 'pointer'
                }}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setBoardDate((prev) => DateTime.fromISO(prev).plus({ days: 1 }).toISODate())}
                style={{
                  border: '1px solid #333',
                  background: 'transparent',
                  color: 'inherit',
                  borderRadius: 999,
                  padding: '0.35rem 0.65rem',
                  cursor: 'pointer'
                }}
              >
                Next Day
              </button>
              <input
                type="date"
                value={boardDate}
                onChange={(e) => setBoardDate(e.target.value)}
                style={{
                  border: '1px solid #333',
                  background: '#111',
                  color: 'inherit',
                  borderRadius: 8,
                  padding: '0.35rem 0.5rem'
                }}
              />
            </div>
          </div>

          <p style={{ margin: '0 0 0.55rem', opacity: 0.82, fontSize: 13 }}>
            {formatStudioDateLabel(boardDate, studioTimezone)} | {selectedArtistId ? 'Single artist focus' : 'All rostered staff'}
          </p>
          {blockState.loading ? <p style={{ margin: '0 0 0.5rem', fontSize: 13, opacity: 0.7 }}>Loading availability blocks...</p> : null}
          {blockState.warning ? <p style={{ margin: '0 0 0.5rem', fontSize: 13, color: '#f7b955' }}>{blockState.warning}</p> : null}
          {blockState.error ? <p style={{ margin: '0 0 0.5rem', fontSize: 13, color: '#ffb4b4' }}>{blockState.error}</p> : null}

          <div style={{ overflowX: 'auto' }}>
            <div
              style={{
                minWidth: Math.max(420, 84 + visibleArtists.length * 220),
                display: 'grid',
                gridTemplateColumns: `${BOARD_TIME_GUTTER_WIDTH}px repeat(${Math.max(visibleArtists.length, 1)}, minmax(220px, 1fr))`,
                gridTemplateRows: '44px auto',
                border: '1px solid #2f2f2f',
                borderRadius: 12,
                overflow: 'hidden',
                background: 'rgba(0,0,0,0.15)'
              }}
            >
              <div
                style={{
                  borderRight: '1px solid #2f2f2f',
                  borderBottom: '1px solid #2f2f2f',
                  background: 'rgba(255,255,255,0.02)'
                }}
              />

              {(visibleArtists.length ? visibleArtists : [{ id: 'none', displayName: 'No artists' }]).map((artist) => (
                <div
                  key={artist.id}
                  style={{
                    borderRight: '1px solid #2f2f2f',
                    borderBottom: '1px solid #2f2f2f',
                    padding: '0.5rem 0.6rem',
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.005))'
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{artist.displayName}</div>
                  <div style={{ fontSize: 11, opacity: 0.7 }}>
                    {boardEvents.filter((event) => event.extendedProps?.artistId === artist.id).length} booking(s)
                  </div>
                </div>
              ))}

              <div
                style={{
                  position: 'relative',
                  height: totalBoardHeight,
                  borderRight: '1px solid #2f2f2f',
                  background: 'rgba(255,255,255,0.01)'
                }}
              >
                {Array.from({ length: BOARD_END_HOUR - BOARD_START_HOUR + 1 }).map((_, idx) => {
                  const hour = BOARD_START_HOUR + idx;
                  const top = idx * BOARD_HOUR_HEIGHT;
                  if (hour > BOARD_END_HOUR) return null;
                  return (
                    <div key={hour}>
                      <div
                        style={{
                          position: 'absolute',
                          top,
                          left: 0,
                          right: 0,
                          borderTop: '1px solid rgba(255,255,255,0.15)'
                        }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          top: Math.min(top + 6, totalBoardHeight - 16),
                        left: 12,
                          fontSize: 12,
                          opacity: 0.9
                        }}
                      >
                        {DateTime.fromObject({ hour }, { zone: studioTimezone }).toFormat('ha').toLowerCase()}
                      </div>
                    </div>
                  );
                })}
                {showNowLine && nowLineTop != null ? (
                  <>
                    <div
                      style={{
                        position: 'absolute',
                        top: Math.max(0, Math.min(totalBoardHeight - 1, nowLineTop)),
                        left: 0,
                        right: 0,
                        borderTop: '2px solid #ff3b30',
                        zIndex: 4
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        top: Math.max(4, Math.min(totalBoardHeight - 22, nowLineTop - 10)),
                        left: 44,
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#ffd1cd',
                        background: 'rgba(255,59,48,0.15)',
                        border: '1px solid rgba(255,59,48,0.6)',
                        borderRadius: 999,
                        padding: '0.1rem 0.35rem',
                        zIndex: 5
                      }}
                    >
                      {nowLineLabel}
                    </div>
                  </>
                ) : null}
              </div>

              {(visibleArtists.length ? visibleArtists : [{ id: 'none', displayName: 'No artists' }]).map((artist) => {
                const artistEvents = boardEvents.filter((event) => event.extendedProps?.artistId === artist.id);
                const artistBlocks = boardBlocks.filter((block) => block.artistId === artist.id);
                const artistWeeklyAvailability = weeklyAvailabilityState.byArtistId?.[artist.id] || [];
                const availabilityWindow = getArtistAvailabilityBoardWindow(artistWeeklyAvailability, boardDayOfWeek);
                const availabilityTopPx = (availabilityWindow.startMinutes / 60) * BOARD_HOUR_HEIGHT;
                const availabilityBottomPx = (availabilityWindow.endMinutes / 60) * BOARD_HOUR_HEIGHT;
                const hasTopShade = availabilityTopPx > 0;
                const hasBottomShade = availabilityBottomPx < totalBoardHeight;
                const hasNoAvailability =
                  availabilityWindow.startMinutes >= availabilityWindow.endMinutes &&
                  availabilityWindow.source === 'weekly_availability';
                return (
                  <div
                    key={`${artist.id}-column`}
                    ref={(el) => {
                      boardColumnsRef.current[artist.id] = el;
                    }}
                    onMouseMove={(e) => {
                      if (boardDragRef.current) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const y = clamp(e.clientY - rect.top, 0, totalBoardHeight);
                      const minutes = clampBoardMinutes(snapMinutes((y / BOARD_HOUR_HEIGHT) * 60));
                      setBoardHoverTime((prev) => {
                        if (prev && prev.artistId === artist.id && prev.minutesFromStart === minutes) return prev;
                        return { artistId: artist.id, minutesFromStart: minutes };
                      });
                    }}
                    onMouseLeave={() => {
                      setBoardHoverTime((prev) => (prev?.artistId === artist.id ? null : prev));
                    }}
                    onClick={(e) => {
                      if (Date.now() < suppressBoardClickRef.current) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const y = e.clientY - rect.top;
                      const minutes = (y / BOARD_HOUR_HEIGHT) * 60;
                      const draftBase = {
                        artistId: artist.id,
                        boardDate,
                        minutesFromStart: minutes,
                        timezone: studioTimezone
                      };
                      setSlotActionMenu({
                        x: e.clientX,
                        y: e.clientY,
                        artistId: artist.id,
                        minutesFromStart: minutes,
                        appointmentDraft: buildCreateDraft(draftBase),
                        blockedDraft: buildBlockedTimeDraft(draftBase)
                      });
                      closeDetailsPanel();
                      setCreateDraft(null);
                      setBlockedDraft(null);
                    }}
                    style={{
                      position: 'relative',
                      height: totalBoardHeight,
                      borderRight: '1px solid #2f2f2f',
                      background: 'rgba(255,255,255,0.005)'
                    }}
                    >
                    {showNowLine && nowLineTop != null ? (
                      <>
                        <div
                          style={{
                            position: 'absolute',
                            top: Math.max(0, Math.min(totalBoardHeight - 1, nowLineTop)),
                            left: 0,
                            right: 0,
                            borderTop: '2px solid #ff3b30',
                            zIndex: 4,
                            pointerEvents: 'none'
                          }}
                        />
                        <div
                          style={{
                            position: 'absolute',
                            top: Math.max(0, Math.min(totalBoardHeight - 10, nowLineTop - 4)),
                            left: -1,
                            width: 0,
                            height: 0,
                            borderTop: '6px solid transparent',
                            borderBottom: '6px solid transparent',
                            borderLeft: '8px solid #ff3b30',
                            zIndex: 5,
                            pointerEvents: 'none'
                          }}
                        />
                      </>
                    ) : null}
                    {hasNoAvailability ? (
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: totalBoardHeight,
                          background: BOARD_UNAVAILABLE_OVERLAY,
                          zIndex: 0,
                          pointerEvents: 'none'
                        }}
                      />
                    ) : (
                      <>
                        {hasTopShade ? (
                          <div
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              height: availabilityTopPx,
                              background: BOARD_UNAVAILABLE_OVERLAY,
                              zIndex: 0,
                              pointerEvents: 'none'
                            }}
                          />
                        ) : null}
                        {hasBottomShade ? (
                          <div
                            style={{
                              position: 'absolute',
                              top: availabilityBottomPx,
                              left: 0,
                              right: 0,
                              height: Math.max(totalBoardHeight - availabilityBottomPx, 0),
                              background: BOARD_UNAVAILABLE_OVERLAY,
                              zIndex: 0,
                              pointerEvents: 'none'
                            }}
                          />
                        ) : null}
                      </>
                    )}
                    {Array.from({ length: BOARD_END_HOUR - BOARD_START_HOUR }).map((_, idx) => {
                      const top = idx * BOARD_HOUR_HEIGHT;
                      const hour = BOARD_START_HOUR + idx;
                      return (
                        <div key={`${artist.id}-slot-${hour}`}>
                          <div
                            style={{
                              position: 'absolute',
                              top,
                              left: 0,
                              right: 0,
                              height: BOARD_HOUR_HEIGHT,
                              background: 'transparent'
                            }}
                          />
                          <div
                            style={{
                              position: 'absolute',
                              top,
                              left: 0,
                              right: 0,
                              borderTop: '1px solid rgba(255,255,255,0.14)'
                            }}
                          />
                          <div
                            style={{
                              position: 'absolute',
                              top: top + BOARD_HOUR_HEIGHT / 2,
                              left: 0,
                              right: 0,
                              borderTop: '1px dotted rgba(255,255,255,0.12)'
                            }}
                          />
                        </div>
                      );
                    })}

                    {boardHoverTime && boardHoverTime.artistId === artist.id && !boardInteraction && !boardHoveredCardId ? (() => {
                      const top = Math.max(2, Math.min(totalBoardHeight - 30, (boardHoverTime.minutesFromStart / 60) * BOARD_HOUR_HEIGHT - 14));
                      const label = boardMinutesToDateTime(boardDate, boardHoverTime.minutesFromStart, studioTimezone)
                        .toFormat('h:mma')
                        .toLowerCase();
                      return (
                        <div
                          style={{
                            position: 'absolute',
                            top,
                            left: 6,
                            right: 6,
                            height: 26,
                            borderRadius: 8,
                            border: '1px solid rgba(139, 127, 255, 0.55)',
                            background: 'rgba(173, 166, 255, 0.12)',
                            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)',
                            color: '#8f84ff',
                            fontWeight: 700,
                            fontSize: 12,
                            display: 'flex',
                            alignItems: 'center',
                            padding: '0 0.65rem',
                            pointerEvents: 'none',
                            zIndex: 2
                          }}
                        >
                          {label}
                        </div>
                      );
                    })() : null}

                    {artistBlocks.map((block) => {
                      const { top, height } = getBoardRangeStyle(block.startAt, block.endAt, boardDate, studioTimezone);
                      const border = block.colorHex || '#94a3b8';
                      const label = block.label || String(block.blockType || 'blocked').replace(/_/g, ' ');

                      return (
                        <div
                          key={block.id}
                          style={{
                            position: 'absolute',
                            top: top + 2,
                            left: 4,
                            right: 4,
                            height: Math.max(height - 4, 22),
                            borderRadius: 8,
                            border: `1px solid ${border}`,
                            background: blockOverlayBackground(block),
                            padding: '0.22rem 0.3rem',
                            overflow: 'hidden',
                            zIndex: 1,
                            pointerEvents: 'none'
                          }}
                          title={`${label}${block.note ? ` - ${block.note}` : ''}`}
                        >
                          <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.9, textTransform: 'uppercase' }}>{label}</div>
                          {block.note ? (
                            <div
                              style={{
                                fontSize: 10,
                                opacity: 0.75,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}
                            >
                              {block.note}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}

                    {boardInteraction && boardInteraction.artistId === artist.id ? (() => {
                      const previewEvent = {
                        start: boardInteraction.startAt,
                        end: boardInteraction.endAt,
                        extendedProps: { status: 'requested', depositRequiredAmount: 0, depositPaidAmount: 0 }
                      };
                      const { top, height } = getBoardCardStyle(previewEvent, boardDate, studioTimezone);
                      return (
                        <div
                          style={{
                            position: 'absolute',
                            top: top + 2,
                            left: 4,
                            right: 4,
                            height: Math.max(height - 4, 24),
                            borderRadius: 8,
                            border: '1px dashed #7dd3fc',
                            background: 'rgba(125,211,252,0.08)',
                            zIndex: 3,
                            pointerEvents: 'none',
                            padding: '0.25rem 0.35rem'
                          }}
                        >
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#bae6fd' }}>
                            {boardInteraction.mode === 'resize' ? 'Resize Preview' : 'Move Preview'}
                          </div>
                          <div style={{ fontSize: 10, opacity: 0.85 }}>
                            {formatInTimezone(boardInteraction.startAt, studioTimezone).split(', ').slice(-1)[0]} -{' '}
                            {formatInTimezone(boardInteraction.endAt, studioTimezone).split(', ').slice(-1)[0]}
                          </div>
                        </div>
                      );
                    })() : null}

                    {artistEvents.map((event) => {
                      const { top, height } = getBoardCardStyle(event, boardDate, studioTimezone);
                      const border = statusColor(event.extendedProps?.status);
                      const paid = Number(event.extendedProps?.depositPaidAmount || 0);
                      const required = Number(event.extendedProps?.depositRequiredAmount || 0);
                      const startLabel = formatInTimezone(event.start, studioTimezone).split(', ').slice(-1)[0];
                      const endLabel = formatInTimezone(event.end, studioTimezone).split(', ').slice(-1)[0];
                      const clientName = event.title.split(' • ')[0];
                      const serviceName = event.extendedProps?.serviceName || event.title;
                      const iconBadges = getAppointmentIconBadges(event.extendedProps);

                      return (
                        <button
                          key={event.id}
                          type="button"
                          onMouseEnter={(e) => {
                            if (boardInteraction || boardDragRef.current) return;
                            setBoardHoveredCardId(event.id);
                            if (boardCardHoverTimerRef.current) {
                              window.clearTimeout(boardCardHoverTimerRef.current);
                            }
                            const rect = e.currentTarget.getBoundingClientRect();
                            boardCardHoverTimerRef.current = window.setTimeout(() => {
                              setBoardCardHoverPreview({
                                eventId: event.id,
                                x: rect.right,
                                y: rect.top,
                                clientName,
                                serviceName,
                                artistName: artist.displayName || event.extendedProps?.artistName || 'Artist',
                                timeRange: `${startLabel} - ${endLabel}`,
                                phone: event.extendedProps?.phoneE164 || '',
                                statusLabel: getStatusDisplayLabel(event.extendedProps?.status),
                                depositPaid: paid,
                                depositRequired: required,
                                designBrief: String(event.extendedProps?.designBrief || '').trim(),
                                internalNotes: String(event.extendedProps?.internalNotes || '').trim(),
                                paymentStateLabel: getDepositPaymentState(event.extendedProps).label
                              });
                              boardCardHoverTimerRef.current = null;
                            }, 140);
                          }}
                          onMouseLeave={() => {
                            setBoardHoveredCardId((prev) => (prev === event.id ? '' : prev));
                            if (boardCardHoverTimerRef.current) {
                              window.clearTimeout(boardCardHoverTimerRef.current);
                              boardCardHoverTimerRef.current = null;
                            }
                            setBoardCardHoverPreview((prev) => (prev?.eventId === event.id ? null : prev));
                            setBoardIconTooltip((prev) => (prev?.eventId === event.id ? null : prev));
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (Date.now() < suppressBoardClickRef.current) return;
                            if (isCreateDirty && !confirmDiscard('appointment')) return;
                            if (isBlockedDirty && !confirmDiscard('blocked time')) return;
                            setActiveEventId(event.id);
                            const rect = e.currentTarget.getBoundingClientRect();
                            setBookingActionMenu({
                              eventId: event.id,
                              x: rect.right,
                              y: rect.top,
                              artistName: artist.displayName || event.extendedProps?.artistName || 'Artist'
                            });
                            setCreateDraft(null);
                            createDraftBaseRef.current = null;
                            setBlockedDraft(null);
                            blockedDraftBaseRef.current = null;
                            setBoardCardHoverPreview(null);
                            setBoardIconTooltip(null);
                          }}
                          onMouseDown={(e) => {
                            if (boardCardHoverTimerRef.current) {
                              window.clearTimeout(boardCardHoverTimerRef.current);
                              boardCardHoverTimerRef.current = null;
                            }
                            setBoardCardHoverPreview(null);
                            setBoardIconTooltip(null);
                            setBoardHoveredCardId('');
                            startBoardMove(event, artist.id, e);
                          }}
                          style={{
                            position: 'absolute',
                            top: top + 2,
                            left: 4,
                            right: 4,
                            height: Math.max(height - 4, 24),
                            borderRadius: 8,
                            border: `1px solid ${border}`,
                            borderLeftWidth: 3,
                            background: boardCardBackground(event),
                            color: 'inherit',
                            textAlign: 'left',
                            padding: '0.3rem 0.35rem',
                            cursor: 'pointer',
                            overflow: 'hidden',
                            zIndex: boardHoveredCardId === event.id ? 6 : 2,
                            display: 'block',
                            transform: boardHoveredCardId === event.id ? 'translateY(-1px) scale(1.01)' : 'none',
                            boxShadow:
                              boardHoveredCardId === event.id
                                ? `0 8px 20px rgba(0,0,0,0.35), 0 0 0 1px ${border}22`
                                : 'none',
                            transition: 'transform 120ms ease, box-shadow 120ms ease'
                          }}
                        >
                          {iconBadges.length ? (
                            <div
                              style={{
                                position: 'absolute',
                                top: 4,
                                right: 5,
                                display: 'flex',
                                gap: 4,
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                justifyContent: 'flex-end',
                                maxWidth: '70%'
                              }}
                            >
                              {iconBadges.map((badge) => (
                                <div
                                  key={badge.key}
                                  onMouseEnter={(e) => {
                                    e.stopPropagation();
                                    if (boardCardHoverTimerRef.current) {
                                      window.clearTimeout(boardCardHoverTimerRef.current);
                                      boardCardHoverTimerRef.current = null;
                                    }
                                    setBoardCardHoverPreview((prev) => (prev?.eventId === event.id ? null : prev));
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setBoardIconTooltip({
                                      eventId: event.id,
                                      text: badge.title,
                                      x: rect.left + rect.width / 2,
                                      y: rect.top
                                    });
                                  }}
                                  onMouseLeave={(e) => {
                                    e.stopPropagation();
                                    setBoardIconTooltip((prev) =>
                                      prev?.eventId === event.id && prev?.text === badge.title ? null : prev
                                    );
                                  }}
                                  style={{
                                    minWidth: 18,
                                    height: 18,
                                    borderRadius: 999,
                                    border: `1px solid ${badge.tone}`,
                                    background: `${badge.tone}14`,
                                    color: badge.tone,
                                  display: 'grid',
                                  placeItems: 'center',
                                  fontSize: 10,
                                  fontWeight: 700,
                                  lineHeight: 1
                                  }}
                                >
                                  {badge.icon}
                                </div>
                              ))}
                            </div>
                          ) : null}
                          <div
                            style={{
                              position: 'absolute',
                              top: 6,
                              left: 6,
                              right: iconBadges.length ? 74 : 6,
                              display: 'grid',
                              gap: 1,
                              alignContent: 'start',
                              justifyItems: 'start'
                            }}
                          >
                            <div style={{ fontSize: 11, opacity: 0.9, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {startLabel} - {endLabel}
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                              {clientName}
                            </div>
                            <div style={{ fontSize: 11, opacity: 0.9, lineHeight: 1.1, whiteSpace: 'normal', textWrap: 'balance' }}>{serviceName}</div>
                            <div style={{ fontSize: 10, opacity: 0.85, marginTop: 1 }}>
                              {getStatusDisplayLabel(event.extendedProps?.status)}
                              {required > 0 ? ` • ${paid}/${required} AUD` : ''}
                            </div>
                          </div>
                          <div
                            onMouseDown={(e) => startBoardResize(event, artist.id, e)}
                            style={{
                              position: 'absolute',
                              left: 4,
                              right: 4,
                              bottom: 2,
                              height: 6,
                              borderRadius: 999,
                              background: 'rgba(255,255,255,0.22)',
                              cursor: 'ns-resize'
                            }}
                            title="Resize appointment"
                          />
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        ) : null}

        {state.loading ? <p style={{ margin: 0 }}>Loading events...</p> : null}
        {state.error ? <p style={{ margin: 0, color: '#ffb4b4' }}>Error: {state.error}</p> : null}
        {saveState.saving ? <p style={{ margin: 0, opacity: 0.8 }}>Saving appointment move...</p> : null}
        {saveState.message ? <p style={{ margin: 0, color: '#9de6c1' }}>{saveState.message}</p> : null}
        {saveState.error ? <p style={{ margin: 0, color: '#ffb4b4' }}>{saveState.error}</p> : null}
        {!state.loading && !state.error ? (
          <p style={{ margin: 0, opacity: 0.7, fontSize: 13 }}>
            Viewing: {selectedArtistId ? 'Single artist' : 'All rostered staff'}
          </p>
        ) : null}

        {!state.loading && !state.error && state.events.length === 0 ? (
          <p style={{ margin: 0, opacity: 0.8 }}>No appointments found in this range.</p>
        ) : null}

        {slotActionMenu ? (
          <div
            style={{
              position: 'fixed',
              left: Math.min(slotActionMenu.x + 10, (typeof window !== 'undefined' ? window.innerWidth : 1400) - 320),
              top: Math.max(16, slotActionMenu.y - 20),
              width: 300,
              zIndex: 45,
              border: '1px solid #3a2b2b',
              borderRadius: 14,
              background: 'linear-gradient(180deg, rgba(26,20,20,0.98), rgba(15,12,12,0.98))',
              boxShadow: '0 14px 40px rgba(0,0,0,0.35)',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                padding: '0.8rem 0.9rem',
                borderBottom: '1px solid #2d2222',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>
                  {DateTime.fromFormat(slotActionMenu.appointmentDraft.startAtLocal, "yyyy-LL-dd'T'HH:mm", {
                    zone: studioTimezone
                  }).toFormat('h:mma').toLowerCase()}
                </div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>
                  {artistState.artists.find((a) => a.id === slotActionMenu.artistId)?.displayName || 'Artist'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSlotActionMenu(null)}
                style={{ border: '1px solid #333', background: 'transparent', color: 'inherit', borderRadius: 999, padding: '0.2rem 0.5rem', cursor: 'pointer' }}
              >
                X
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                createDraftBaseRef.current = slotActionMenu.appointmentDraft;
                setCreateDraft(slotActionMenu.appointmentDraft);
                setBlockedDraft(null);
                blockedDraftBaseRef.current = null;
                setSlotActionMenu(null);
              }}
              style={{ width: '100%', textAlign: 'left', padding: '0.9rem', border: 'none', borderBottom: '1px solid #2d2222', background: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: 15 }}
            >
              Add appointment
            </button>
            <button
              type="button"
              onClick={() => {
                blockedDraftBaseRef.current = slotActionMenu.blockedDraft;
                setBlockedDraft(slotActionMenu.blockedDraft);
                setCreateDraft(null);
                createDraftBaseRef.current = null;
                setSlotActionMenu(null);
              }}
              style={{ width: '100%', textAlign: 'left', padding: '0.9rem', border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: 15 }}
            >
              Add blocked time
            </button>
          </div>
        ) : null}

        {boardCardHoverPreview && !boardInteraction ? (
          <div
            style={{
              position: 'fixed',
              left: Math.min(
                boardCardHoverPreview.x + 10,
                (typeof window !== 'undefined' ? window.innerWidth : 1400) - 360
              ),
              top: Math.max(16, boardCardHoverPreview.y),
              width: 340,
              zIndex: 44,
              border: '1px solid #3a3a3a',
              borderRadius: 14,
              background: 'linear-gradient(180deg, rgba(24,24,26,0.97), rgba(18,18,20,0.97))',
              boxShadow: '0 14px 38px rgba(0,0,0,0.35)',
              overflow: 'hidden',
              pointerEvents: 'none'
            }}
          >
            <div
              style={{
                padding: '0.75rem 0.85rem',
                borderBottom: '1px solid #2d2d2d',
                background: 'rgba(125,133,255,0.08)',
                display: 'flex',
                justifyContent: 'space-between',
                gap: '0.75rem',
                alignItems: 'baseline'
              }}
            >
              <div style={{ fontWeight: 700 }}>{boardCardHoverPreview.timeRange}</div>
              <div style={{ fontSize: 12, opacity: 0.85 }}>{boardCardHoverPreview.statusLabel}</div>
            </div>
            <div style={{ padding: '0.8rem 0.85rem', display: 'grid', gap: '0.45rem' }}>
              <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.15 }}>{boardCardHoverPreview.clientName}</div>
              {boardCardHoverPreview.phone ? (
                <div style={{ fontSize: 13, opacity: 0.8 }}>{boardCardHoverPreview.phone}</div>
              ) : null}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', alignItems: 'start' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{boardCardHoverPreview.serviceName}</div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>{boardCardHoverPreview.artistName}</div>
                </div>
                <div style={{ fontSize: 12, opacity: 0.8, textAlign: 'right' }}>
                  {boardCardHoverPreview.depositRequired > 0
                    ? `${boardCardHoverPreview.depositPaid}/${boardCardHoverPreview.depositRequired} AUD`
                    : boardCardHoverPreview.paymentStateLabel}
                </div>
              </div>
              {boardCardHoverPreview.designBrief ? (
                <div style={{ fontSize: 12, opacity: 0.82, lineHeight: 1.3 }}>
                  <strong style={{ color: '#f7b955' }}>Brief:</strong> {boardCardHoverPreview.designBrief}
                </div>
              ) : null}
              {boardCardHoverPreview.internalNotes ? (
                <div style={{ fontSize: 12, opacity: 0.78, lineHeight: 1.3 }}>
                  <strong style={{ color: '#9bb0ff' }}>Note:</strong> {boardCardHoverPreview.internalNotes}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {boardIconTooltip ? (
          <div
            style={{
              position: 'fixed',
              left: Math.max(
                8,
                Math.min(
                  boardIconTooltip.x - 80,
                  (typeof window !== 'undefined' ? window.innerWidth : 1400) - 168
                )
              ),
              top: Math.max(8, boardIconTooltip.y - 38),
              zIndex: 47,
              background: 'rgba(8,8,10,0.96)',
              color: '#f6f6f6',
              borderRadius: 10,
              padding: '0.35rem 0.55rem',
              fontSize: 12,
              fontWeight: 600,
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 8px 18px rgba(0,0,0,0.28)',
              pointerEvents: 'none',
              whiteSpace: 'nowrap'
            }}
          >
            {boardIconTooltip.text}
          </div>
        ) : null}

        {bookingActionMenu && selectedEventData && bookingActionMenu.eventId === selectedEventData.id ? (
          <div
            style={{
              position: 'fixed',
              left: Math.min(
                bookingActionMenu.x + 10,
                (typeof window !== 'undefined' ? window.innerWidth : 1400) - 360
              ),
              top: Math.max(16, bookingActionMenu.y - 8),
              width: 340,
              zIndex: 46,
              border: '1px solid #3a2b2b',
              borderRadius: 14,
              background: 'linear-gradient(180deg, rgba(28,22,22,0.98), rgba(15,12,12,0.98))',
              boxShadow: '0 14px 40px rgba(0,0,0,0.35)',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                padding: '0.75rem 0.85rem',
                borderBottom: '1px solid #2d2222',
                display: 'flex',
                justifyContent: 'space-between',
                gap: '0.5rem',
                alignItems: 'start'
              }}
            >
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{selectedEventData.title.split(' • ')[0]}</div>
                <div style={{ fontSize: 12, opacity: 0.78 }}>
                  {bookingActionMenu.artistName} • {formatInTimezone(selectedEventData.start, studioTimezone).split(', ').slice(-1)[0]} -{' '}
                  {formatInTimezone(selectedEventData.end, studioTimezone).split(', ').slice(-1)[0]}
                </div>
                <div style={{ fontSize: 11, opacity: 0.65 }}>
                  {selectedEventData.extendedProps?.serviceName || selectedEventData.title} • {getStatusDisplayLabel(selectedEventData.extendedProps?.status)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBookingActionMenu(null)}
                style={{ border: '1px solid #333', background: 'transparent', color: 'inherit', borderRadius: 999, padding: '0.15rem 0.5rem', cursor: 'pointer' }}
              >
                X
              </button>
            </div>

            <div style={{ padding: '0.7rem 0.85rem', display: 'grid', gap: '0.55rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setBookingActionMenu(null);
                    setDetailsDraft(buildDetailsDraftFromEvent(selectedEventData));
                    setEditDrawerOpen(true);
                  }}
                  style={{ border: '1px solid #7c85ff55', background: 'rgba(124,133,255,0.08)', color: 'inherit', borderRadius: 10, padding: '0.45rem 0.6rem', cursor: 'pointer' }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBookingActionMenu(null);
                    pushToast('info', 'Drag the booking card to reschedule, or drag the bottom handle to resize.');
                  }}
                  style={{ border: '1px solid #7c85ff55', background: 'rgba(124,133,255,0.08)', color: 'inherit', borderRadius: 10, padding: '0.45rem 0.6rem', cursor: 'pointer' }}
                >
                  Reschedule
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setBookingActionMenu(null);
                    await markAppointmentStatusQuick('checked_in');
                  }}
                  disabled={saveState.saving || selectedEventData.extendedProps?.status === 'checked_in'}
                  style={{ border: '1px solid #f7b955', background: 'rgba(247,185,85,0.1)', color: 'inherit', borderRadius: 10, padding: '0.45rem 0.6rem', cursor: saveState.saving ? 'progress' : 'pointer', opacity: selectedEventData.extendedProps?.status === 'checked_in' ? 0.55 : 1 }}
                >
                  Arrived
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setBookingActionMenu(null);
                    await markAppointmentStatusQuick('completed');
                  }}
                  disabled={saveState.saving || selectedEventData.extendedProps?.status === 'completed'}
                  style={{ border: '1px solid #6bd39d', background: 'rgba(107,211,157,0.1)', color: 'inherit', borderRadius: 10, padding: '0.45rem 0.6rem', cursor: saveState.saving ? 'progress' : 'pointer', opacity: selectedEventData.extendedProps?.status === 'completed' ? 0.55 : 1 }}
                >
                  Completed
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setBookingActionMenu(null);
                    openCheckoutDrawer();
                  }}
                  style={{ border: '1px solid #7dd3fc', background: 'rgba(125,211,252,0.1)', color: 'inherit', borderRadius: 10, padding: '0.55rem 0.7rem', cursor: 'pointer', fontWeight: 600 }}
                >
                  Checkout
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setBookingActionMenu(null);
                    await cancelAppointmentQuick();
                  }}
                  style={{ border: '1px solid #ff6047', background: 'rgba(255,96,71,0.08)', color: '#ffb7ad', borderRadius: 10, padding: '0.55rem 0.7rem', cursor: 'pointer', fontWeight: 600 }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {createDraft ? (
          <>
            <div
              onClick={() => closeCreateDrawer()}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.45)',
                backdropFilter: 'blur(2px)',
                zIndex: 40
              }}
            />
            <aside
              role="dialog"
              aria-modal="true"
              aria-label="Create appointment"
              style={{
                position: 'fixed',
                top: 0,
                right: 0,
                width: 'min(520px, 100vw)',
                height: '100vh',
                zIndex: 41,
                background: 'linear-gradient(180deg, rgba(19,14,14,0.98), rgba(13,10,10,0.98))',
                borderLeft: '1px solid #332424',
                boxShadow: '-12px 0 40px rgba(0,0,0,0.35)',
                display: 'grid',
                gridTemplateRows: 'auto 1fr auto'
              }}
            >
              <div style={{ padding: '0.9rem 1rem', borderBottom: '1px solid #2a1f1f' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'start' }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 18 }}>Add Appointment</p>
                    <p style={{ margin: '0.25rem 0 0', fontSize: 13, opacity: 0.75 }}>
                      {artistState.artists.find((artist) => artist.id === createDraft.artistId)?.displayName || 'Artist'} |{' '}
                      {createDraft.startAtLocal
                        ? DateTime.fromFormat(createDraft.startAtLocal, "yyyy-LL-dd'T'HH:mm", { zone: studioTimezone }).toFormat(
                            "ccc d LLL, h:mma"
                          )
                        : 'No time selected'}{' '}
                      ({studioTimezone})
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => closeCreateDrawer()}
                    style={{
                      border: '1px solid #333',
                      background: 'transparent',
                      color: 'inherit',
                      borderRadius: 999,
                      padding: '0.25rem 0.6rem',
                      cursor: 'pointer'
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>

              <div style={{ overflow: 'auto', padding: '0.9rem 1rem' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '0.65rem'
                  }}
                >
              <div
                style={{
                  gridColumn: '1 / -1',
                  border: '1px solid #2f2f2f',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.01)',
                  overflow: 'hidden'
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(220px, 0.95fr) minmax(260px, 1.2fr)',
                    gap: 0
                  }}
                >
                  <div style={{ padding: '0.7rem', borderRight: '1px solid #2a2a2a', display: 'grid', gap: '0.5rem' }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>Select a client</div>
                    <label style={{ display: 'grid', gap: '0.3rem' }}>
                      <span style={{ fontSize: 12, opacity: 0.75 }}>Search by name, phone or email</span>
                      <input
                        value={clientSearch.query}
                        onChange={(e) => setClientSearch((prev) => ({ ...prev, query: e.target.value }))}
                        placeholder="Search clients to autofill..."
                        style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}
                      />
                    </label>

                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => {
                          openCreateClientDrawerNew();
                        }}
                        style={{ border: '1px solid #7c85ff55', background: 'rgba(124,133,255,0.08)', color: 'inherit', borderRadius: 999, padding: '0.25rem 0.6rem', cursor: 'pointer', fontSize: 12 }}
                      >
                        Add new client
                      </button>
                    </div>

                    {clientSearch.loading ? <p style={{ margin: 0, fontSize: 12, opacity: 0.75 }}>Searching clients...</p> : null}
                    {clientSearch.error ? <p style={{ margin: 0, fontSize: 12, color: '#ffb4b4' }}>{clientSearch.error}</p> : null}

                    {clientSearch.results.length > 0 ? (
                      <div style={{ display: 'grid', gap: '0.35rem', maxHeight: 220, overflow: 'auto' }}>
                        {clientSearch.results.map((client) => (
                          <button
                            key={client.id}
                            type="button"
                            onClick={() => {
                              setCreateDraft((prev) => ({
                                ...prev,
                                selectedClientId: client.id,
                                selectedClient: client,
                                firstName: client.firstName || '',
                                lastName: client.lastName || '',
                                phoneE164: client.phoneE164 || '',
                                email: client.email || ''
                              }));
                              openCreateClientDrawerExisting(client);
                            }}
                            style={{
                              textAlign: 'left',
                              border: '1px solid #333',
                              background: 'rgba(255,255,255,0.015)',
                              color: 'inherit',
                              borderRadius: 8,
                              padding: '0.45rem 0.55rem',
                              cursor: 'pointer'
                            }}
                          >
                            <div style={{ fontSize: 13, fontWeight: 700 }}>
                              {[client.firstName, client.lastName].filter(Boolean).join(' ') || 'Unnamed client'}
                            </div>
                            <div style={{ fontSize: 12, opacity: 0.8 }}>
                              {client.phoneE164 || 'No phone'} | {client.email || 'No email'}
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, opacity: 0.65 }}>
                        {clientSearch.query.trim().length >= 2 ? 'No clients found. Add a new client below.' : 'Search or continue as a new client.'}
                      </div>
                    )}
                  </div>

                  <div style={{ padding: '0.7rem', display: 'grid', gap: '0.5rem' }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>Select a service</div>
                    <label style={{ display: 'grid', gap: '0.3rem' }}>
                      <span style={{ fontSize: 12, opacity: 0.75 }}>
                        Services for {artistState.artists.find((a) => a.id === createDraft.artistId)?.displayName || 'selected artist'}
                      </span>
                      <input
                        value={createServiceSearch}
                        onChange={(e) => setCreateServiceSearch(e.target.value)}
                        placeholder="Search service name..."
                        style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}
                      />
                    </label>
                    <div style={{ display: 'grid', gap: '0.35rem', maxHeight: 220, overflow: 'auto' }}>
                      {createDrawerArtistServices.map(({ service, preset }) => {
                        const selected = createDraft.servicePresetId === service.id;
                        const priceLabel =
                          preset?.quotedTotalAmount && Number(preset.quotedTotalAmount) > 0
                            ? `${preset.quotedTotalAmount} AUD`
                            : 'Variable';
                        return (
                          <button
                            key={service.id}
                            type="button"
                            onClick={() => applyCreateServicePresetSelection(service.id)}
                            style={{
                              textAlign: 'left',
                              border: selected ? '1px solid #7c85ff' : '1px solid #333',
                              background: selected ? 'rgba(124,133,255,0.1)' : 'rgba(255,255,255,0.015)',
                              color: 'inherit',
                              borderRadius: 8,
                              padding: '0.5rem 0.6rem',
                              cursor: 'pointer',
                              display: 'grid',
                              gap: '0.15rem'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'baseline' }}>
                              <span style={{ fontSize: 13, fontWeight: 700 }}>{service.name}</span>
                              <span style={{ fontSize: 12, opacity: 0.8 }}>{priceLabel}</span>
                            </div>
                            <div style={{ fontSize: 12, opacity: 0.72 }}>
                              {service.category} • {preset?.durationMinutes ? formatDurationOptionLabel(Number(preset.durationMinutes)) : 'Duration varies'}
                            </div>
                          </button>
                        );
                      })}
                      {!createDrawerArtistServices.length ? (
                        <div style={{ fontSize: 12, opacity: 0.65, border: '1px dashed #333', borderRadius: 8, padding: '0.6rem' }}>
                          No matching services. Add or update artist pricing in Admin &gt; Services.
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              <label style={{ display: 'grid', gap: '0.3rem' }}>
                <span style={{ fontSize: 12, opacity: 0.75 }}>Artist</span>
                <select
                  value={createDraft.artistId}
                  onChange={(e) => setCreateDraft((prev) => ({ ...prev, artistId: e.target.value }))}
                  style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}
                >
                  {artistState.artists.map((artist) => (
                    <option key={artist.id} value={artist.id}>
                      {artist.displayName}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'grid', gap: '0.3rem' }}>
                <span style={{ fontSize: 12, opacity: 0.75 }}>Start (Melbourne)</span>
                <input
                  type="datetime-local"
                  value={createDraft.startAtLocal}
                  onChange={(e) => setCreateDraft((prev) => ({ ...prev, startAtLocal: e.target.value }))}
                  style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}
                />
              </label>

              <label style={{ display: 'grid', gap: '0.3rem' }}>
                <span style={{ fontSize: 12, opacity: 0.75 }}>Duration</span>
                <select
                  value={createDraft.durationMinutes}
                  onChange={(e) => setCreateDraft((prev) => ({ ...prev, durationMinutes: e.target.value }))}
                  style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}
                >
                  {APPOINTMENT_DURATION_OPTIONS.map((minutes) => (
                    <option key={minutes} value={String(minutes)}>
                      {formatDurationOptionLabel(minutes)}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'grid', gap: '0.3rem' }}>
                <span style={{ fontSize: 12, opacity: 0.75 }}>Source</span>
                <select
                  value={createDraft.source}
                  onChange={(e) => setCreateDraft((prev) => ({ ...prev, source: e.target.value }))}
                  style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}
                >
                  {APPOINTMENT_SOURCES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'grid', gap: '0.3rem' }}>
                <span style={{ fontSize: 12, opacity: 0.75 }}>Selected Service</span>
                <input
                  value={createDraft.serviceName}
                  readOnly
                  placeholder="Select an appointment type"
                  style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}
                />
                {!createDraft.servicePresetId ? (
                  <span style={{ fontSize: 11, color: '#f7b955' }}>Select a service from the top-right panel.</span>
                ) : null}
              </label>

              <label style={{ display: 'grid', gap: '0.3rem' }}>
                <span style={{ fontSize: 12, opacity: 0.75 }}>Deposit Requested</span>
                <button
                  type="button"
                  onClick={() =>
                    setCreateDraft((prev) => ({
                      ...prev,
                      depositRequested: !prev.depositRequested,
                      depositRequiredAmount: !prev.depositRequested
                        ? (prev.depositRequiredAmount && Number(prev.depositRequiredAmount) > 0 ? prev.depositRequiredAmount : '100')
                        : '0'
                    }))
                  }
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '20px 1fr',
                    alignItems: 'start',
                    gap: '0.55rem',
                    textAlign: 'left',
                    border: '1px solid #333',
                    background: Boolean(createDraft.depositRequested) ? 'rgba(46,196,182,0.06)' : 'rgba(255,255,255,0.01)',
                    color: 'inherit',
                    borderRadius: 10,
                    padding: '0.45rem 0.55rem',
                    cursor: 'pointer'
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      border: `1px solid ${createDraft.depositRequested ? '#2ec4b6' : '#5b5b5b'}`,
                      background: createDraft.depositRequested ? 'rgba(46,196,182,0.15)' : 'transparent',
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: 12,
                      lineHeight: 1,
                      marginTop: 1
                    }}
                  >
                    {createDraft.depositRequested ? '✓' : ''}
                  </span>
                  <span style={{ fontSize: 13, lineHeight: 1.2 }}>Require a deposit for this appointment</span>
                </button>
                {createDraft.depositRequested ? (
                  <>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={createDraft.depositRequiredAmount}
                      onChange={(e) => setCreateDraft((prev) => ({ ...prev, depositRequiredAmount: e.target.value }))}
                      style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}
                    />
                    <span style={{ fontSize: 11, opacity: 0.7 }}>Set a deposit amount for this appointment only.</span>
                  </>
                ) : (
                  <span style={{ fontSize: 11, opacity: 0.7 }}>No deposit requested for this appointment.</span>
                )}
              </label>

              <label style={{ display: 'grid', gap: '0.3rem' }}>
                <span style={{ fontSize: 12, opacity: 0.75 }}>Quoted Price (AUD)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={createDraft.quotedTotalAmount}
                  onChange={(e) => setCreateDraft((prev) => ({ ...prev, quotedTotalAmount: e.target.value }))}
                  style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}
                />
                <span style={{ fontSize: 11, opacity: 0.7 }}>
                  Use this for fixed-price pieces (custom quoted work) or to override the preset default for this appointment.
                </span>
              </label>

              <div
                style={{
                  gridColumn: '1 / -1',
                  border: `1px solid ${createDraft.selectedClientId ? '#2f3f34' : '#553333'}`,
                  borderRadius: 10,
                  padding: '0.65rem',
                  background: createDraft.selectedClientId ? 'rgba(107,211,157,0.04)' : 'rgba(255,96,71,0.04)',
                  display: 'grid',
                  gap: '0.4rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'start' }}>
                  <div>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>Client</div>
                    {createDraft.selectedClient ? (
                      <>
                        <div style={{ fontWeight: 700 }}>
                          {[createDraft.selectedClient.firstName, createDraft.selectedClient.lastName].filter(Boolean).join(' ') || 'Unnamed client'}
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.8 }}>
                          {createDraft.selectedClient.phoneE164 || 'No phone'} | {createDraft.selectedClient.email || 'No email'}
                        </div>
                      </>
                    ) : (
                      <div style={{ color: '#ffb7ad', fontSize: 13 }}>Select or create a client before saving.</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {createDraft.selectedClient ? (
                      <button
                        type="button"
                        onClick={() => openCreateClientDrawerExisting(createDraft.selectedClient)}
                        style={{ border: '1px solid #333', background: 'transparent', color: 'inherit', borderRadius: 999, padding: '0.25rem 0.6rem', cursor: 'pointer', fontSize: 12 }}
                      >
                        View / Edit Client
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={openCreateClientDrawerNew}
                      style={{ border: '1px solid #7c85ff55', background: 'rgba(124,133,255,0.08)', color: 'inherit', borderRadius: 999, padding: '0.25rem 0.6rem', cursor: 'pointer', fontSize: 12 }}
                    >
                      Add new client
                    </button>
                  </div>
                </div>
              </div>

              <label style={{ display: 'grid', gap: '0.3rem', gridColumn: '1 / -1' }}>
                <span style={{ fontSize: 12, opacity: 0.75 }}>Design Brief</span>
                <textarea
                  rows={2}
                  value={createDraft.designBrief}
                  onChange={(e) => setCreateDraft((prev) => ({ ...prev, designBrief: e.target.value }))}
                  style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}
                />
              </label>

              <label style={{ display: 'grid', gap: '0.3rem', gridColumn: '1 / -1' }}>
                <span style={{ fontSize: 12, opacity: 0.75 }}>Internal Notes</span>
                <textarea
                  rows={2}
                  value={createDraft.internalNotes}
                  onChange={(e) => setCreateDraft((prev) => ({ ...prev, internalNotes: e.target.value }))}
                  style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}
                />
              </label>
                </div>
              </div>

              <div
                style={{
                  borderTop: '1px solid #2a1f1f',
                  padding: '0.8rem 1rem',
                  display: 'flex',
                  gap: '0.6rem',
                  justifyContent: 'flex-end',
                  background: 'rgba(0,0,0,0.15)'
                }}
              >
                <button
                  type="button"
                  onClick={() => closeCreateDrawer()}
                  style={{
                    border: '1px solid #333',
                    background: 'transparent',
                    color: 'inherit',
                    borderRadius: 999,
                    padding: '0.45rem 0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={createAppointmentFromBoard}
                  disabled={saveState.saving}
                  style={{
                    border: '1px solid #2ec4b6',
                    background: 'rgba(46,196,182,0.1)',
                    color: 'inherit',
                    borderRadius: 999,
                    padding: '0.45rem 0.8rem',
                    cursor: saveState.saving ? 'progress' : 'pointer'
                  }}
                >
                  {saveState.saving ? 'Creating...' : 'Create Appointment'}
                </button>
              </div>
            </aside>
          </>
        ) : null}

        {createClientDrawer.open && createClientDrawer.draft ? (
          <aside
            role="dialog"
            aria-modal="false"
            aria-label={createClientDrawer.mode === 'new' ? 'Add client' : 'Client details'}
            style={{
              position: 'fixed',
              top: 0,
              right: 'min(520px, 100vw)',
              width: 'min(420px, 100vw)',
              height: '100vh',
              zIndex: 42,
              background: 'linear-gradient(180deg, rgba(24,18,18,0.98), rgba(14,11,11,0.98))',
              borderLeft: '1px solid #332424',
              boxShadow: '-10px 0 30px rgba(0,0,0,0.25)',
              display: 'grid',
              gridTemplateRows: 'auto 1fr auto'
            }}
          >
            <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid #2a1f1f', display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>
                  {createClientDrawer.mode === 'new' ? 'Add Client' : 'Client Details'}
                </div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  {createClientDrawer.mode === 'new'
                    ? 'Create and attach a client to this appointment'
                    : 'Review/update client and attach to appointment'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCreateClientDrawer((prev) => ({ ...prev, open: false }))}
                style={{ border: '1px solid #333', background: 'transparent', color: 'inherit', borderRadius: 999, padding: '0.25rem 0.6rem', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>

            <div style={{ overflow: 'auto', padding: '0.85rem 1rem', display: 'grid', gap: '0.6rem' }}>
              <label style={{ display: 'grid', gap: '0.25rem' }}>
                <span style={{ fontSize: 12, opacity: 0.75 }}>First Name</span>
                <input
                  ref={createClientFirstNameInputRef}
                  value={createClientDrawer.draft.firstName || ''}
                  onChange={(e) => setCreateClientDrawer((prev) => ({ ...prev, draft: { ...prev.draft, firstName: e.target.value } }))}
                  style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}
                />
              </label>
              <label style={{ display: 'grid', gap: '0.25rem' }}>
                <span style={{ fontSize: 12, opacity: 0.75 }}>Last Name</span>
                <input
                  value={createClientDrawer.draft.lastName || ''}
                  onChange={(e) => setCreateClientDrawer((prev) => ({ ...prev, draft: { ...prev.draft, lastName: e.target.value } }))}
                  style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}
                />
              </label>
              <label style={{ display: 'grid', gap: '0.25rem' }}>
                <span style={{ fontSize: 12, opacity: 0.75 }}>Phone</span>
                <input
                  value={createClientDrawer.draft.phoneE164 || ''}
                  onChange={(e) => setCreateClientDrawer((prev) => ({ ...prev, draft: { ...prev.draft, phoneE164: e.target.value } }))}
                  onBlur={(e) => {
                    const normalized = normalizeAustralianPhoneToE164(e.target.value);
                    setCreateClientDrawer((prev) => ({ ...prev, draft: { ...prev.draft, phoneE164: normalized } }));
                  }}
                  placeholder="0418... or +614..."
                  style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}
                />
              </label>
              <label style={{ display: 'grid', gap: '0.25rem' }}>
                <span style={{ fontSize: 12, opacity: 0.75 }}>Email</span>
                <input
                  type="email"
                  value={createClientDrawer.draft.email || ''}
                  onChange={(e) => setCreateClientDrawer((prev) => ({ ...prev, draft: { ...prev.draft, email: e.target.value } }))}
                  style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}
                />
              </label>
              <label style={{ display: 'grid', gap: '0.25rem' }}>
                <span style={{ fontSize: 12, opacity: 0.75 }}>Instagram</span>
                <input
                  value={createClientDrawer.draft.instagramHandle || ''}
                  onChange={(e) => setCreateClientDrawer((prev) => ({ ...prev, draft: { ...prev.draft, instagramHandle: e.target.value } }))}
                  placeholder="@handle"
                  style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}
                />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <label style={{ display: 'grid', gap: '0.25rem' }}>
                  <span style={{ fontSize: 12, opacity: 0.75 }}>Status</span>
                  <select
                    value={createClientDrawer.draft.status || 'active'}
                    onChange={(e) => setCreateClientDrawer((prev) => ({ ...prev, draft: { ...prev.draft, status: e.target.value } }))}
                    style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}
                  >
                    <option value="active">active</option>
                    <option value="vip">vip</option>
                    <option value="do_not_book">do_not_book</option>
                    <option value="archived">archived</option>
                  </select>
                </label>
                <label style={{ display: 'grid', gap: '0.25rem' }}>
                  <span style={{ fontSize: 12, opacity: 0.75 }}>Client Type</span>
                  <select
                    value={createClientDrawer.draft.clientType || 'new'}
                    onChange={(e) => setCreateClientDrawer((prev) => ({ ...prev, draft: { ...prev.draft, clientType: e.target.value } }))}
                    style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}
                  >
                    <option value="new">new</option>
                    <option value="rebooked">rebooked</option>
                    <option value="lapsed">lapsed</option>
                  </select>
                </label>
              </div>
              <label style={{ display: 'grid', gap: '0.25rem' }}>
                <span style={{ fontSize: 12, opacity: 0.75 }}>Source</span>
                <select
                  value={createClientDrawer.draft.source || 'manual'}
                  onChange={(e) => setCreateClientDrawer((prev) => ({ ...prev, draft: { ...prev.draft, source: e.target.value } }))}
                  style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}
                >
                  {APPOINTMENT_SOURCES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'grid', gap: '0.25rem' }}>
                <span style={{ fontSize: 12, opacity: 0.75 }}>Notes</span>
                <textarea
                  rows={3}
                  value={createClientDrawer.draft.notes || ''}
                  onChange={(e) => setCreateClientDrawer((prev) => ({ ...prev, draft: { ...prev.draft, notes: e.target.value } }))}
                  style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}
                />
              </label>
              {createClientDrawer.error ? <p style={{ margin: 0, color: '#ffb4b4', fontSize: 12 }}>{createClientDrawer.error}</p> : null}
            </div>

            <div style={{ borderTop: '1px solid #2a1f1f', padding: '0.8rem 1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setCreateClientDrawer((prev) => ({ ...prev, open: false }))}
                style={{ border: '1px solid #333', background: 'transparent', color: 'inherit', borderRadius: 999, padding: '0.35rem 0.7rem', cursor: 'pointer' }}
              >
                Close
              </button>
              <button
                type="button"
                onClick={saveClientFromCreateDrawer}
                disabled={createClientDrawer.saving}
                style={{ border: '1px solid #7dd3fc', background: 'rgba(125,211,252,0.1)', color: 'inherit', borderRadius: 999, padding: '0.35rem 0.7rem', cursor: createClientDrawer.saving ? 'progress' : 'pointer' }}
              >
                {createClientDrawer.saving
                  ? (createClientDrawer.mode === 'new' ? 'Creating...' : 'Saving...')
                  : (createClientDrawer.mode === 'new' ? 'Create Client' : 'Save Client')}
              </button>
            </div>
          </aside>
        ) : null}

        {blockedDraft ? (
          <>
            <div
              onClick={() => closeBlockedDrawer()}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.45)',
                backdropFilter: 'blur(2px)',
                zIndex: 40
              }}
            />
            <aside
              role="dialog"
              aria-modal="true"
              aria-label="Add blocked time"
              style={{
                position: 'fixed',
                top: 0,
                right: 0,
                width: 'min(460px, 100vw)',
                height: '100vh',
                zIndex: 41,
                background: 'linear-gradient(180deg, rgba(19,14,14,0.98), rgba(13,10,10,0.98))',
                borderLeft: '1px solid #332424',
                boxShadow: '-12px 0 40px rgba(0,0,0,0.35)',
                display: 'grid',
                gridTemplateRows: 'auto 1fr auto'
              }}
            >
              <div style={{ padding: '0.9rem 1rem', borderBottom: '1px solid #2a1f1f' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 18 }}>Add Blocked Time</p>
                    <p style={{ margin: '0.25rem 0 0', fontSize: 13, opacity: 0.75 }}>
                      {artistState.artists.find((artist) => artist.id === blockedDraft.artistId)?.displayName || 'Artist'} ({studioTimezone})
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => closeBlockedDrawer()}
                    style={{ border: '1px solid #333', background: 'transparent', color: 'inherit', borderRadius: 999, padding: '0.25rem 0.6rem', cursor: 'pointer' }}
                  >
                    Close
                  </button>
                </div>
              </div>
              <div style={{ overflow: 'auto', padding: '0.9rem 1rem' }}>
                <div style={{ display: 'grid', gap: '0.65rem' }}>
                  <label style={{ display: 'grid', gap: '0.3rem' }}>
                    <span style={{ fontSize: 12, opacity: 0.75 }}>Artist</span>
                    <select value={blockedDraft.artistId} onChange={(e) => setBlockedDraft((p) => ({ ...p, artistId: e.target.value }))} style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}>
                      {artistState.artists.map((artist) => (
                        <option key={artist.id} value={artist.id}>{artist.displayName}</option>
                      ))}
                    </select>
                  </label>
                  <label style={{ display: 'grid', gap: '0.3rem' }}>
                    <span style={{ fontSize: 12, opacity: 0.75 }}>Type</span>
                    <select value={blockedDraft.blockType} onChange={(e) => setBlockedDraft((p) => ({ ...p, blockType: e.target.value }))} style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}>
                      <option value="busy_hold">busy_hold</option>
                      <option value="break">break</option>
                      <option value="time_off">time_off</option>
                      <option value="rostered_unavailable">rostered_unavailable</option>
                    </select>
                  </label>
                  <label style={{ display: 'grid', gap: '0.3rem' }}>
                    <span style={{ fontSize: 12, opacity: 0.75 }}>Start (Melbourne)</span>
                    <input type="datetime-local" value={blockedDraft.startAtLocal} onChange={(e) => setBlockedDraft((p) => ({ ...p, startAtLocal: e.target.value }))} style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }} />
                  </label>
                  <label style={{ display: 'grid', gap: '0.3rem' }}>
                    <span style={{ fontSize: 12, opacity: 0.75 }}>End (Melbourne)</span>
                    <input type="datetime-local" value={blockedDraft.endAtLocal} onChange={(e) => setBlockedDraft((p) => ({ ...p, endAtLocal: e.target.value }))} style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }} />
                  </label>
                  <label style={{ display: 'grid', gap: '0.3rem' }}>
                    <span style={{ fontSize: 12, opacity: 0.75 }}>Label</span>
                    <input value={blockedDraft.label} onChange={(e) => setBlockedDraft((p) => ({ ...p, label: e.target.value }))} style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }} />
                  </label>
                  <label style={{ display: 'grid', gap: '0.3rem' }}>
                    <span style={{ fontSize: 12, opacity: 0.75 }}>Note</span>
                    <textarea rows={3} value={blockedDraft.note} onChange={(e) => setBlockedDraft((p) => ({ ...p, note: e.target.value }))} style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }} />
                  </label>
                </div>
              </div>
              <div style={{ borderTop: '1px solid #2a1f1f', padding: '0.8rem 1rem', display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => closeBlockedDrawer()} style={{ border: '1px solid #333', background: 'transparent', color: 'inherit', borderRadius: 999, padding: '0.45rem 0.8rem', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="button" onClick={createBlockedTimeFromBoard} disabled={saveState.saving} style={{ border: '1px solid #7dd3fc', background: 'rgba(125,211,252,0.1)', color: 'inherit', borderRadius: 999, padding: '0.45rem 0.8rem', cursor: saveState.saving ? 'progress' : 'pointer' }}>
                  {saveState.saving ? 'Creating...' : 'Create Blocked Time'}
                </button>
              </div>
            </aside>
          </>
        ) : null}

        {selectedEventData ? (
          <div
            style={{
              marginTop: '0.9rem',
              border: '1px solid #333',
              borderRadius: 12,
              padding: '0.75rem',
              background: 'rgba(255,255,255,0.01)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
              <p style={{ margin: 0, fontWeight: 700 }}>Selected: {selectedEventData.title}</p>
              <button
                type="button"
                onClick={() => {
                  closeDetailsPanel();
                }}
                style={{
                  border: '1px solid #333',
                  background: 'transparent',
                  color: 'inherit',
                  borderRadius: 999,
                  padding: '0.2rem 0.55rem',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
            <p style={{ margin: '0.35rem 0 0', opacity: 0.85 }}>
              {formatInTimezone(selectedEventData.start, studioTimezone)} to {formatInTimezone(selectedEventData.end, studioTimezone)}
            </p>
            <p style={{ margin: '0.35rem 0 0', opacity: 0.75, fontSize: 14 }}>
              Status: {getStatusDisplayLabel(selectedEventData.extendedProps?.status)} | Source: {selectedEventData.extendedProps?.source} | Artist:{' '}
              {selectedEventData.extendedProps?.artistName || 'Unknown'}
            </p>
            <div
              style={{
                marginTop: '0.6rem',
                display: 'flex',
                gap: '0.6rem',
                alignItems: 'center',
                flexWrap: 'wrap'
              }}
            >
              <span style={{ fontSize: 13, opacity: 0.8 }}>
                Deposit: {selectedEventData.extendedProps?.depositPaidAmount ?? 0}/
                {selectedEventData.extendedProps?.depositRequiredAmount ?? 0} AUD
              </span>
              {(() => {
                const paymentState = getDepositPaymentState(selectedEventData.extendedProps);
                return (
                  <span
                    style={{
                      fontSize: 12,
                      border: `1px solid ${paymentState.tone}`,
                      color: paymentState.tone,
                      background: `${paymentState.tone}12`,
                      borderRadius: 999,
                      padding: '0.2rem 0.55rem',
                      fontWeight: 600
                    }}
                  >
                    {paymentState.label}
                  </span>
                );
              })()}
              <button
                type="button"
                onClick={sendDepositEmail}
                disabled={
                  depositEmailAction.sending ||
                  Number(selectedEventData.extendedProps?.depositRequiredAmount || 0) <=
                    Number(selectedEventData.extendedProps?.depositPaidAmount || 0)
                }
                style={{
                  border: '1px solid #7dd3fc',
                  background: 'rgba(125,211,252,0.1)',
                  color: 'inherit',
                  borderRadius: 999,
                  padding: '0.35rem 0.7rem',
                  cursor: depositEmailAction.sending ? 'progress' : 'pointer',
                  opacity:
                    Number(selectedEventData.extendedProps?.depositRequiredAmount || 0) <=
                    Number(selectedEventData.extendedProps?.depositPaidAmount || 0)
                      ? 0.5
                      : 1
                }}
              >
                {depositEmailAction.sending ? 'Sending Deposit Email...' : 'Send Deposit Email'}
              </button>
              {depositEmailAction.error ? (
                <span style={{ fontSize: 12, color: '#ffb4b4' }}>{depositEmailAction.error}</span>
              ) : null}
            </div>

            <div style={{ marginTop: '0.55rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => markAppointmentStatusQuick('checked_in')}
                disabled={saveState.saving || selectedEventData.extendedProps?.status === 'checked_in'}
                style={{
                  border: '1px solid #f7b955',
                  background: 'rgba(247,185,85,0.1)',
                  color: 'inherit',
                  borderRadius: 999,
                  padding: '0.3rem 0.65rem',
                  cursor: saveState.saving ? 'progress' : 'pointer',
                  opacity: selectedEventData.extendedProps?.status === 'checked_in' ? 0.55 : 1
                }}
              >
                Mark Arrived
              </button>
              <button
                type="button"
                onClick={() => markAppointmentStatusQuick('completed')}
                disabled={saveState.saving || selectedEventData.extendedProps?.status === 'completed'}
                style={{
                  border: '1px solid #6bd39d',
                  background: 'rgba(107,211,157,0.1)',
                  color: 'inherit',
                  borderRadius: 999,
                  padding: '0.3rem 0.65rem',
                  cursor: saveState.saving ? 'progress' : 'pointer',
                  opacity: selectedEventData.extendedProps?.status === 'completed' ? 0.55 : 1
                }}
              >
                Mark Completed
              </button>
              <button
                type="button"
                onClick={openCheckoutDrawer}
                style={{
                  border: '1px solid #7dd3fc',
                  background: 'rgba(125,211,252,0.1)',
                  color: 'inherit',
                  borderRadius: 999,
                  padding: '0.3rem 0.65rem',
                  cursor: 'pointer'
                }}
              >
                Open Checkout
              </button>
            </div>

            {detailsDraft ? (
              <div
                style={{
                  marginTop: '0.75rem',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '0.65rem'
                }}
              >
                <label style={{ display: 'grid', gap: '0.3rem' }}>
                  <span style={{ fontSize: 12, opacity: 0.75 }}>Artist</span>
                  <select
                    value={detailsDraft.artistId}
                    onChange={(e) => setDetailsDraft((prev) => ({ ...prev, artistId: e.target.value }))}
                    style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}
                  >
                    {artistState.artists.map((artist) => (
                      <option key={artist.id} value={artist.id}>
                        {artist.displayName}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={{ display: 'grid', gap: '0.3rem' }}>
                  <span style={{ fontSize: 12, opacity: 0.75 }}>Status</span>
                  <select
                    value={detailsDraft.status}
                    onChange={(e) => setDetailsDraft((prev) => ({ ...prev, status: e.target.value }))}
                    style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}
                  >
                    {APPOINTMENT_STATUSES.map((value) => (
                      <option key={value} value={value}>
                        {getStatusDisplayLabel(value)}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={{ display: 'grid', gap: '0.3rem' }}>
                  <span style={{ fontSize: 12, opacity: 0.75 }}>Source</span>
                  <select
                    value={detailsDraft.source}
                    onChange={(e) => setDetailsDraft((prev) => ({ ...prev, source: e.target.value }))}
                    style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}
                  >
                    {APPOINTMENT_SOURCES.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={{ display: 'grid', gap: '0.3rem' }}>
                  <span style={{ fontSize: 12, opacity: 0.75 }}>Deposit Required (AUD)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={detailsDraft.depositRequiredAmount}
                    onChange={(e) => setDetailsDraft((prev) => ({ ...prev, depositRequiredAmount: e.target.value }))}
                    style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}
                  />
                </label>

                <label style={{ display: 'grid', gap: '0.3rem' }}>
                  <span style={{ fontSize: 12, opacity: 0.75 }}>Quoted Total (AUD)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={detailsDraft.quotedTotalAmount}
                    onChange={(e) => setDetailsDraft((prev) => ({ ...prev, quotedTotalAmount: e.target.value }))}
                    style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}
                  />
                </label>

                <label style={{ display: 'grid', gap: '0.3rem', gridColumn: '1 / -1' }}>
                  <span style={{ fontSize: 12, opacity: 0.75 }}>Design Brief</span>
                  <textarea
                    rows={2}
                    value={detailsDraft.designBrief}
                    onChange={(e) => setDetailsDraft((prev) => ({ ...prev, designBrief: e.target.value }))}
                    style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}
                  />
                </label>

                <label style={{ display: 'grid', gap: '0.3rem', gridColumn: '1 / -1' }}>
                  <span style={{ fontSize: 12, opacity: 0.75 }}>Internal Notes</span>
                  <textarea
                    rows={2}
                    value={detailsDraft.internalNotes}
                    onChange={(e) => setDetailsDraft((prev) => ({ ...prev, internalNotes: e.target.value }))}
                    style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}
                  />
                </label>

                <label style={{ display: 'grid', gap: '0.3rem', gridColumn: '1 / -1' }}>
                  <span style={{ fontSize: 12, opacity: 0.75 }}>Change Note (optional, appended with timestamp)</span>
                  <input
                    value={detailsDraft.changeNote || ''}
                    onChange={(e) => setDetailsDraft((prev) => ({ ...prev, changeNote: e.target.value }))}
                    placeholder="Why was this changed?"
                    style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}
                  />
                </label>

                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={saveAppointmentDetails}
                    disabled={saveState.saving}
                    style={{
                      border: '1px solid #ff6047',
                      background: 'rgba(255, 96, 71, 0.12)',
                      color: 'inherit',
                      borderRadius: 999,
                      padding: '0.45rem 0.8rem',
                      cursor: saveState.saving ? 'progress' : 'pointer'
                    }}
                  >
                    Save Appointment Details
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDetailsDraft(buildDetailsDraftFromEvent(selectedEventData));
                    }}
                    style={{
                      border: '1px solid #333',
                      background: 'transparent',
                      color: 'inherit',
                      borderRadius: 999,
                      padding: '0.45rem 0.8rem',
                      cursor: 'pointer'
                    }}
                  >
                    Reset Form
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {editDrawerOpen && selectedEventData && detailsDraft ? (
          <>
            <div
              onClick={() => setEditDrawerOpen(false)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.35)',
                zIndex: 42
              }}
            />
            <aside
              role="dialog"
              aria-modal="true"
              aria-label="Edit appointment"
              style={{
                position: 'fixed',
                top: 0,
                right: 0,
                width: 'min(480px, 100vw)',
                height: '100vh',
                zIndex: 43,
                background: 'linear-gradient(180deg, rgba(19,14,14,0.98), rgba(13,10,10,0.98))',
                borderLeft: '1px solid #332424',
                boxShadow: '-12px 0 40px rgba(0,0,0,0.35)',
                display: 'grid',
                gridTemplateRows: 'auto 1fr auto'
              }}
            >
              <div style={{ padding: '0.9rem 1rem', borderBottom: '1px solid #2a1f1f' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'start' }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 18 }}>Edit Appointment</p>
                    <p style={{ margin: '0.25rem 0 0', fontSize: 13, opacity: 0.75 }}>
                      {selectedEventData.title} • {formatInTimezone(selectedEventData.start, studioTimezone)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditDrawerOpen(false)}
                    style={{ border: '1px solid #333', background: 'transparent', color: 'inherit', borderRadius: 999, padding: '0.3rem 0.7rem', cursor: 'pointer' }}
                  >
                    Close
                  </button>
                </div>
              </div>

              <div style={{ overflow: 'auto', padding: '0.85rem 1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.65rem' }}>
                  <label style={{ display: 'grid', gap: '0.3rem' }}>
                    <span style={{ fontSize: 12, opacity: 0.75 }}>Artist</span>
                    <select
                      value={detailsDraft.artistId}
                      onChange={(e) => setDetailsDraft((prev) => ({ ...prev, artistId: e.target.value }))}
                      style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}
                    >
                      {artistState.artists.map((artist) => (
                        <option key={artist.id} value={artist.id}>
                          {artist.displayName}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={{ display: 'grid', gap: '0.3rem' }}>
                    <span style={{ fontSize: 12, opacity: 0.75 }}>Status</span>
                    <select
                      value={detailsDraft.status}
                      onChange={(e) => setDetailsDraft((prev) => ({ ...prev, status: e.target.value }))}
                      style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}
                    >
                      {APPOINTMENT_STATUSES.map((value) => (
                        <option key={value} value={value}>
                          {getStatusDisplayLabel(value)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={{ display: 'grid', gap: '0.3rem' }}>
                    <span style={{ fontSize: 12, opacity: 0.75 }}>Source</span>
                    <select
                      value={detailsDraft.source}
                      onChange={(e) => setDetailsDraft((prev) => ({ ...prev, source: e.target.value }))}
                      style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}
                    >
                      {APPOINTMENT_SOURCES.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={{ display: 'grid', gap: '0.3rem' }}>
                    <span style={{ fontSize: 12, opacity: 0.75 }}>Deposit Required (AUD)</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={detailsDraft.depositRequiredAmount}
                      onChange={(e) => setDetailsDraft((prev) => ({ ...prev, depositRequiredAmount: e.target.value }))}
                      style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}
                    />
                  </label>

                  <label style={{ display: 'grid', gap: '0.3rem' }}>
                    <span style={{ fontSize: 12, opacity: 0.75 }}>Quoted Total (AUD)</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={detailsDraft.quotedTotalAmount}
                      onChange={(e) => setDetailsDraft((prev) => ({ ...prev, quotedTotalAmount: e.target.value }))}
                      style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}
                    />
                  </label>

                  <label style={{ display: 'grid', gap: '0.3rem', gridColumn: '1 / -1' }}>
                    <span style={{ fontSize: 12, opacity: 0.75 }}>Design Brief</span>
                    <textarea
                      rows={3}
                      value={detailsDraft.designBrief}
                      onChange={(e) => setDetailsDraft((prev) => ({ ...prev, designBrief: e.target.value }))}
                      style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}
                    />
                  </label>

                  <label style={{ display: 'grid', gap: '0.3rem', gridColumn: '1 / -1' }}>
                    <span style={{ fontSize: 12, opacity: 0.75 }}>Internal Notes</span>
                    <textarea
                      rows={3}
                      value={detailsDraft.internalNotes}
                      onChange={(e) => setDetailsDraft((prev) => ({ ...prev, internalNotes: e.target.value }))}
                      style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}
                    />
                  </label>

                  <label style={{ display: 'grid', gap: '0.3rem', gridColumn: '1 / -1' }}>
                    <span style={{ fontSize: 12, opacity: 0.75 }}>Change Note (optional, appended with timestamp)</span>
                    <input
                      value={detailsDraft.changeNote || ''}
                      onChange={(e) => setDetailsDraft((prev) => ({ ...prev, changeNote: e.target.value }))}
                      placeholder="Why was this changed?"
                      style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}
                    />
                  </label>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #2a1f1f', padding: '0.8rem 1rem', display: 'flex', justifyContent: 'space-between', gap: '0.6rem', alignItems: 'center' }}>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  {isDetailsDirty ? 'Unsaved changes' : 'No changes'}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setEditDrawerOpen(false)}
                    style={{ border: '1px solid #333', background: 'transparent', color: 'inherit', borderRadius: 999, padding: '0.4rem 0.75rem', cursor: 'pointer' }}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={saveAppointmentDetails}
                    disabled={saveState.saving}
                    style={{ border: '1px solid #6bd39d', background: 'rgba(107,211,157,0.1)', color: 'inherit', borderRadius: 999, padding: '0.4rem 0.75rem', cursor: saveState.saving ? 'progress' : 'pointer' }}
                  >
                    {saveState.saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </aside>
          </>
        ) : null}

        {checkoutDrawer.open ? (
          <>
            <div
              onClick={() => setCheckoutDrawer((prev) => ({ ...prev, open: false }))}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 46 }}
            />
            <aside
              style={{
                position: 'fixed',
                top: 0,
                right: 0,
                width: 'min(680px, 100vw)',
                height: '100vh',
                zIndex: 47,
                background: 'linear-gradient(180deg, rgba(19,14,14,0.98), rgba(13,10,10,0.98))',
                borderLeft: '1px solid #332424',
                boxShadow: '-12px 0 40px rgba(0,0,0,0.35)',
                display: 'grid',
                gridTemplateRows: 'auto 1fr auto'
              }}
            >
              <div style={{ padding: '0.9rem 1rem', borderBottom: '1px solid #2a1f1f', display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 18 }}>Checkout (Preview)</p>
                  <p style={{ margin: '0.25rem 0 0', fontSize: 13, opacity: 0.75 }}>
                    Financial summary for the selected appointment order.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCheckoutDrawer((prev) => ({ ...prev, open: false }))}
                  style={{ border: '1px solid #333', background: 'transparent', color: 'inherit', borderRadius: 999, padding: '0.25rem 0.6rem', cursor: 'pointer', height: 34 }}
                >
                  Close
                </button>
              </div>

              <div style={{ overflow: 'auto', padding: '0.9rem 1rem', display: 'grid', gap: '0.8rem' }}>
                {checkoutDrawer.loading && !checkoutDrawer.data ? <p style={{ margin: 0 }}>Loading checkout summary...</p> : null}
                {!checkoutDrawer.loading && checkoutDrawer.refreshing ? (
                  <p style={{ margin: 0, fontSize: 12, opacity: 0.7 }}>Updating checkout summary...</p>
                ) : null}
                {checkoutDrawer.error ? <p style={{ margin: 0, color: '#ffb4b4' }}>{checkoutDrawer.error}</p> : null}

                {!checkoutDrawer.loading && !checkoutDrawer.error && checkoutDrawer.data ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.6rem' }}>
                      <div style={{ border: '1px solid #333', borderRadius: 10, padding: '0.65rem' }}>
                        <div style={{ fontSize: 12, opacity: 0.7 }}>Order Status</div>
                        <div style={{ fontWeight: 700 }}>{checkoutDrawer.data.order?.status || 'open'}</div>
                      </div>
                      <div style={{ border: '1px solid #333', borderRadius: 10, padding: '0.65rem' }}>
                        <div style={{ fontSize: 12, opacity: 0.7 }}>Total</div>
                        <div style={{ fontWeight: 700 }}>{checkoutDrawer.data.order?.totalAmount ?? 0} AUD</div>
                      </div>
                      <div style={{ border: '1px solid #333', borderRadius: 10, padding: '0.65rem' }}>
                        <div style={{ fontSize: 12, opacity: 0.7 }}>Paid</div>
                        <div style={{ fontWeight: 700 }}>{checkoutDrawer.data.order?.amountPaid ?? 0} AUD</div>
                      </div>
                      <div style={{ border: '1px solid #333', borderRadius: 10, padding: '0.65rem' }}>
                        <div style={{ fontSize: 12, opacity: 0.7 }}>Balance Due</div>
                        <div style={{ fontWeight: 700 }}>{checkoutDrawer.data.order?.balanceDueAmount ?? 0} AUD</div>
                      </div>
                    </div>

                    <div style={{ border: '1px solid #333', borderRadius: 10, padding: '0.75rem' }}>
                      <p style={{ margin: '0 0 0.5rem', fontWeight: 700 }}>Manual Price Override</p>
                      <p style={{ margin: '0 0 0.55rem', fontSize: 12, opacity: 0.75 }}>
                        Use this if the appointment finished above or below the quoted amount. This is not a discount.
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem' }}>
                        <label style={{ display: 'grid', gap: '0.25rem' }}>
                          <span style={{ fontSize: 12, opacity: 0.75 }}>New total (AUD)</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={checkoutUi.overrideTotalAmount}
                            onChange={(e) => setCheckoutUi((prev) => ({ ...prev, overrideTotalAmount: e.target.value }))}
                            style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}
                          />
                        </label>
                        <label style={{ display: 'grid', gap: '0.25rem' }}>
                          <span style={{ fontSize: 12, opacity: 0.75 }}>Reason (optional)</span>
                          <input
                            value={checkoutUi.overrideNote}
                            onChange={(e) => setCheckoutUi((prev) => ({ ...prev, overrideNote: e.target.value }))}
                            placeholder="Longer session / finished early / scope change..."
                            style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}
                          />
                        </label>
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            onClick={applyCheckoutPriceOverride}
                            disabled={checkoutUi.actionLoading}
                            style={{ border: '1px solid #f7b955', background: 'rgba(247,185,85,0.1)', color: 'inherit', borderRadius: 999, padding: '0.4rem 0.75rem', cursor: checkoutUi.actionLoading ? 'progress' : 'pointer' }}
                          >
                            Apply Price Override
                          </button>
                        </div>
                      </div>
                    </div>

                    <div style={{ border: '1px solid #333', borderRadius: 10, padding: '0.75rem' }}>
                      <p style={{ margin: '0 0 0.5rem', fontWeight: 700 }}>Add Payment</p>
                      <p style={{ margin: '0 0 0.55rem', fontSize: 12, opacity: 0.75 }}>
                        Add one or more payments. Split payments are supported by adding multiple payments.
                      </p>
                      <div style={{ display: 'grid', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                          {[
                            { key: 'cash', icon: '💵', label: 'Cash' },
                            { key: 'bank_transfer', icon: '🏦', label: 'Bank Transfer' },
                            { key: 'stripe_link', icon: '✉', label: 'Payment Link' }
                          ].map((method) => {
                            const selected = checkoutUi.addPaymentMethod === method.key;
                            return (
                              <button
                                key={method.key}
                                type="button"
                                onClick={() => setCheckoutUi((prev) => ({ ...prev, addPaymentMethod: method.key }))}
                                style={{
                                  border: selected ? '1px solid #7dd3fc' : '1px solid #333',
                                  background: selected ? 'rgba(125,211,252,0.1)' : 'rgba(255,255,255,0.01)',
                                  color: 'inherit',
                                  borderRadius: 10,
                                  padding: '0.4rem 0.6rem',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  fontSize: 12,
                                  fontWeight: 600
                                }}
                                title={method.label}
                              >
                                <span aria-hidden="true" style={{ fontSize: 14, lineHeight: 1 }}>{method.icon}</span>
                                <span>{method.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem', alignItems: 'end' }}>
                        <label style={{ display: 'grid', gap: '0.25rem' }}>
                          <span style={{ fontSize: 12, opacity: 0.75 }}>Amount (AUD)</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={checkoutUi.addPaymentAmount}
                            onChange={(e) => setCheckoutUi((prev) => ({ ...prev, addPaymentAmount: e.target.value }))}
                            placeholder="0.00"
                            style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={addCheckoutPayment}
                          disabled={checkoutUi.actionLoading}
                          style={{ border: '1px solid #6bd39d', background: 'rgba(107,211,157,0.1)', color: 'inherit', borderRadius: 999, padding: '0.45rem 0.75rem', cursor: checkoutUi.actionLoading ? 'progress' : 'pointer', height: 38 }}
                        >
                          {checkoutUi.addPaymentMethod === 'stripe_link' ? 'Send Payment Link (Email)' : 'Add Payment'}
                        </button>
                      </div>
                      <div style={{ fontSize: 11, opacity: 0.7 }}>
                        {checkoutUi.addPaymentMethod === 'stripe_link'
                          ? 'This will email a Stripe payment link and record payment only after webhook confirmation.'
                          : 'This records a local payment immediately.'}
                      </div>
                      </div>
                    </div>

                    {checkoutUi.actionError ? (
                      <p style={{ margin: 0, color: '#ffb4b4', fontSize: 13 }}>{checkoutUi.actionError}</p>
                    ) : null}
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        onClick={() => refreshCheckoutDrawer({ soft: false })}
                        disabled={checkoutUi.actionLoading || checkoutDrawer.loading}
                        style={{ border: '1px solid #333', background: 'transparent', color: 'inherit', borderRadius: 999, padding: '0.3rem 0.65rem', cursor: 'pointer', fontSize: 12 }}
                      >
                        Refresh Checkout Summary
                      </button>
                    </div>

                    <div style={{ border: '1px solid #333', borderRadius: 10, padding: '0.75rem' }}>
                      <p style={{ margin: '0 0 0.5rem', fontWeight: 700 }}>Order Items</p>
                      <div style={{ display: 'grid', gap: '0.4rem' }}>
                        {(checkoutDrawer.data.items || []).map((item) => (
                          <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem', fontSize: 13 }}>
                            <div>
                              <div style={{ fontWeight: 600 }}>{item.description}</div>
                              <div style={{ opacity: 0.75 }}>{item.lineType} • qty {item.quantity}</div>
                            </div>
                            <div style={{ whiteSpace: 'nowrap' }}>{item.lineTotalAmount} AUD</div>
                          </div>
                        ))}
                        {(!checkoutDrawer.data.items || checkoutDrawer.data.items.length === 0) ? (
                          <div style={{ fontSize: 13, opacity: 0.75 }}>No order items yet.</div>
                        ) : null}
                      </div>
                    </div>

                    <div style={{ border: '1px solid #333', borderRadius: 10, padding: '0.75rem' }}>
                      <p style={{ margin: '0 0 0.5rem', fontWeight: 700 }}>Payments</p>
                      <div style={{ display: 'grid', gap: '0.4rem' }}>
                        {(checkoutDrawer.data.payments || []).map((payment) => (
                          <div key={payment.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem', fontSize: 13 }}>
                            <div>
                              <div style={{ fontWeight: 600 }}>{payment.paymentType} • {payment.method}</div>
                              <div style={{ opacity: 0.75 }}>{payment.status}{payment.paidAt ? ` • ${formatInTimezone(payment.paidAt, studioTimezone)}` : ''}</div>
                            </div>
                            <div style={{ whiteSpace: 'nowrap' }}>{payment.amount} {payment.currency}</div>
                          </div>
                        ))}
                        {(!checkoutDrawer.data.payments || checkoutDrawer.data.payments.length === 0) ? (
                          <div style={{ fontSize: 13, opacity: 0.75 }}>No payments recorded yet.</div>
                        ) : null}
                      </div>
                    </div>
                  </>
                ) : null}
              </div>

              <div style={{ borderTop: '1px solid #2a1f1f', padding: '0.8rem 1rem', display: 'flex', justifyContent: 'space-between', gap: '0.6rem', alignItems: 'center' }}>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  Balance due: {checkoutDrawer.data?.order?.balanceDueAmount ?? 0} AUD
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={completeCheckoutAction}
                    disabled={checkoutUi.actionLoading || checkoutDrawer.loading}
                    style={{ border: '1px solid #ff6047', background: 'rgba(255,96,71,0.12)', color: 'inherit', borderRadius: 999, padding: '0.4rem 0.75rem', cursor: checkoutUi.actionLoading ? 'progress' : 'pointer' }}
                  >
                    Complete Checkout
                  </button>
                  <button
                    type="button"
                    onClick={() => setCheckoutDrawer((prev) => ({ ...prev, open: false }))}
                    style={{ border: '1px solid #333', background: 'transparent', color: 'inherit', borderRadius: 999, padding: '0.4rem 0.75rem', cursor: 'pointer' }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </aside>
          </>
        ) : null}

      </article>
    </section>
  );
}
