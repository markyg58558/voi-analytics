import StudioShell from '@/components/layout/StudioShell';
import BookingIntakeForm from '@/components/booking/BookingIntakeForm';

export const metadata = {
  title: 'Bookings | Tattoo Studio MVP'
};

export default function BookingsPage() {
  return (
    <StudioShell title="Bookings" subtitle="Public booking intake + staff appointment creation flow.">
      <BookingIntakeForm />
    </StudioShell>
  );
}
