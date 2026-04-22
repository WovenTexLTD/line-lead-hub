import { differenceInDays, parseISO } from "date-fns";
import type { ScheduleWithDetails } from "@/hooks/useProductionSchedule";

/**
 * A rendered segment of a schedule bar. Each schedule may produce multiple
 * segments when the overlap count changes along its duration.
 */
export interface BarSegment {
  /** Which schedule this segment belongs to */
  scheduleId: string;
  schedule: ScheduleWithDetails;
  /** Day offsets relative to visibleStart (0-based) */
  startDay: number;
  endDay: number; // inclusive
  /** Lane assignment within this segment's overlap group */
  lane: number;
  /** Total concurrent lanes in this segment */
  totalLanes: number;
  /** Is this the first visible segment of its schedule? (controls left rounding) */
  isFirstSegment: boolean;
  /** Is this the last visible segment of its schedule? (controls right rounding) */
  isLastSegment: boolean;
}

interface Event {
  day: number;
  type: "start" | "end";
  scheduleId: string;
}

/**
 * Compute segmented lane layout for all schedules on a single line.
 *
 * Algorithm:
 * 1. Clip each schedule to the visible range, producing day offsets.
 * 2. Create sweep-line events at each schedule start and end+1.
 * 3. Walk events chronologically. Between each pair of events where the
 *    active set is non-empty, produce a segment for every active schedule.
 * 4. Assign lanes greedily, keeping consistent assignment when possible
 *    (a schedule stays in its lane from the previous segment if that lane
 *    is still available).
 */
export function computeSegments(
  schedules: ScheduleWithDetails[],
  visibleStart: Date,
  visibleEnd: Date,
): BarSegment[] {
  if (schedules.length === 0) return [];

  // 1. Compute clipped day offsets for each schedule
  const items = schedules.map((s) => {
    const rawStart = parseISO(s.start_date);
    const rawEnd = parseISO(s.end_date);
    const clippedStart = rawStart < visibleStart ? visibleStart : rawStart;
    const clippedEnd = rawEnd > visibleEnd ? visibleEnd : rawEnd;
    return {
      id: s.id,
      schedule: s,
      startDay: differenceInDays(clippedStart, visibleStart),
      endDay: differenceInDays(clippedEnd, visibleStart), // inclusive
      startsBeforeView: rawStart < visibleStart,
      endsAfterView: rawEnd > visibleEnd,
    };
  }).filter((item) => item.startDay <= item.endDay); // filter out completely out-of-range

  if (items.length === 0) return [];

  // 2. Create events
  const events: Event[] = [];
  for (const item of items) {
    events.push({ day: item.startDay, type: "start", scheduleId: item.id });
    events.push({ day: item.endDay + 1, type: "end", scheduleId: item.id });
  }

  // Sort: by day, ends before starts at the same day
  events.sort((a, b) => {
    if (a.day !== b.day) return a.day - b.day;
    // ends before starts so the departing schedule is removed before the new one arrives
    return a.type === "end" ? -1 : 1;
  });

  // 3. Sweep
  const activeSet = new Set<string>();
  const segments: BarSegment[] = [];
  // Track last lane assignment per schedule for consistency
  const lastLane = new Map<string, number>();
  // Track which segments belong to each schedule (to mark first/last)
  const segmentsBySchedule = new Map<string, BarSegment[]>();

  let prevDay: number | null = null;

  for (const event of events) {
    // Emit segments for the interval [prevDay, event.day - 1] if activeSet non-empty
    if (prevDay !== null && prevDay < event.day && activeSet.size > 0) {
      const segmentStart = prevDay;
      const segmentEnd = event.day - 1;
      const activeIds = Array.from(activeSet);
      const totalLanes = activeIds.length;

      // Assign lanes: try to keep previous assignment, fill gaps greedily
      const usedLanes = new Set<number>();
      const laneAssignment = new Map<string, number>();

      // First pass: keep previous lanes where possible
      for (const id of activeIds) {
        const prev = lastLane.get(id);
        if (prev !== undefined && prev < totalLanes && !usedLanes.has(prev)) {
          laneAssignment.set(id, prev);
          usedLanes.add(prev);
        }
      }

      // Second pass: assign remaining to lowest available lane
      for (const id of activeIds) {
        if (laneAssignment.has(id)) continue;
        for (let lane = 0; lane < totalLanes; lane++) {
          if (!usedLanes.has(lane)) {
            laneAssignment.set(id, lane);
            usedLanes.add(lane);
            break;
          }
        }
      }

      // Create segments
      for (const id of activeIds) {
        const item = items.find((i) => i.id === id)!;
        const lane = laneAssignment.get(id)!;
        lastLane.set(id, lane);

        const seg: BarSegment = {
          scheduleId: id,
          schedule: item.schedule,
          startDay: segmentStart,
          endDay: segmentEnd,
          lane,
          totalLanes,
          // Will be set correctly after all segments are collected
          isFirstSegment: false,
          isLastSegment: false,
        };

        segments.push(seg);
        const list = segmentsBySchedule.get(id) ?? [];
        list.push(seg);
        segmentsBySchedule.set(id, list);
      }
    }

    // Process event
    if (event.type === "start") {
      activeSet.add(event.scheduleId);
    } else {
      activeSet.delete(event.scheduleId);
      lastLane.delete(event.scheduleId);
    }

    prevDay = event.day;
  }

  // 4. Mark first/last segments per schedule, accounting for view clipping
  for (const item of items) {
    const segs = segmentsBySchedule.get(item.id);
    if (!segs || segs.length === 0) continue;
    segs[0].isFirstSegment = !item.startsBeforeView;
    segs[segs.length - 1].isLastSegment = !item.endsAfterView;
  }

  return segments;
}
