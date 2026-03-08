import StudioShell from '@/components/layout/StudioShell';
import RevenueCards from '@/components/reporting/RevenueCards';

export const metadata = {
  title: 'Reports | Tattoo Studio MVP'
};

export default function ReportsPage() {
  return (
    <StudioShell title="Reporting" subtitle="Revenue, operational, and artist performance dashboards.">
      <RevenueCards />
    </StudioShell>
  );
}
