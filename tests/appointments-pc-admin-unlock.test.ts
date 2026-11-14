import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { POST } from "../app/api/appointments/pc/admin-unlock/route";
import { appointmentsPcCookieName, appointmentsPcWorkerCookieName } from "../lib/appointments-pc-auth";
import { prisma } from "../lib/prisma";

test("administrator access uses the device's real agenda and removes the previous operator cookie", async (t) => {
  const pcToken = "synthetic-admin-unlock-device";
  const pin = "7142";
  const pinHash = await bcrypt.hash(pin, 4);
  const findSetting = prisma.setting.findUnique;
  const findLocation = prisma.location.findUnique;
  const findAdmin = prisma.user.findFirst;
  t.after(() => {
    prisma.setting.findUnique = findSetting;
    prisma.location.findUnique = findLocation;
    prisma.user.findFirst = findAdmin;
  });

  prisma.setting.findUnique = (async () => ({ value: [{
    code: "fixture-device",
    name: "PC Cassa",
    locationId: "fixture-repubblica",
    accessTokenHash: createHash("sha256").update(pcToken).digest("hex"),
    archivedAt: null,
  }] })) as unknown as typeof findSetting;
  prisma.location.findUnique = (async () => ({ active: true, name: "Salone Repubblica" })) as unknown as typeof findLocation;
  prisma.user.findFirst = (async () => ({ id: "fixture-admin", name: "Amministratore demo", pin_hash: pinHash })) as unknown as typeof findAdmin;

  function unlock(code: string, token: string) {
    return POST(new NextRequest("https://staff.example.test/api/appointments/pc/admin-unlock", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${appointmentsPcCookieName}=${token}; ${appointmentsPcWorkerCookieName}=previous-worker`,
      },
      body: JSON.stringify({ pin: code, salone: "buenos-aires" }),
    }));
  }

  const wrongPin = await unlock("0000", pcToken);
  assert.equal(wrongPin.status, 403);
  assert.equal(wrongPin.cookies.get(appointmentsPcWorkerCookieName), undefined);

  const unauthorized = await unlock(pin, "invalid-device");
  assert.equal(unauthorized.status, 401);
  assert.equal(unauthorized.cookies.get(appointmentsPcWorkerCookieName), undefined);

  const response = await unlock(pin, pcToken);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).appointmentUrl, "/appointments/repubblica");
  assert.equal(response.cookies.get(appointmentsPcWorkerCookieName)?.maxAge, 0);
  assert.equal(response.cookies.get(appointmentsPcCookieName), undefined);
});
