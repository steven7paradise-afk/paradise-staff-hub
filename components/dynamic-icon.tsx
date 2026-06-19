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
  Share2
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
  Share2
} as const;

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
