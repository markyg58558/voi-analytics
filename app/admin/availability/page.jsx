import StudioShell from '@/components/layout/StudioShell';
import AdminSubnav from '@/components/admin/AdminSubnav';
import ArtistAvailabilityPanel from '@/components/admin/ArtistAvailabilityPanel';

export const metadata = {
  title: 'Admin Availability | Tattoo Studio MVP'
};

export default function AdminAvailabilityPage() {
  return (
    <StudioShell title="Admin / Availability" subtitle="Base weekly working hours for artists (not a full roster).">
      <AdminSubnav activeHref="/admin/availability" />
      <ArtistAvailabilityPanel />
    </StudioShell>
  );
}

