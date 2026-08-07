import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  FileCheck2,
  FileText,
  Mail,
  Megaphone,
  ShoppingBag,
  User,
} from "lucide-react";

export type PersonColor = {
  badge: string;
  avatarBg: string;
  avatarText: string;
};

export type SalonColor = {
  badge: string;
};

export type CategoryStyle = {
  label: string;
  isOrder: boolean;
  badge: string;
  borderLeft: string;
  iconBg: string;
  iconText: string;
  Icon: LucideIcon;
};

export type NotificationMetadata = {
  personName: string | null;
  personInitials: string | null;
  personColor: PersonColor | null;
  salonName: string | null;
  salonColor: SalonColor | null;
  category: CategoryStyle;
};

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

const PERSON_PALETTES: PersonColor[] = [
  {
    badge: "bg-pink-100/90 text-pink-900 border border-pink-300 dark:bg-pink-950/80 dark:text-pink-200 dark:border-pink-800",
    avatarBg: "bg-pink-600 text-white",
    avatarText: "text-pink-700 dark:text-pink-300",
  },
  {
    badge: "bg-indigo-100/90 text-indigo-900 border border-indigo-300 dark:bg-indigo-950/80 dark:text-indigo-200 dark:border-indigo-800",
    avatarBg: "bg-indigo-600 text-white",
    avatarText: "text-indigo-700 dark:text-indigo-300",
  },
  {
    badge: "bg-emerald-100/90 text-emerald-900 border border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-800",
    avatarBg: "bg-emerald-600 text-white",
    avatarText: "text-emerald-700 dark:text-emerald-300",
  },
  {
    badge: "bg-amber-100/90 text-amber-950 border border-amber-300 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-800",
    avatarBg: "bg-amber-600 text-white",
    avatarText: "text-amber-800 dark:text-amber-300",
  },
  {
    badge: "bg-cyan-100/90 text-cyan-950 border border-cyan-300 dark:bg-cyan-950/80 dark:text-cyan-200 dark:border-cyan-800",
    avatarBg: "bg-cyan-600 text-white",
    avatarText: "text-cyan-800 dark:text-cyan-300",
  },
  {
    badge: "bg-violet-100/90 text-violet-950 border border-violet-300 dark:bg-violet-950/80 dark:text-violet-200 dark:border-violet-800",
    avatarBg: "bg-violet-600 text-white",
    avatarText: "text-violet-800 dark:text-violet-300",
  },
  {
    badge: "bg-sky-100/90 text-sky-950 border border-sky-300 dark:bg-sky-950/80 dark:text-sky-200 dark:border-sky-800",
    avatarBg: "bg-sky-600 text-white",
    avatarText: "text-sky-800 dark:text-sky-300",
  },
  {
    badge: "bg-teal-100/90 text-teal-950 border border-teal-300 dark:bg-teal-950/80 dark:text-teal-200 dark:border-teal-800",
    avatarBg: "bg-teal-600 text-white",
    avatarText: "text-teal-800 dark:text-teal-300",
  },
];

export function getPersonColor(name: string): PersonColor {
  const index = hashString(name) % PERSON_PALETTES.length;
  return PERSON_PALETTES[index];
}

const SALON_PALETTES: SalonColor[] = [
  { badge: "bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-800" },
  { badge: "bg-purple-100 text-purple-800 border border-purple-300 dark:bg-purple-950/80 dark:text-purple-200 dark:border-purple-800" },
  { badge: "bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-800" },
  { badge: "bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950/80 dark:text-rose-200 dark:border-rose-800" },
  { badge: "bg-indigo-100 text-indigo-800 border border-indigo-300 dark:bg-indigo-950/80 dark:text-indigo-200 dark:border-indigo-800" },
  { badge: "bg-cyan-100 text-cyan-900 border border-cyan-300 dark:bg-cyan-950/80 dark:text-cyan-200 dark:border-cyan-800" },
];

