import Link from 'next/link';

const navItems = [
  { href: '/', label: 'Overview' },
  { href: '/clients', label: 'Clients' },
  { href: '/bookings', label: 'Bookings' },
  { href: '/calendar', label: 'Calendar' },
  { href: '/pos', label: 'POS' },
  { href: '/reports', label: 'Reports' },
  { href: '/admin/artists', label: 'Admin' }
];

export default function StudioShell({ title, subtitle, children, fullWidth = false, hideHeading = false }) {
  return (
    <main
      style={{
        padding: fullWidth ? '1rem 1.25rem' : '2rem',
        maxWidth: fullWidth ? 'none' : 1200,
        margin: '0 auto'
      }}
    >
      <header style={{ marginBottom: hideHeading ? '0.75rem' : '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                border: '1px solid #333',
                padding: '0.45rem 0.7rem',
                borderRadius: 999,
                textDecoration: 'none',
                color: 'inherit'
              }}
            >
              {item.label}
            </Link>
          ))}
        </div>
        {!hideHeading ? <h1 style={{ margin: 0 }}>{title}</h1> : null}
        {!hideHeading && subtitle ? <p style={{ marginTop: '0.5rem', opacity: 0.8 }}>{subtitle}</p> : null}
      </header>
      {children}
    </main>
  );
}
