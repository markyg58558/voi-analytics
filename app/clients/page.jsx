import StudioShell from '@/components/layout/StudioShell';
import ClientAdminPanel from '@/components/clients/ClientAdminPanel';

export const metadata = {
  title: 'Clients | Tattoo Studio MVP'
};

export default function ClientsPage() {
  return (
    <StudioShell title="Clients" subtitle="Client list, contact details, status and notes for front desk and future CRM.">
      <ClientAdminPanel />
    </StudioShell>
  );
}

