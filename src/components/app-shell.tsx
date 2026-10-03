"use client";

import { useEffect, useState } from "react";
import type { PublicUser } from "@/types";
import { AuthScreen } from "@/components/auth/auth-screen";
import { StudentHome } from "@/components/student/student-home";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { useViewStore } from "@/stores/view-store";
import { Loader2 } from "lucide-react";

/**
 * AppShell — top-level client component.
 *
 * Responsibilities:
 *   1. Fetch the current user (via /api/me) on mount.
 *   2. If unauthenticated → render AuthScreen (login/register).
 *   3. If authenticated as user → render Student app.
 *   4. If authenticated as admin → allow access to both Student + Admin.
 *   5. Branch the student/admin sub-views via the view-store.
 *
 * The sandbox exposes a single Next.js route (`/`), so all "navigation"
 * between screens happens client-side through useViewStore. The view
 * discriminator mirrors what an App Router version would look like.
 */
export function AppShell() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [booting, setBooting] = useState(true);
  const view = useViewStore((s) => s.view);
  const setView = useViewStore((s) => s.setView);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        if (!res.ok) throw new Error(`me failed: ${res.status}`);
        const data = (await res.json()) as { user: PublicUser | null };
        if (!cancelled) {
          setUser(data.user);
          if (data.user) {
            // On a fresh load, default admins to the admin dashboard and
            // regular users to the student home.
            setView(
              data.user.role === "admin"
                ? { name: "admin-dashboard" }
                : { name: "student-home" }
            );
          } else {
            setView({ name: "login" });
          }
        }
      } catch (err) {
        console.error("[AppShell] bootstrap failed", err);
        if (!cancelled) setView({ name: "login" });
      } finally {
        if (!cancelled) setBooting(false);
      }
    }
    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [setView]);

  // Booting state — show a centered spinner while /api/me resolves.
  if (booting) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="size-6 animate-spin text-emerald-500" />
        <p className="text-sm text-slate-500 mt-3">Loading Quizverse…</p>
      </div>
    );
  }

  // Not authenticated → AuthScreen (login or register).
  if (!user) {
    return <AuthScreen />;
  }

  // Authenticated. Decide which surface to render.
  // Admin views are only reachable if user.role === 'admin'.
  const isAdminView = view.name.startsWith("admin-");
  if (isAdminView && user.role !== "admin") {
    // Safety: client should never route a non-admin here, but if it happens,
    // fall back to student home.
    return <StudentHome user={user} />;
  }

  if (isAdminView) {
    // Phase 1 only implements admin-dashboard. Other admin views will be
    // added in Phases 2–7. For unknown admin views, show a "coming soon"
    // panel inside the AdminShell so the sidebar still works.
    return (
      <AdminShell user={user}>
        {view.name === "admin-dashboard" ? (
          <AdminDashboard user={user} />
        ) : (
          <ComingSoon label={view.name} />
        )}
      </AdminShell>
    );
  }

  // Student views — Phase 1 only implements student-home. The other
  // student views will arrive in Phases 4–6.
  return <StudentHome user={user} />;
}

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <p className="text-sm font-medium text-slate-700">
        “{label}” — coming in a later phase.
      </p>
      <p className="text-xs text-slate-500 mt-2">
        The sidebar is live and ready. The actual screen content ships in
        the next development phase.
      </p>
    </div>
  );
}
