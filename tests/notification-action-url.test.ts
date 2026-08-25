import assert from "node:assert/strict";
import test from "node:test";
import { isAttendanceNotification, resolveNotificationActionUrl } from "../lib/notification-action-url";

test("una notifica task apre direttamente la task collegata", () => {
  const notification = {
    id: "notification-1",
    title: "Nuova task",
    message: "Controlla il magazzino",
    type: "TASK",
    actionUrl: "/tasks?task=task-123",
  };

  assert.equal(isAttendanceNotification(notification), false);
  assert.equal(resolveNotificationActionUrl(notification), "/tasks?task=task-123");
});

test("una notifica di timbratura resta un avviso e non apre Presenze", () => {
  const notification = {
    id: "notification-2",
    title: "Attenzione pausa superata",
    message: "Hai superato il limite della pausa.",
    type: "TIMBRATURA",
    actionUrl: "/attendance",
  };

  assert.equal(isAttendanceNotification(notification), true);
  assert.equal(resolveNotificationActionUrl(notification), "/notifications?notice=notification-2&section=attendance");
});
