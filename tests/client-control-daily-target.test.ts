import assert from "node:assert/strict";
import test from "node:test";
import { buildDailyClientControlTarget } from "../lib/client-control-daily-target";

function response({
  date = "2026-09-16T10:00:00.000Z",
  staff = "Angelica Pasculli",
  salon = "Buenos Aires",
  status = "Controllato",
}: {
  date?: string;
  staff?: string | string[];
  salon?: string;
  status?: string;
} = {}) {
  return {
    created_at: date,
    answers: {
      client_control_location: salon,
      client_control_service_staff: staff,
      client_control_correctness: status,
    },
    user_location_name: salon,
    user: { name: "Responsabile" },
  };
}

test("calcola l'obiettivo giornaliero e mostra chi è sotto 5 per primo", () => {
  const responses = [
    ...Array.from({ length: 6 }, () => response({ staff: "Angelica Pasculli" })),
    ...Array.from({ length: 3 }, () => response({ staff: "Sara Campani" })),
  ];

  const report = buildDailyClientControlTarget({
    responses,
    employeeNames: ["Angelica Pasculli", "Sara Campani"],
    dateKey: "2026-09-16",
    salon: "Tutti",
  });

  assert.equal(report.totalControls, 9);
  assert.equal(report.reachedTarget, 1);
  assert.deepEqual(report.workers.map((worker) => worker.name), ["Sara Campani", "Angelica Pasculli"]);
  assert.equal(report.workers[0].remaining, 2);
  assert.equal(report.workers[1].aboveTarget, 1);
});

test("esclude errori, no show e controlli di un altro salone", () => {
  const report = buildDailyClientControlTarget({
    responses: [
      response(),
      response({ status: "Errore" }),
      response({ status: "No Show" }),
      response({ salon: "Martinsicuro" }),
    ],
    employeeNames: ["Angelica Pasculli"],
    dateKey: "2026-09-16",
    salon: "Buenos Aires",
  });

  assert.equal(report.totalControls, 1);
  assert.equal(report.workers[0].controls, 1);
});

test("assegna un appuntamento a ogni collaboratore selezionato senza duplicare i nomi", () => {
  const report = buildDailyClientControlTarget({
    responses: [response({ staff: ["Sara Campani", "Sara Campani", "Claudia Saltini"] })],
    employeeNames: ["Sara Campani", "Claudia Saltini"],
    dateKey: "2026-09-16",
    salon: "Tutti",
  });

  assert.equal(report.totalControls, 2);
  assert.deepEqual(report.workers.map((worker) => worker.controls), [1, 1]);
});

test("mostra soltanto il personale autorizzato del salone, incluso chi ha zero appuntamenti", () => {
  const report = buildDailyClientControlTarget({
    responses: [
      response({ staff: "Angelica Pasculli" }),
      response({ staff: "Persona altra sede" }),
    ],
    employeeNames: ["Angelica Pasculli", "Sara Campani", "Persona altra sede"],
    allowedStaffNames: ["Angelica Pasculli", "Sara Campani"],
    dateKey: "2026-09-16",
    salon: "Tutti",
  });

  assert.deepEqual(report.workers.map((worker) => [worker.name, worker.controls]), [
    ["Sara Campani", 0],
    ["Angelica Pasculli", 1],
  ]);
});
