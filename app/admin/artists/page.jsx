import StudioShell from '@/components/layout/StudioShell';
import AdminSubnav from '@/components/admin/AdminSubnav';
import ArtistAdminPanel from '@/components/admin/ArtistAdminPanel';

export const metadata = {
  title: 'Admin Artists | Tattoo Studio MVP'
};

export default function AdminArtistsPage() {
  return (
    <StudioShell title="Admin / Artists" subtitle="Manage artist roster, commission rates and tax settings.">
      <AdminSubnav activeHref="/admin/artists" />
      <ArtistAdminPanel />
    </StudioShell>
  );
}

