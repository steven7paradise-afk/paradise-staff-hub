export function compareCanceledAppointmentsLast(
  left: { isCanceled?: boolean },
  right: { isCanceled?: boolean },
) {
  const leftCanceled = left.isCanceled === true;
  const rightCanceled = right.isCanceled === true;

  if (leftCanceled === rightCanceled) return 0;
  return leftCanceled ? 1 : -1;
}
