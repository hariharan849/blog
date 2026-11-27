/** Abstract hero illustration: an agent graph of connected nodes, drawn in theme colors. */
export default function HeroArt() {
  const nodes = [
    { x: 60, y: 70, r: 22 },
    { x: 200, y: 40, r: 16 },
    { x: 320, y: 110, r: 26 },
    { x: 150, y: 170, r: 30 },
    { x: 280, y: 240, r: 18 },
    { x: 90, y: 270, r: 16 },
    { x: 380, y: 230, r: 14 },
  ];
  const edges = [
    [0, 1], [1, 2], [0, 3], [1, 3], [2, 3], [3, 4], [3, 5], [2, 6], [4, 6], [4, 5],
  ];
  return (
    <svg className="hero-art" viewBox="0 0 440 320" role="img" aria-label="Illustration of connected AI agents">
      <defs>
        <linearGradient id="hero-node" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--brand-2)" />
          <stop offset="1" stopColor="var(--brand)" />
        </linearGradient>
      </defs>
      <rect x="8" y="8" width="424" height="304" rx="24" className="hero-art-panel" />
      {edges.map(([a, b]) => (
        <line key={`${a}-${b}`} x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y} className="hero-art-edge" />
      ))}
      {nodes.map((n, i) => (
        <g key={i}>
          <circle cx={n.x} cy={n.y} r={n.r + 8} className="hero-art-halo" />
          <circle cx={n.x} cy={n.y} r={n.r} fill="url(#hero-node)" />
        </g>
      ))}
      <rect x="128" y="160" width="44" height="6" rx="3" className="hero-art-line" />
      <rect x="128" y="172" width="30" height="6" rx="3" className="hero-art-line" />
    </svg>
  );
}
