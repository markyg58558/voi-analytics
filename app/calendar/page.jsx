import StudioShell from '@/components/layout/StudioShell';
import CalendarBoard from '@/components/calendar/CalendarBoard';
import { getEnv } from '@/lib/config/env';

export const metadata = {
  title: 'Calendar | Tattoo Studio MVP'
};

export default function CalendarPage() {
  const env = getEnv();

  return (
    <StudioShell title="Calendar" subtitle="Artist scheduling and appointment management." fullWidth hideHeading>
      <CalendarBoard studioTimezone={env.studioTimezone} />
    </StudioShell>
  );
}
