"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { motion } from "framer-motion";
import { Loader2, GraduationCap, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useViewStore } from "@/stores/view-store";

/**
 * AuthScreen — handles both login and register in one component.
 *
 * On successful register, we automatically sign the user in via
 * NextAuth's `signIn("credentials", ...)` so they don't have to log in again.
 */
export function AuthScreen() {
  const view = useViewStore((s) => s.view);
  const setView = useViewStore((s) => s.setView);
  const mode: "login" | "register" = view.name === "register" ? "register" : "login";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }
    if (mode === "register" && !name.trim()) {
      setError("Name is required.");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "register") {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Registration failed.");
          setSubmitting(false);
          return;
        }
        // Fall through and sign in.
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password.");
        setSubmitting(false);
        return;
      }

      // Hard reload to pick up the new session cookie and re-hydrate AppShell.
      window.location.reload();
    } catch (err) {
      console.error("[auth] submit error", err);
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  async function handleSignOut() {
    // Hard reload after sign-out to clear client state.
    window.location.href = "/";
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-gradient-to-br from-emerald-50 via-white to-teal-50 relative overflow-hidden">
      {/* Subtle background pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 25% 25%, oklch(0.5 0.15 160) 1px, transparent 1px), radial-gradient(circle at 75% 75%, oklch(0.5 0.15 180) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md relative z-10"
      >
        <div className="flex flex-col items-center gap-3 mb-8">
          <motion.div
            initial={{ scale: 0, rotate: -15 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.1 }}
            className="size-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25"
          >
            <GraduationCap className="size-8" />
          </motion.div>
          <div className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Quizverse
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Practice MCQs the modern way
            </p>
          </div>
        </div>

        <Card className="shadow-card-hover border-slate-200/50 backdrop-blur-sm bg-white/95">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 tracking-tight">
              {mode === "login" ? "Welcome back" : "Create your account"}
              <Sparkles className="size-4 text-emerald-500" />
            </CardTitle>
            <CardDescription>
              {mode === "login"
                ? "Sign in to continue practicing."
                : "Register to start taking quizzes."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {mode === "register" && (
                <div className="grid gap-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    type="text"
                    autoComplete="name"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={submitting}
                  />
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                />
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white"
                disabled={submitting}
              >
                {submitting && <Loader2 className="size-4 animate-spin" />}
                {mode === "login" ? "Sign in" : "Create account"}
              </Button>
            </form>

            <div className="mt-4 text-center text-sm text-slate-500">
              {mode === "login" ? (
                <>
                  Don&apos;t have an account?{" "}
                  <button
                    type="button"
                    className="text-emerald-600 hover:text-emerald-700 font-medium"
                    onClick={() => setView({ name: "register" })}
                    disabled={submitting}
                  >
                    Register
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    className="text-emerald-600 hover:text-emerald-700 font-medium"
                    onClick={() => setView({ name: "login" })}
                    disabled={submitting}
                  >
                    Sign in
                  </button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

      </motion.div>
    </div>
  );
}
