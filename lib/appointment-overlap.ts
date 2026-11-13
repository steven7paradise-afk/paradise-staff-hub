import { appointmentVisits } from "./appointment-visits";

type VisitBooking = Parameters<typeof appointmentVisits>[0][number];

type BookingInterval = {
  bookingId: string;
  visitIndex: number;
  start: number;
  end: number;
};

export function overlappingAppointmentsByWorker<T extends VisitBooking>(
  bookings: T[],
  workerIds: (booking: T) => readonly string[],
): Map<string, Set<string>> {
  const intervalsByWorker = new Map<string, BookingInterval[]>();

  for (const [visitIndex, visit] of appointmentVisits(bookings).entries()) {
    for (const booking of visit) {
      if (booking.isCanceled || !booking.endDate) continue;
      const start = Date.parse(booking.startDate);
      const end = Date.parse(booking.endDate);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;

      const interval = { bookingId: booking.id, visitIndex, start, end };
      for (const workerId of new Set(workerIds(booking))) {
        if (!workerId) continue;
        const intervals = intervalsByWorker.get(workerId);
        if (intervals) intervals.push(interval);
        else intervalsByWorker.set(workerId, [interval]);
      }
    }
  }

  const overlapsByWorker = new Map<string, Set<string>>();
  for (const [workerId, intervals] of intervalsByWorker) {
    const overlappingIds = new Set<string>();
    intervals.sort((left, right) => left.start - right.start);
    for (const [index, current] of intervals.entries()) {
      for (let nextIndex = index + 1; nextIndex < intervals.length; nextIndex++) {
        const next = intervals[nextIndex];
        if (next.start >= current.end) break;
        if (current.visitIndex === next.visitIndex) continue;
        overlappingIds.add(current.bookingId);
        overlappingIds.add(next.bookingId);
      }
    }
    if (overlappingIds.size) overlapsByWorker.set(workerId, overlappingIds);
  }

  return overlapsByWorker;
}
