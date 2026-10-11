"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { VariantProps } from "class-variance-authority";
import { badgeVariants } from "@/components/ui/badge";
type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

type Tone = "active" | "inactive" | "published" | "draft" | "neutral";

const TONE_TO_VARIANT: Record<Tone, BadgeVariant> = {
  active: "default",
  published: "default",
  inactive: "secondary",
  draft: "secondary",
  neutral: "outline",
};

const TONE_TO_CLASS: Record<Tone, string> = {
  active:
    "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-transparent",
  published:
    "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-transparent",
  inactive: "bg-slate-100 text-slate-500 hover:bg-slate-100 border-transparent",
  draft: "bg-amber-100 text-amber-700 hover:bg-amber-100 border-transparent",
  neutral: "",
};

/**
 * StatusBadge — small pill that displays a status (active/inactive,
 * published/draft, etc.). Color is derived from the `tone` prop.
 */
export function StatusBadge({
  tone,
  label,
  className,
}: {
  tone: Tone;
  label: string;
  className?: string;
}) {
  return (
    <Badge
      variant={TONE_TO_VARIANT[tone]}
      className={cn(TONE_TO_CLASS[tone], className)}
    >
      {label}
    </Badge>
  );
}
