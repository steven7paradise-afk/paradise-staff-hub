import bcrypt from "bcryptjs";
import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { canAccess, getEffectivePermissionSet, type Role } from "@/lib/roles";
import { pinLookup } from "@/lib/pin";
import { canAccessSalonShiftModules, isShiftProtectedPath } from "@/lib/salon-shift-access";
import { appointmentsPcCookieName, checkPCAuthorization } from "@/lib/appointments-pc-auth";
import { FORMER_EMPLOYEE_STATUS, hasFormerEmployeeDocumentAccess, isFormerEmployeeAllowedPath } from "@/lib/former-employee";

function isPublicOperationalRequest(pathname: string, method: string) {
  if (pathname === "/login" || pathname === "/login/") return true;
  if (pathname.startsWith("/api/auth/")) return true;
  if (pathname === "/api/health") return true;
  if (pathname === "/appointments/register" || pathname.startsWith("/appointments/register/")) return true;
  if (pathname === "/tablet-clock" || pathname.startsWith("/tablet-clock/")) return true;
  if (pathname === "/api/devices/activate") return true;
  if (["/api/attendance/clock", "/api/attendance/identify", "/api/attendance/status", "/api/tablet-requests"].includes(pathname)) return true;
  if (pathname === "/api/settings/tablet" && method === "GET") return true;
  if ([
    "/api/client-control/analytics",
    "/api/client-control/note-suggestions",
    "/api/client-control/polish-note",
    "/api/client-control/tablet-submit",
  ].includes(pathname)) return true;
  if (pathname === "/api/appointments/pc/register") return true;
  if (pathname === "/api/appointments/bot" || pathname === "/api/attendance/close-open-shifts") return true;
  return false;
}

export const authConfig = {
  // Coolify terminates HTTPS before forwarding requests to the container.
  // Trust its forwarded host/protocol so Auth.js builds public callback URLs.
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 180,
    updateAge: 60 * 60 * 24,
  },
  jwt: {
    maxAge: 60 * 60 * 24 * 180,
  },
  cookies: {
    sessionToken: {
      name: `${process.env.NODE_ENV === "production" ? "__Secure-" : ""}authjs.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 180,
      },
    },
  },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        pin: { label: "PIN", type: "password" },
      },
      async authorize(credentials) {
        const pin = String(credentials?.pin ?? "").trim();
        if (pin) {
          if (!/^\d{4,6}$/.test(pin)) return null;
          const lookup = pinLookup(pin);
          const user = await prisma.user.findUnique({
            where: { pin_lookup: lookup },
          });
          if (!user?.active) return null;
          if (user.employee_status === FORMER_EMPLOYEE_STATUS && !hasFormerEmployeeDocumentAccess(user.workforce_data, user.last_edited_at)) return null;
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            sedeId: user.sede_id,
          };
        }

        const email = String(credentials?.email ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.active) return null;
        if (user.employee_status === FORMER_EMPLOYEE_STATUS && !hasFormerEmployeeDocumentAccess(user.workforce_data, user.last_edited_at)) return null;

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          sedeId: user.sede_id,
          mansione: user.mansione,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.name = user.name;
        token.email = user.email;
        token.role = (user as { role: Role }).role;
        token.sedeId = (user as { sedeId?: string }).sedeId;
        token.mansione = (user as { mansione?: string }).mansione;
      } else if (token.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { name: true, email: true, role: true, sede_id: true, mansione: true, active: true, employee_status: true, workforce_data: true, last_edited_at: true },
        }).catch(() => null);

        if (!dbUser?.active) return null;
        token.name = dbUser.name;
        token.email = dbUser.email;
        token.role = dbUser.role as Role;
        token.sedeId = dbUser.sede_id ?? undefined;
        token.mansione = dbUser.mansione ?? undefined;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.name = token.name ?? "";
        session.user.email = token.email ?? "";
        session.user.role = token.role as Role;
        session.user.sedeId = token.sedeId as string | undefined;
        (session.user as any).mansione = token.mansione as string | undefined;
      }
      return session;
    },
    async authorized({ auth, request }) {
      const pathname = request.nextUrl.pathname;
      if (isPublicOperationalRequest(pathname, request.method)) return true;

      // Strict lockdown for Cashier PCs with the operational APIs needed after profile selection.
      const pcToken = request.cookies.get(appointmentsPcCookieName)?.value;
      const pcAuth = pcToken ? await checkPCAuthorization(pcToken).catch(() => null) : null;
      if (pcAuth) {
        const isAllowedPage = 
          pathname === "/appointments" || 
          pathname.startsWith("/appointments/") ||
          pathname === "/client-control" ||
          pathname.startsWith("/client-control/") ||
          pathname === "/orders" ||
          pathname.startsWith("/orders/") ||
          pathname === "/service-forms" || 
          pathname.startsWith("/service-forms/");
          
        const isAllowedApi = 
          pathname.startsWith("/api/appointments") || 
          pathname.startsWith("/api/client-control") ||
          pathname.startsWith("/api/orders") ||
          pathname.startsWith("/api/service-forms") ||
          pathname.startsWith("/api/shopify-order-lookup") ||
          pathname.startsWith("/api/drive-image") ||
          pathname.startsWith("/api/auth");

        if (isAllowedPage || isAllowedApi) {
          return true;
        }
        return false;
      }
      
      if (!auth?.user?.id) return false;

      try {
        const dbUser = await prisma.user.findUnique({
          where: { id: auth.user.id },
          select: {
            id: true,
            role: true,
            mansione: true,
            active: true,
            employee_status: true,
            workforce_data: true,
            last_edited_at: true,
            location: { select: { name: true } },
          }
        });

        if (!dbUser?.active) return false;
        if (dbUser.employee_status === FORMER_EMPLOYEE_STATUS) {
          if (!hasFormerEmployeeDocumentAccess(dbUser.workforce_data, dbUser.last_edited_at)) {
            return Response.redirect(new URL("/login?documentAccessExpired=1", request.nextUrl));
          }
          if (isFormerEmployeeAllowedPath(pathname)) return true;
          return Response.redirect(new URL("/documents", request.nextUrl));
        }
        if (
          isShiftProtectedPath(pathname) &&
          !(await canAccessSalonShiftModules(dbUser))
        ) return false;
        const permissions = await getEffectivePermissionSet(prisma, dbUser);

        return canAccess(
          pathname, 
          dbUser.role as Role, 
          dbUser.mansione || undefined,
          permissions
        );
      } catch (err) {
        console.error("Auth dynamic check error:", err);
        // Sensitive salon modules fail closed: a database/attendance error must
        // never restore access to appointments or service forms outside a shift.
        if (isShiftProtectedPath(pathname)) return false;
        return canAccess(
          pathname, 
          auth?.user?.role as Role | undefined, 
          (auth?.user as any)?.mansione
        );
      }
    },
  },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
