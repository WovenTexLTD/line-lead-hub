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
      {/* Needle - diagonal from upper-right to lower-left */}
      <line x1="17" y1="3" x2="4" y2="21" />
      {/* Needle eye */}
      <circle cx="15" cy="5.5" r="1.5" />
      {/* Thread through eye, curving down */}
      <path d="M16.5 5c2 2 1.5 5-1 8s-3 5-2 7" />
    </svg>
  );
}
