"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Users as UsersIcon,
  RefreshCw,
  Loader2,
  Search,
  ChevronRight,
  UserCheck,
  Crown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/admin/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { useViewStore } from "@/stores/view-store";
import { toast } from "sonner";

type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  totalAttempts: number;
  avgScore: number;
  lastActiveAt: string | null;
};

export function AdminUsers() {
  const setView = useViewStore((s) => s.setView);
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load users");
      const data = (await res.json()) as { users: AdminUser[] };
      setUsers(data.users);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load users");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = (users ?? []).filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Users</h2>
          <p className="text-sm text-slate-600 mt-1">
            All registered users and their quiz activity.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>

      {users && users.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
          <Input
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {loading ? (
        <ListSkeleton rows={5} />
      ) : !users || users.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title="No users yet"
          description="No one has registered yet."
        />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left font-medium">Role</th>
                  <th className="px-4 py-3 text-left font-medium">Attempts</th>
                  <th className="px-4 py-3 text-left font-medium hidden md:table-cell">
                    Avg Score
                  </th>
                  <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">
                    Last Active
                  </th>
                  <th className="px-4 py-3 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((u, idx) => (
                  <motion.tr
                    key={u.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15, delay: Math.min(idx * 0.02, 0.3) }}
                    className="hover:bg-slate-50/60 cursor-pointer"
                    onClick={() =>
                      setView({ name: "admin-user-detail", userId: u.id })
                    }
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <div className="flex items-center gap-2">
                        {u.role === "admin" && (
                          <Crown className="size-4 text-amber-500 shrink-0" />
                        )}
                        {u.name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">
                      {u.email}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        tone={u.role === "admin" ? "active" : "neutral"}
                        label={u.role === "admin" ? "Admin" : "Student"}
                      />
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {u.totalAttempts}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {u.totalAttempts > 0 ? (
                        <span
                          className={
                            u.avgScore >= 70
                              ? "text-emerald-600 font-medium"
                              : u.avgScore >= 40
                                ? "text-amber-600 font-medium"
                                : "text-red-600 font-medium"
                          }
                        >
                          {Math.round(u.avgScore)}%
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden lg:table-cell text-xs">
                      {u.lastActiveAt
                        ? new Date(u.lastActiveAt).toLocaleDateString(
                            undefined,
                            { month: "short", day: "numeric", year: "numeric" }
                          )
                        : "Never"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ChevronRight className="size-4 text-slate-300 inline" />
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
