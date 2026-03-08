import StudioShell from '@/components/layout/StudioShell';
import AdminSubnav from '@/components/admin/AdminSubnav';
import ServiceAdminPanel from '@/components/admin/ServiceAdminPanel';

export const metadata = {
  title: 'Admin Services | Tattoo Studio MVP'
};

export default function AdminServicesPage() {
  return (
    <StudioShell title="Admin / Services" subtitle="Service presets and artist-specific pricing defaults.">
      <AdminSubnav activeHref="/admin/services" />
      <ServiceAdminPanel />
    </StudioShell>
  );
}

