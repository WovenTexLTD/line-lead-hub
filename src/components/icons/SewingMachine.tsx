import type { SVGProps } from "react";

export function SewingMachine(props: SVGProps<SVGSVGElement> & { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Needle body - diagonal */}
      <line x1="14" y1="2" x2="4" y2="18" />
      {/* Needle eye */}
      <circle cx="12.5" cy="4.5" r="1.5" />
      {/* Thread flowing through eye and curving down */}
      <path d="M14 4.5c2 1 3 3 2.5 6s-2 5-1.5 7.5c.3 1.5 1.5 2.5 3 3" />
    </svg>
  );
}
