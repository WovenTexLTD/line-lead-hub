import { format } from "date-fns";

/** "Jan 5" */
export function formatShortDate(dateString: string): string {
  return format(new Date(dateString), "MMM d");
}

/** "Jan 5, 2026" */
export function formatDate(dateString: string): string {
  return format(new Date(dateString), "MMM d, yyyy");
}

/** "2:30 PM" */
export function formatTime(dateString: string): string {
  return format(new Date(dateString), "h:mm a");
}

/** "Jan 5, 2026 at 2:30 PM" */
export function formatDateTime(dateString: string): string {
  return format(new Date(dateString), "MMM d, yyyy 'at' h:mm a");
}

/** "2026-01-05" — for DB queries / production_date */
export function toISODate(date: Date = new Date()): string {
  return format(date, "yyyy-MM-dd");
}
