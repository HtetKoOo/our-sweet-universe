export default function SpaceLoading() {
  return <section className="space-loading" aria-live="polite" aria-label="Loading your shared space">
    <span className="sr-only">Loading your shared space</span>
    <div className="loading-card loading-couple-card">
      <span className="loading-line loading-overline" />
      <span className="loading-heart" />
      <span className="loading-line loading-title" />
      <span className="loading-line loading-copy" />
      <div className="loading-stats"><span /><span /><span /></div>
    </div>
    <span className="loading-presence" />
    <div className="loading-shelf">
      <div className="loading-heading"><span /><span /></div>
      <div className="loading-widgets"><div /><div /><div /></div>
    </div>
  </section>;
}
