import Link from 'next/link';
import StudioShell from '@/components/layout/StudioShell';
import AdminSubnav from '@/components/admin/AdminSubnav';

export const metadata = {
  title: 'Admin | Tattoo Studio MVP'
};

export default function AdminPage() {
  return (
    <StudioShell title="Admin" subtitle="Studio configuration and setup.">
      <AdminSubnav activeHref="" />
      <div style={{ border: '1px solid #333', borderRadius: 12, padding: '1rem', background: 'rgba(255,255,255,0.02)' }}>
        <h3 style={{ marginTop: 0 }}>Start Here</h3>
        <p style={{ opacity: 0.8 }}>Use the Admin area to manage artists, services, studio settings and integrations.</p>
        <Link
          href="/admin/artists"
          style={{
            display: 'inline-block',
            border: '1px solid #2ec4b6',
            background: 'rgba(46,196,182,0.1)',
            color: 'inherit',
            borderRadius: 999,
            padding: '0.4rem 0.8rem',
            textDecoration: 'none'
          }}
        >
          Open Artists
        </Link>
      </div>
    </StudioShell>
  );
}

