import { useUIStore } from '../../stores/uiStore';

interface LogoProps {
  className?: string;
  /** Override theme — use 'dark' when the container always has a dark background (e.g. login left panel) */
  forceTheme?: 'dark' | 'light';
}

/**
 * Full horizontal logo: [icon] flowfy + tagline.
 * Theme-aware: "flow" text is white on dark, dark-navy on light.
 */
export function FlowfyLogo({ className, forceTheme }: LogoProps) {
  const storeTheme = useUIStore((s) => s.theme);
  const theme = forceTheme ?? storeTheme;
  const textColor = theme === 'dark' ? '#F8FAFC' : '#0F172A';
  const taglineColor = theme === 'dark' ? '#94A3B8' : '#475569';

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 400 140"
      className={className}
      aria-label="Flowfy"
      role="img"
    >
      <defs>
        <linearGradient id="ll-flowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#0D9488', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: '#10B981', stopOpacity: 1 }} />
        </linearGradient>
        <linearGradient id="ll-accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style={{ stopColor: '#6366F1', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: '#8B5CF6', stopOpacity: 1 }} />
        </linearGradient>
        <filter id="ll-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="ll-shadow" x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#10B98140" floodOpacity="1" />
        </filter>
        <linearGradient id="ll-iconBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#0F172A', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: '#1E293B', stopOpacity: 1 }} />
        </linearGradient>
        <linearGradient id="ll-borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#0D9488', stopOpacity: 0.8 }} />
          <stop offset="100%" style={{ stopColor: '#6366F1', stopOpacity: 0.8 }} />
        </linearGradient>
      </defs>

      {/* Icon: glow ring + dark bg */}
      <rect x="7" y="7" width="126" height="126" rx="31" ry="31" fill="none" stroke="url(#ll-borderGrad)" strokeWidth="1.5" opacity="0.7" />
      <rect x="10" y="10" width="120" height="120" rx="28" ry="28" fill="url(#ll-iconBg)" filter="url(#ll-shadow)" />

      {/* Waves */}
      <path d="M 28 95 Q 45 78 62 88 Q 79 98 96 82 Q 108 70 115 65" stroke="url(#ll-flowGrad)" strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.5" />
      <path d="M 28 78 Q 45 60 62 72 Q 79 84 96 65 Q 108 52 115 48" stroke="url(#ll-flowGrad)" strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.75" />
      <path d="M 28 60 Q 45 42 62 55 Q 79 68 96 48 Q 108 34 115 30" stroke="url(#ll-flowGrad)" strokeWidth="5.5" strokeLinecap="round" fill="none" filter="url(#ll-glow)" />

      {/* Accent dot */}
      <circle cx="115" cy="30" r="7" fill="url(#ll-accentGrad)" filter="url(#ll-glow)" />
      <circle cx="115" cy="30" r="3" fill="white" opacity="0.9" />
      <polyline points="108,38 115,30 122,38" stroke="url(#ll-accentGrad)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />

      {/* Text: "flow" — theme-aware */}
      <text
        x="148" y="88"
        fontFamily="'Georgia', 'Palatino', serif"
        fontSize="58"
        fontWeight="700"
        letterSpacing="-2"
        fill={textColor}
      >
        flow
      </text>

      {/* Text: "fy" — always teal gradient */}
      <text
        x="290" y="88"
        fontFamily="'Georgia', 'Palatino', serif"
        fontSize="58"
        fontWeight="700"
        letterSpacing="-2"
        fill="url(#ll-flowGrad)"
        filter="url(#ll-glow)"
      >
        fy
      </text>

      {/* Tagline — theme-aware */}
      <text
        x="149" y="112"
        fontFamily="'Helvetica Neue', 'Arial', sans-serif"
        fontSize="13"
        fontWeight="400"
        letterSpacing="3.5"
        fill={taglineColor}
      >
        FAMILY FINANCE
      </text>

      {/* Accent line */}
      <line x1="149" y1="118" x2="252" y2="118" stroke="url(#ll-accentGrad)" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

/**
 * Icon-only variant (square).
 * The icon always has a dark background — it's a brand mark.
 */
export function FlowfyIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 140 140"
      className={className}
      aria-label="Flowfy"
      role="img"
    >
      <defs>
        <linearGradient id="fi-flowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#0D9488', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: '#10B981', stopOpacity: 1 }} />
        </linearGradient>
        <linearGradient id="fi-accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style={{ stopColor: '#6366F1', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: '#8B5CF6', stopOpacity: 1 }} />
        </linearGradient>
        <filter id="fi-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="fi-shadow" x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#10B98140" floodOpacity="1" />
        </filter>
        <linearGradient id="fi-iconBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#0F172A', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: '#1E293B', stopOpacity: 1 }} />
        </linearGradient>
        <linearGradient id="fi-borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#0D9488', stopOpacity: 0.8 }} />
          <stop offset="100%" style={{ stopColor: '#6366F1', stopOpacity: 0.8 }} />
        </linearGradient>
      </defs>

      {/* Glow ring */}
      <rect x="7" y="7" width="126" height="126" rx="31" ry="31" fill="none" stroke="url(#fi-borderGrad)" strokeWidth="1.5" opacity="0.7" />
      {/* Dark bg — always dark, it's the brand icon */}
      <rect x="10" y="10" width="120" height="120" rx="28" ry="28" fill="url(#fi-iconBg)" filter="url(#fi-shadow)" />

      {/* Waves */}
      <path d="M 28 95 Q 45 78 62 88 Q 79 98 96 82 Q 108 70 115 65" stroke="url(#fi-flowGrad)" strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.5" />
      <path d="M 28 78 Q 45 60 62 72 Q 79 84 96 65 Q 108 52 115 48" stroke="url(#fi-flowGrad)" strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.75" />
      <path d="M 28 60 Q 45 42 62 55 Q 79 68 96 48 Q 108 34 115 30" stroke="url(#fi-flowGrad)" strokeWidth="5.5" strokeLinecap="round" fill="none" filter="url(#fi-glow)" />

      {/* Accent dot */}
      <circle cx="115" cy="30" r="7" fill="url(#fi-accentGrad)" filter="url(#fi-glow)" />
      <circle cx="115" cy="30" r="3" fill="white" opacity="0.9" />
      <polyline points="108,38 115,30 122,38" stroke="url(#fi-accentGrad)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
