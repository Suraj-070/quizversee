import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";

/** Published site copy: only allowlisted display fields, never admin/internal keys. */
export async function GET() {
  const { error } = await requireUser();
  if (error) return error;
  const keys = [
    "site_homepage_heading",
    "site_homepage_subtitle",
    "site_footer_text",
    "site_contact_email",
  ];
  const settings = await db.setting.findMany({
    where: { key: { in: keys } },
    select: { key: true, value: true },
  });
  const values = new Map<string, string>();
  for (const setting of settings) {
    try {
      const parsed: unknown = JSON.parse(setting.value);
      if (typeof parsed === "string") values.set(setting.key, parsed);
    } catch {
      // Ignore invalid site-copy values.
    }
  }
  return NextResponse.json({
    heading: values.get("site_homepage_heading") ?? "",
    subtitle: values.get("site_homepage_subtitle") ?? "",
    footer: values.get("site_footer_text") ?? "",
    contactEmail: values.get("site_contact_email") ?? "",
  });
}
