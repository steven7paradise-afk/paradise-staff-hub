import type { Role } from "@/lib/roles";

export const currentRole: Role = "SUPER_ADMIN";
export const currentUserId = "u4";

export const locations = [
  { id: "loc-duomo", name: "Paradise Duomo", address: "Via Duomo 01", active: true },
  { id: "loc-brera", name: "Paradise Brera", address: "Via Fiori Chiari 12", active: true },
  { id: "loc-roma", name: "Paradise Roma Parioli", address: "Via Archimede 84", active: true },
  { id: "loc-torino", name: "Paradise Torino Centro", address: "Via Lagrange 7", active: true },
];

export const employees = [
  { id: "u1", name: "Rosa Francesca", email: "rosa@paradisebeauty.it", role: "SUPER_ADMIN", locationId: "loc-duomo", location: "Paradise Duomo", active: true, hours: "168.5" },
  { id: "u2", name: "Laura Bianchi", email: "laura@paradisebeauty.it", role: "DIPENDENTE", locationId: "loc-duomo", location: "Paradise Duomo", active: true, hours: "154.0" },
  { id: "u3", name: "Wissal Amrani", email: "wissal@paradisebeauty.it", role: "DIPENDENTE", locationId: "loc-duomo", location: "Paradise Duomo", active: true, hours: "161.5" },
  { id: "u4", name: "Noemi Costa", email: "noemi@paradisebeauty.it", role: "DIPENDENTE", locationId: "loc-duomo", location: "Paradise Duomo", active: true, hours: "148.0" },
  { id: "u5", name: "Nicol Ferri", email: "nicol@paradisebeauty.it", role: "DIPENDENTE", locationId: "loc-duomo", location: "Paradise Duomo", active: true, hours: "152.0" },
  { id: "u6", name: "Silvia Conti", email: "silvia@paradisebeauty.it", role: "DIPENDENTE", locationId: "loc-duomo", location: "Paradise Duomo", active: true, hours: "150.0" },
  { id: "u7", name: "Giulia Martini", email: "giulia@paradisebeauty.it", role: "ADMIN", locationId: "loc-brera", location: "Paradise Brera", active: true, hours: "154.0" },
  { id: "u8", name: "Camilla Riva", email: "camilla@paradisebeauty.it", role: "RESPONSABILE", locationId: "loc-roma", location: "Paradise Roma Parioli", active: true, hours: "161.5" },
  { id: "u9", name: "Sara Greco", email: "sara@paradisebeauty.it", role: "DIPENDENTE", locationId: "loc-torino", location: "Paradise Torino Centro", active: true, hours: "146.0" },
  { id: "u10", name: "Clara Neri", email: "clara@paradisebeauty.it", role: "DIPENDENTE", locationId: "loc-brera", location: "Paradise Brera", active: false, hours: "0" },
];

export const devices = [
  { id: "d1", deviceId: "PB-MI-TAB-01", name: "iPad Reception Milano", location: "Milano Brera", status: "Attivo", lastUsed: "Oggi 09:01" },
  { id: "d2", deviceId: "PB-RM-TAB-01", name: "Tablet Team Roma", location: "Roma Parioli", status: "Attivo", lastUsed: "Oggi 08:54" },
  { id: "d3", deviceId: "PB-TO-TAB-02", name: "Tablet Backup Torino", location: "Torino Centro", status: "Bloccato", lastUsed: "20 mag" },
];

export const attendanceLogs = [
  { employee: "Giulia Martini", location: "Milano Brera", type: "Entrata", time: "09:01", date: "26 mag 2026", device: "PB-MI-TAB-01" },
  { employee: "Camilla Riva", location: "Roma Parioli", type: "Entrata", time: "08:54", date: "26 mag 2026", device: "PB-RM-TAB-01" },
  { employee: "Noemi Costa", location: "Torino Centro", type: "Pausa", time: "13:05", date: "26 mag 2026", device: "PB-TO-TAB-01" },
];

export const leaveRequests = [
  { employee: "Noemi Costa", type: "Ferie", range: "10 giu - 14 giu", status: "In attesa", reason: "Viaggio gia pianificato" },
  { employee: "Camilla Riva", type: "Permesso", range: "29 mag", status: "Approvata", reason: "Visita medica" },
  { employee: "Giulia Martini", type: "Ferie", range: "18 lug - 25 lug", status: "Segnalata", reason: "Sovrapposizione team" },
];

export const documents = [
  { userId: "u4", employee: "Noemi Costa", title: "Busta paga Aprile 2026", type: "Busta paga", month: "Aprile", year: 2026 },
  { userId: "u8", employee: "Camilla Riva", title: "Contratto aggiornato", type: "HR", month: "-", year: 2026 },
  { userId: "u7", employee: "Giulia Martini", title: "Busta paga Marzo 2026", type: "Busta paga", month: "Marzo", year: 2026 },
  { userId: "u2", employee: "Laura Bianchi", title: "Busta paga Aprile 2026", type: "Busta paga", month: "Aprile", year: 2026 },
];

export const notifications = [
  { title: "Nuova richiesta ferie", message: "Noemi Costa ha richiesto ferie dal 10 al 14 giugno.", type: "Ferie", read: false },
  { title: "Busta paga caricata", message: "Aprile 2026 disponibile per 12 dipendenti.", type: "Documenti", read: false },
  { title: "Tablet bloccato", message: "PB-TO-TAB-02 e stato bloccato dal Super Admin.", type: "Sistema", read: true },
];
