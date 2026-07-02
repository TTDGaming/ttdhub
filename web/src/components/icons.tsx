import { SVGProps } from 'react';

/* Bộ icon nét mảnh (đường nét kiểu Lucide, MIT) — kích thước mặc định 18px, ăn theo currentColor */

function I({ children, size = 18, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconDashboard = (p: SVGProps<SVGSVGElement> & { size?: number }) => (
  <I {...p}>
    <rect x="3" y="3" width="7" height="9" rx="1" />
    <rect x="14" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="12" width="7" height="9" rx="1" />
    <rect x="3" y="16" width="7" height="5" rx="1" />
  </I>
);

export const IconChannels = (p: SVGProps<SVGSVGElement> & { size?: number }) => (
  <I {...p}>
    <rect x="2" y="7" width="20" height="14" rx="2" />
    <path d="m17 2-5 5-5-5" />
    <path d="M10 12l5 3-5 3v-6z" fill="currentColor" stroke="none" />
  </I>
);

export const IconUpload = (p: SVGProps<SVGSVGElement> & { size?: number }) => (
  <I {...p}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </I>
);

export const IconQueue = (p: SVGProps<SVGSVGElement> & { size?: number }) => (
  <I {...p}>
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </I>
);

export const IconCoins = (p: SVGProps<SVGSVGElement> & { size?: number }) => (
  <I {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="M16 8.5h-5.5a2 2 0 1 0 0 4h3a2 2 0 1 1 0 4H8" />
    <line x1="12" y1="6" x2="12" y2="18" />
  </I>
);

export const IconSettings = (p: SVGProps<SVGSVGElement> & { size?: number }) => (
  <I {...p}>
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </I>
);

export const IconSun = (p: SVGProps<SVGSVGElement> & { size?: number }) => (
  <I {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </I>
);

export const IconMoon = (p: SVGProps<SVGSVGElement> & { size?: number }) => (
  <I {...p}>
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  </I>
);

export const IconMonitor = (p: SVGProps<SVGSVGElement> & { size?: number }) => (
  <I {...p}>
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </I>
);

export const IconLogout = (p: SVGProps<SVGSVGElement> & { size?: number }) => (
  <I {...p}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </I>
);

export const IconRefresh = (p: SVGProps<SVGSVGElement> & { size?: number }) => (
  <I {...p}>
    <path d="M21 12a9 9 0 1 1-2.64-6.36L21 8" />
    <path d="M21 3v5h-5" />
  </I>
);

export const IconGlobe = (p: SVGProps<SVGSVGElement> & { size?: number }) => (
  <I {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="M2 12h20" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </I>
);

export const IconDownload = (p: SVGProps<SVGSVGElement> & { size?: number }) => (
  <I {...p}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </I>
);

export const IconPlus = (p: SVGProps<SVGSVGElement> & { size?: number }) => (
  <I {...p}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </I>
);

export const IconFilm = (p: SVGProps<SVGSVGElement> & { size?: number }) => (
  <I {...p}>
    <rect x="2" y="2" width="20" height="20" rx="2.18" />
    <line x1="7" y1="2" x2="7" y2="22" />
    <line x1="17" y1="2" x2="17" y2="22" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <line x1="2" y1="7" x2="7" y2="7" />
    <line x1="2" y1="17" x2="7" y2="17" />
    <line x1="17" y1="17" x2="22" y2="17" />
    <line x1="17" y1="7" x2="22" y2="7" />
  </I>
);
