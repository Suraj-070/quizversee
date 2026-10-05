"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  User as UserIcon, Mail, Calendar, Loader2, Lock, Save,
  Target, TrendingUp, Award,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormField } from "@/components/admin/form-field";
import type { PublicUser } from "@/types";
import { StudentHeader } from "@/components/student/student-header";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ProfileData = {
  profile: PublicUser;
  stats: { quizzesCompleted: number; avgScore: number; bestScore: number };
};

export function StudentProfile({ user }: { user: PublicUser }) {
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editName, setEditName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/student/profile", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed");
        const d = (await res.json()) as ProfileData;
        if (!cancelled) {
          setData(d);
          setEditName(d.profile.name);
        }
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  async function handleSaveName() {
    if (!editName.trim() || savingName) return;
    setSavingName(true);
    try {
      const res = await fetch("/api/student/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed");
      }
      toast.success("Name updated");
      setEditingName(false);
      // Reload to pick up the new name in the header
      window.location.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSavingName(false);
    }
  }

  async function handleChangePassword() {
    if (!currentPassword || !newPassword || savingPassword) return;
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setSavingPassword(true);
    try {
      const res = await fetch("/api/student/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed");
      }
      toast.success("Password changed");
      setCurrentPassword("");
      setNewPassword("");
      setShowPasswordForm(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to change password");
    } finally {
      setSavingPassword(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white flex flex-col">
        <StudentHeader user={user} />
        <main className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 py-10">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-5 animate-spin text-emerald-500" />
          </div>
        </main>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white flex flex-col">
        <StudentHeader user={user} />
        <main className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 py-10">
          <p className="text-center text-slate-500">Could not load profile.</p>
        </main>
      </div>
    );
  }

  const { profile, stats } = data;

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white flex flex-col">
      <StudentHeader user={user} />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }} className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            My Profile
          </h1>
        </motion.div>

        {/* Profile card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="size-14 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white flex items-center justify-center shrink-0">
              <span className="text-xl font-bold">
                {profile.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    disabled={savingName}
                    className="h-8 max-w-[200px]"
                    autoFocus
                  />
                  <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white h-8"
                    onClick={handleSaveName} disabled={savingName}>
                    {savingName ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900">{profile.name}</h2>
                  <button
                    type="button"
                    onClick={() => { setEditName(profile.name); setEditingName(true); }}
                    className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                  >
                    Edit
                  </button>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-sm text-slate-500 mt-0.5">
                <Mail className="size-3.5" />
                {profile.email}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                <Calendar className="size-3" />
                Member since {new Date(profile.createdAt).toLocaleDateString(undefined, {
                  month: "short", year: "numeric",
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <StatCard icon={Target} label="Completed" value={stats.quizzesCompleted} color="sky" />
          <StatCard icon={TrendingUp} label="Avg Score" value={`${stats.avgScore}%`} color="emerald" />
          <StatCard icon={Award} label="Best Score" value={`${stats.bestScore}%`} color="amber" />
        </div>

        {/* Change password */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
          <button
            type="button"
            onClick={() => setShowPasswordForm((v) => !v)}
            className="w-full flex items-center gap-2 text-sm font-medium text-slate-700"
          >
            <Lock className="size-4 text-slate-400" />
            Change password
          </button>

          {showPasswordForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mt-3 space-y-3"
            >
              <FormField label="Current password">
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={savingPassword}
                  autoComplete="current-password"
                />
              </FormField>
              <FormField label="New password">
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={savingPassword}
                  autoComplete="new-password"
                  placeholder="At least 6 characters"
                />
              </FormField>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowPasswordForm(false)}>
                  Cancel
                </Button>
                <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white"
                  onClick={handleChangePassword} disabled={savingPassword || !currentPassword || !newPassword}>
                  {savingPassword ? <Loader2 className="size-3 animate-spin" /> : <Lock className="size-3" />}
                  Update password
                </Button>
              </div>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}

const COLOR_MAP: Record<string, string> = {
  emerald: "bg-emerald-100 text-emerald-700",
  sky: "bg-sky-100 text-sky-700",
  amber: "bg-amber-100 text-amber-700",
};

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string | number; color: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
      <div className={cn("size-8 rounded-lg flex items-center justify-center mb-2", COLOR_MAP[color])}>
        <Icon className="size-4" />
      </div>
      <p className="text-xl font-bold text-slate-900">{value}</p>
      <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  );
}
