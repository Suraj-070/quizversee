"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/admin/form-field";
import { toast } from "sonner";

export function AdminSiteContent() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/settings", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed");
        const data = (await res.json()) as { settings: Record<string, unknown> };
        setValues({
          site_homepage_heading: (data.settings.site_homepage_heading as string) || "Ready to practice?",
          site_homepage_subtitle: (data.settings.site_homepage_subtitle as string) || "Pick a class to start. Choose your subject, drill into a topic, and we'll handle the rest.",
          site_footer_text: (data.settings.site_footer_text as string) || "Quizverse — practice MCQs the modern way",
          site_contact_email: (data.settings.site_contact_email as string) || "",
        });
      } catch { toast.error("Failed to load settings"); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Site content saved");
    } catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-5 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Site Content</h2>
        <p className="text-sm text-slate-600 mt-1">Manage text shown on the student website.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card space-y-4">
        <div className="flex items-start gap-3 mb-2">
          <div className="size-10 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
            <FileText className="size-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">Homepage Content</h3>
            <p className="text-sm text-slate-500 mt-0.5">These appear on the student home screen.</p>
          </div>
        </div>

        <FormField label="Homepage heading">
          <Input
            value={values.site_homepage_heading || ""}
            onChange={(e) => setValues({ ...values, site_homepage_heading: e.target.value })}
            disabled={saving}
          />
        </FormField>

        <FormField label="Homepage subtitle">
          <Textarea
            value={values.site_homepage_subtitle || ""}
            onChange={(e) => setValues({ ...values, site_homepage_subtitle: e.target.value })}
            rows={2}
            disabled={saving}
          />
        </FormField>

        <FormField label="Footer text">
          <Input
            value={values.site_footer_text || ""}
            onChange={(e) => setValues({ ...values, site_footer_text: e.target.value })}
            disabled={saving}
          />
        </FormField>

        <FormField label="Contact email (optional)">
          <Input
            type="email"
            value={values.site_contact_email || ""}
            onChange={(e) => setValues({ ...values, site_contact_email: e.target.value })}
            placeholder="support@quizverse.com"
            disabled={saving}
          />
        </FormField>

        <div className="flex justify-end">
          <Button className="bg-emerald-500 hover:bg-emerald-600 text-white" disabled={saving} onClick={handleSave}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}