export function getSalonColor(name: string): SalonColor {
  const index = hashString(name) % SALON_PALETTES.length;
  return SALON_PALETTES[index];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

type UserRef = { id?: string; name: string; locationName?: string | null; locationId?: string | null };
type LocationRef = { id?: string; name: string };

export function parseNotificationMetadata(
  notification: { title: string; message: string; type: string },
  knownUsers?: UserRef[],
  knownLocations?: LocationRef[]
): NotificationMetadata {
  const fullText = `${notification.title} ${notification.message}`;
  const lowerText = fullText.toLowerCase();

  // 1. Extract Person
  let personName: string | null = null;
  let salonNameFromUser: string | null = null;

  const personPatterns = [
    /Il dipendente\s+([A-Z\u00C0-\u024F][a-z\u00C0-\u024F]+(?:\s+[A-Z\u00C0-\u024F][a-z\u00C0-\u024F]+)*)/i,
    /Dipendente\s+([A-Z\u00C0-\u024F][a-z\u00C0-\u024F]+(?:\s+[A-Z\u00C0-\u024F][a-z\u00C0-\u024F]+)*)/i,
    /da parte di\s+([A-Z\u00C0-\u024F][a-z\u00C0-\u024F]+(?:\s+[A-Z\u00C0-\u024F][a-z\u00C0-\u024F]+)*)/i,
    /assegnato a\s+([A-Z\u00C0-\u024F][a-z\u00C0-\u024F]+(?:\s+[A-Z\u00C0-\u024F][a-z\u00C0-\u024F]+)*)/i,
    /timbratura di\s+([A-Z\u00C0-\u024F][a-z\u00C0-\u024F]+(?:\s+[A-Z\u00C0-\u024F][a-z\u00C0-\u024F]+)*)/i,
  ];

  for (const pat of personPatterns) {
    const match = notification.message.match(pat);
    if (match && match[1]) {
      const candidate = match[1].trim();
      if (candidate.length > 2 && !/^(una|un|il|la|del|della|modulo)$/i.test(candidate)) {
        personName = candidate;
        break;
      }
    }
  }

  if (knownUsers && knownUsers.length > 0) {
    const matchedUser = knownUsers.find((u) => u.name && lowerText.includes(u.name.toLowerCase()));
    if (matchedUser) {
      if (!personName) personName = matchedUser.name;
      if (matchedUser.locationName) salonNameFromUser = matchedUser.locationName;
    } else if (personName) {
      const found = knownUsers.find((u) => u.name.toLowerCase() === personName?.toLowerCase() || u.name.toLowerCase().includes(personName?.toLowerCase() ?? ""));
      if (found?.locationName) salonNameFromUser = found.locationName;
    }
  }

  // 2. Extract Salon
  let salonName: string | null = salonNameFromUser;

  const locMatch = notification.message.match(/\((?:Salone|Sede)\s+([^)]+)\)/i) || notification.message.match(/salone\s+([A-Z\u00C0-\u024F][a-z\u00C0-\u024F]+)/i);
  if (locMatch && locMatch[1]) {
    salonName = locMatch[1].trim();
  }

  if (!salonName && knownLocations && knownLocations.length > 0) {
    const matchedLoc = knownLocations.find((loc) => lowerText.includes(loc.name.toLowerCase()));
    if (matchedLoc) salonName = matchedLoc.name;
  }

  // 3. Category / Form / Order type identification
  const isOrder = lowerText.includes("modulo ordine") || lowerText.includes("ordine") || lowerText.includes("order");
  let formName: string | null = null;

  const formNameMatch = notification.title.match(/Modulo Compilato:\s*(.+)/i) || notification.message.match(/modulo\s*"([^"]+)"/i);
  if (formNameMatch && formNameMatch[1]) {
    formName = formNameMatch[1].trim();
  }

  let category: CategoryStyle;

  if (isOrder || (formName && formName.toLowerCase().includes("ordine"))) {
    category = {
      label: formName || "Modulo Ordine",
      isOrder: true,
      badge: "bg-[#7C3AED] text-white font-extrabold shadow-2xs border border-purple-400 dark:bg-purple-700 dark:text-white",
      borderLeft: "border-l-4 border-l-[#7C3AED]",
      iconBg: "bg-purple-100 text-[#7C3AED] dark:bg-purple-950 dark:text-purple-300",
      iconText: "text-[#7C3AED]",
      Icon: ShoppingBag,
    };
  } else if (notification.type === "FORM" || (formName && !isOrder)) {
    category = {
      label: formName || "Modulo Compilato",
      isOrder: false,
      badge: "bg-sky-100 text-sky-900 border border-sky-300 font-extrabold dark:bg-sky-950 dark:text-sky-200 dark:border-sky-800",
      borderLeft: "border-l-4 border-l-sky-500",
      iconBg: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
      iconText: "text-sky-600",
      Icon: FileText,
    };
  } else if (notification.type === "TIMBRATURA" || lowerText.includes("timbratura") || lowerText.includes("pausa")) {
    category = {
      label: "Timbratura & Pause",
      isOrder: false,
      badge: "bg-rose-100 text-rose-900 border border-rose-300 font-extrabold dark:bg-rose-950 dark:text-rose-200 dark:border-rose-800",
      borderLeft: "border-l-4 border-l-rose-500",
      iconBg: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
      iconText: "text-rose-600",
      Icon: Clock,
    };
  } else if (notification.type === "TASK" || lowerText.includes("task")) {
    category = {
      label: "Task",
      isOrder: false,
      badge: "bg-violet-100 text-violet-900 border border-violet-300 font-extrabold dark:bg-violet-950 dark:text-violet-200 dark:border-violet-800",
      borderLeft: "border-l-4 border-l-violet-500",
      iconBg: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
      iconText: "text-violet-600",
      Icon: CheckCircle2,
    };
  } else if (notification.type === "RICHIESTA" || lowerText.includes("richiesta") || lowerText.includes("ferie")) {
    category = {
      label: "Richiesta Staff",
      isOrder: false,
      badge: "bg-amber-100 text-amber-950 border border-amber-300 font-extrabold dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800",
      borderLeft: "border-l-4 border-l-amber-500",
      iconBg: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
      iconText: "text-amber-600",
      Icon: FileCheck2,
    };
  } else if (notification.type === "CONTRACT_EXPIRY" || lowerText.includes("contratto")) {
    category = {
      label: "Scadenza Contratto",
      isOrder: false,
      badge: "bg-red-100 text-red-950 border border-red-300 font-extrabold dark:bg-red-950 dark:text-red-200 dark:border-red-800",
      borderLeft: "border-l-4 border-l-red-500",
      iconBg: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
      iconText: "text-red-600",
      Icon: AlertTriangle,
    };
  } else if (notification.type === "DOCUMENTO" || lowerText.includes("documento")) {
    category = {
      label: "Documento",
      isOrder: false,
      badge: "bg-blue-100 text-blue-900 border border-blue-300 font-extrabold dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800",
      borderLeft: "border-l-4 border-l-blue-500",
      iconBg: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
      iconText: "text-blue-600",
      Icon: Mail,
    };
  } else {
    category = {
      label: "Comunicazione",
      isOrder: false,
      badge: "bg-pink-100 text-[#C66170] border border-pink-300 font-extrabold dark:bg-pink-950 dark:text-pink-200 dark:border-pink-800",
      borderLeft: "border-l-4 border-l-pink-500",
      iconBg: "bg-pink-100 text-[#C66170] dark:bg-pink-950 dark:text-pink-300",
      iconText: "text-[#C66170]",
      Icon: Megaphone,
    };
  }

  return {
    personName,
    personInitials: personName ? getInitials(personName) : null,
    personColor: personName ? getPersonColor(personName) : null,
    salonName,
    salonColor: salonName ? getSalonColor(salonName) : null,
    category,
  };
}
