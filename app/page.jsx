const kpis = [
  { label: 'Today Sales', value: '$4,920', trend: '+12.4%' },
  { label: 'Bookings', value: '37', trend: '+8.1%' },
  { label: 'No-Shows', value: '3', trend: '-1.9%' },
  { label: 'Client Rebooks', value: '62%', trend: '+4.3%' }
];

const artists = [
  { name: 'Mitch', utilization: 86, sales: '$1,820', sessions: 9 },
  { name: 'Ellie', utilization: 81, sales: '$1,430', sessions: 7 },
  { name: 'Rico', utilization: 74, sales: '$930', sessions: 5 },
  { name: 'Syd', utilization: 69, sales: '$740', sessions: 4 }
];

const alerts = [
  '5 clients haven\'t rebooked in 45+ days',
  '2 deposits pending confirmation for tomorrow',
  'Inventory low: Black Ink 12oz (4 units left)'
];

const timeline = [
  { time: '09:00', event: 'Opening prep, machine checks' },
  { time: '10:30', event: 'High-value sleeve consult (new client)' },
  { time: '13:00', event: 'Flash walk-ins peak window' },
  { time: '16:45', event: 'Aftercare follow-up batch ready' }
];

export default function Home() {
  return (
    <main className="studio-app">
      <div className="background-glow" />
      <header className="hero">
        <p className="eyebrow">Victims Of Ink</p>
        <h1>Studio Command</h1>
        <p className="subhead">Live operations, artists, clients, and revenue in one view.</p>
      </header>

      <section className="kpi-grid">
        {kpis.map((kpi) => (
          <article className="kpi-card" key={kpi.label}>
            <p>{kpi.label}</p>
            <h2>{kpi.value}</h2>
            <span>{kpi.trend}</span>
          </article>
        ))}
      </section>

      <section className="content-grid">
        <article className="panel panel-wide">
          <div className="panel-head">
            <h3>Artist Floor Performance</h3>
            <button type="button">Open Team View</button>
          </div>
          <div className="artist-list">
            {artists.map((artist) => (
              <div className="artist-row" key={artist.name}>
                <div>
                  <p className="artist-name">{artist.name}</p>
                  <p>{artist.sessions} sessions</p>
                </div>
                <div className="bar-wrap">
                  <div className="bar-fill" style={{ width: `${artist.utilization}%` }} />
                </div>
                <p className="artist-util">{artist.utilization}%</p>
                <p className="artist-sales">{artist.sales}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <h3>Priority Alerts</h3>
          <ul>
            {alerts.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="panel">
          <h3>Today Timeline</h3>
          <ul className="timeline">
            {timeline.map((item) => (
              <li key={item.time}>
                <span>{item.time}</span>
                <p>{item.event}</p>
              </li>
            ))}
          </ul>
        </article>
      </section>
    </main>
  );
}
