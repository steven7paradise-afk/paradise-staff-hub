"use client";

import React from "react";
import {
  Bell,
  CalendarCheck,
  CalendarDays,
  Calculator,
  CheckSquare,
  ClipboardList,
  FileText,
  Building2,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Smartphone,
  UserRound,
  Users,
  FilePenLine,
  Mail,
  Palette,
  PanelsTopLeft,
  Download,
  Table2,
  CheckCircle2,
  Clock3,
  UserPlus,
  AlertTriangle,
  FileCheck2,
  BellRing,
  Activity,
  ArrowRight,
  Heart,
  Smile,
  Star,
  Sparkles,
  Coffee,
  ShoppingBag,
  ShoppingCart,
  Utensils,
  DollarSign,
  MapPin,
  TrendingUp,
  Folder,
  Package,
  MoreHorizontal,
  Timer,
  Home,
  Share2,
  ReceiptText,
  RotateCcw,
  Video,
  MonitorCog
} from "lucide-react";

const iconMap = {
  Bell,
  CalendarCheck,
  CalendarDays,
  Calculator,
  CheckSquare,
  ClipboardList,
  FileText,
  Building2,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Smartphone,
  UserRound,
  Users,
  FilePenLine,
  Mail,
  Palette,
  PanelsTopLeft,
  Download,
  Table2,
  CheckCircle2,
  Clock3,
  UserPlus,
  AlertTriangle,
  FileCheck2,
  BellRing,
  Activity,
  ArrowRight,
  Heart,
  Smile,
  Star,
  Sparkles,
  Coffee,
  ShoppingBag,
  ShoppingCart,
  Utensils,
  DollarSign,
  MapPin,
  TrendingUp,
  Folder,
  Package,
  MoreHorizontal,
  Timer,
  Home,
  Share2,
  ReceiptText,
  RotateCcw,
  Video,
  MonitorCog,
  CashRegister
} as const;

function CashRegister({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M5.5 11 7 4h10l1.5 7" />
      <path d="M7.8 8.5h8.4" />
      <path d="M4 11h16v8H4z" />
      <path d="M7 15h10v4H7z" />
      <path d="M16.8 5.8h2.1a1.6 1.6 0 0 1 1.6 1.6v1.8a1.6 1.6 0 0 1-1.6 1.6h-.4" />
      <path d="M11 6.2h2" />
      <path d="M12 5.3v1.8" />
    </svg>
  );
}

export type IconName = keyof typeof iconMap;

interface DynamicIconProps {
  name: string;
  className?: string;
}

export function DynamicIcon({ name, className }: DynamicIconProps) {
  const IconComponent = iconMap[name as IconName];
  if (!IconComponent) {
    // Return a default icon or null if not found
    return <Settings className={className} />;
  }
  return <IconComponent className={className} />;
}
