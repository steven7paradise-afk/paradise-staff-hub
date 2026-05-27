import type { Role } from "@/lib/roles";
import type { DefaultSession } from "next-auth";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    role: Role;
    sedeId?: string | null;
  }

  interface Session {
    user: {
      id: string;
      role: Role;
      sedeId?: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role;
    sedeId?: string;
  }
}
