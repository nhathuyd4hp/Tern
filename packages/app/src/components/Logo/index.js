const Logo = ({ width }) => (
  <svg width={width} viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="logo-gradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#38bdf8" />
        <stop offset="1" stopColor="#2563eb" />
      </linearGradient>
    </defs>
    <rect width="72" height="72" rx="15.84" fill="url(#logo-gradient)" />
    <polygon points="25.92,31.68 37.44,18.72 51.84,7.2 45.36,23.04 49.68,33.12 40.32,36" fill="#ffffff" />
    <polygon points="31.68,39.6 36,50.4 41.76,61.92 43.92,50.4 45.36,44.64 38.88,41.76" fill="#ffffff" />
    <polygon points="11.52,33.84 19.44,28.8 27.36,30.24 41.76,36 53.28,43.2 63.36,50.4 54.72,49.68 57.6,57.6 47.52,48.96 36,44.64 24.48,41.04 17.28,38.16" fill="#ffffff" />
    <polygon points="7.2,33.84 14.4,30.96 14.4,36" fill="#fb923c" />
    <circle cx="18" cy="33.12" r="1.01" fill="#1e40af" />
  </svg>
);

export default Logo;
