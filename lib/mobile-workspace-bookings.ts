import { getCowlendarBookingsForRange } from "./cowlendar";
import { appointmentDayBoundaryIso } from "./appointment-date";
import { bookingBelongsToSalon, isWorkspaceAdmin } from "./mobile-workspace-policy";
import type { mobileWorkspace } from "./mobile-workspace-auth";

export async function workspaceBookings(context: NonNullable<Awaited<ReturnType<typeof mobileWorkspace>>>, date: string) {
  const bookings = await getCowlendarBookingsForRange({
    startDate: appointmentDayBoundaryIso(date), endDate: appointmentDayBoundaryIso(date, true), limit: 400,
  });
  // A salon remains location-scoped even while an administrator is signed in.
  const unrestricted = !context.device && context.auth && isWorkspaceAdmin(context.auth.user.role);
  const locationName = context.location?.name ?? context.auth?.user.location?.name ?? "";
  return [...new Map(bookings.filter((booking) => unrestricted ||
    bookingBelongsToSalon(booking.service?.title, locationName)).map((booking) => [booking.id, booking])).values()];
}
