import { writeFile } from "node:fs/promises";
import { chatDB as db } from "../lib/chat-db";
import { createMobileSession } from "../lib/mobile-auth";
async function main() {
  const url = new URL(process.env.DATABASE_URL!); if (url.hostname !== "127.0.0.1" || url.port !== "55439") throw Error("Local test database only");
  const users = await Promise.all(["Collega di prova", "Team di prova", "Responsabile di prova"].map((name, i) => db.user.create({data: {name, email: `preview-${Date.now()}-${i}@example.invalid`, password_hash: "disabled", role: i === 2 ? "ADMIN" : "DIPENDENTE"}})));
  const [a,b,admin] = users;
  const room = await db.chatRoom.create({data: { title: "Team · prova", kind: "group", members: {create: users.map(u => ({userId: u.id, manager: u.id === admin.id}))}}});
  for (const [i, [userId, body]] of [[a.id,"Buongiorno! Qui possiamo coordinarci per il turno."],[b.id,"Perfetto. I messaggi restano visibili solo ai partecipanti."],[admin.id,"Proviamo anche l’aggiornamento tra due account."]].entries()) {
    await db.chatMessage.create({data: {roomId: room.id, userId, body, clientId: `preview-${i}`}});
  }
  await db.chatRoom.create({data: {title: "Direzione · prova", kind: "channel", members: {create: [{userId: admin.id, manager: true}, {userId: a.id}]}}});
  await db.chatRoom.create({data: {title: "Chat privata", kind: "direct", directKey: JSON.stringify([admin.id,b.id].sort()), members: {create: [{userId: admin.id, manager: true}, {userId: b.id}]}}});
  const token = (await createMobileSession(admin.id, "isolated simulator preview", 3600000)).token;
  const otherToken = (await createMobileSession(a.id, "isolated chat test", 3600000)).token;
  await writeFile("../chat-preview-session.json", JSON.stringify({token, otherToken, id: admin.id, roomId: room.id}), {mode: 0o600});
  console.log("Local preview prepared");
}
main().finally(() => db.$disconnect());
