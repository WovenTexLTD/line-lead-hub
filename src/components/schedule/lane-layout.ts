import { differenceInDays, parseISO } from "date-fns";
import type { ScheduleWithDetails } from "@/hooks/useProductionSchedule";

/**
 * A bar to render — one per schedule, no segmentation.
 * Each schedule gets a single lane for its entire duration.
 */
export interface BarLayout {
  schedule: ScheduleWithDetails;
  startDay: number;
  endDay: number; // inclusive
  lane: number;
  totalLanes: number;
  startsBeforeView: boolean;
  endsAfterView: boolean;
}

/**
 * Assign each schedule to a lane using greedy interval packing.
 * No segmentation — each bar is one continuous piece.
 *
 * Algorithm:
 * 1. Sort schedules by start date.
 * 2. Greedily assign each to the lowest lane where it doesn't overlap
 *    with any already-assigned schedule.
 * 3. Total lanes = max lane + 1.
 */
export function computeLayout(
  schedules: ScheduleWithDetails[],
  visibleStart: Date,
  visibleEnd: Date,
): BarLayout[] {
  if (schedules.length === 0) return [];

  // Clip to visible range
  const items = schedules.map((s) => {
    const rawStart = parseISO(s.start_date);
    const rawEnd = parseISO(s.end_date);
    const clippedStart = rawStart < visibleStart ? visibleStart : rawStart;
    const clippedEnd = rawEnd > visibleEnd ? visibleEnd : rawEnd;
    return {
      schedule: s,
      startDay: differenceInDays(clippedStart, visibleStart),
      endDay: differenceInDays(clippedEnd, visibleStart),
      startsBeforeView: rawStart < visibleStart,
      endsAfterView: rawEnd > visibleEnd,
    };
  }).filter((item) => item.startDay <= item.endDay);

  if (items.length === 0) return [];

  // Sort by start, then by longer duration first (so wider bars get lower lanes)
  items.sort((a, b) => a.startDay - b.startDay || (b.endDay - b.startDay) - (a.endDay - a.startDay));

  // Greedy lane assignment
  // lanes[i] = end day of the last bar assigned to lane i
  const lanes: number[] = [];

  const result: BarLayout[] = [];

  for (const item of items) {
    // Find the lowest lane where this bar fits (no overlap)
    let assignedLane = -1;
    for (let i = 0; i < lanes.length; i++) {
      if (lanes[i] < item.startDay) {
        assignedLane = i;
        break;
      }
    }
    if (assignedLane === -1) {
      assignedLane = lanes.length;
      lanes.push(-1);
    }
    lanes[assignedLane] = item.endDay;

    result.push({
      ...item,
      lane: assignedLane,
      totalLanes: 0, // will be set after all assignments
    });
  }

  // Set totalLanes for all bars
  const totalLanes = lanes.length;
  for (const bar of result) {
    bar.totalLanes = totalLanes;
  }

  return result;
}
