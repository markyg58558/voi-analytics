import Link from 'next/link';

const items = [
  { href: '/admin/artists', label: 'Artists' },
  { href: '/admin/availability', label: 'Availability' },
  { href: '/admin/services', label: 'Services' },
  { href: '/admin/studio', label: 'Studio', disabled: true }
];

export default function AdminSubnav({ activeHref }) {
  return (
    <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
      {items.map((item) => {
        const active = item.href === activeHref;
        const baseStyle = {
          border: `1px solid ${active ? '#2ec4b6' : '#333'}`,
          background: active ? 'rgba(46,196,182,0.1)' : 'transparent',
          color: active ? '#c7fff6' : 'inherit',
          borderRadius: 999,
          padding: '0.35rem 0.7rem',
          textDecoration: 'none',
          opacity: item.disabled ? 0.55 : 1
        };

        if (item.disabled) {
          return (
            <span key={item.href} style={baseStyle} title="Coming soon">
              {item.label}
            </span>
          );
        }

        return (
          <Link key={item.href} href={item.href} style={baseStyle}>
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
