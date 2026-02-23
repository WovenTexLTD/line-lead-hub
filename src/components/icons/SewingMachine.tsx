import { forwardRef } from "react";
import type { LucideProps } from "lucide-react";

export const SewingMachine = forwardRef<SVGSVGElement, LucideProps>(
  ({ color = "currentColor", size = 24, strokeWidth = 2, className, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Needle body - diagonal */}
      <line x1="14" y1="2" x2="4" y2="18" />
      {/* Needle eye */}
      <circle cx="12.5" cy="4.5" r="1.5" />
      {/* Thread flowing through eye and curving down */}
      <path d="M14 4.5c2 1 3 3 2.5 6s-2 5-1.5 7.5c.3 1.5 1.5 2.5 3 3" />
    </svg>
  )
);

SewingMachine.displayName = "SewingMachine";
