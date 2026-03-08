import StudioShell from '@/components/layout/StudioShell';
import PosPanel from '@/components/pos/PosPanel';

export const metadata = {
  title: 'POS | Tattoo Studio MVP'
};

export default function PosPage() {
  return (
    <StudioShell title="POS" subtitle="Appointment checkout, retail sales, tips, and payment capture.">
      <PosPanel />
    </StudioShell>
  );
}
