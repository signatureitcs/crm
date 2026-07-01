"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { PhaseName, ProjectType } from "@/lib/types";

async function requireUserId() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, userId: user.id };
}

export async function addCountry(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const { supabase } = await requireUserId();
  const { error } = await supabase.from("countries").insert({ name });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard", "layout");
}

export async function addProject(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const countryId = String(formData.get("country_id") ?? "");
  const projectType = String(formData.get("project_type") ?? "website") as ProjectType;
  const developerId = emptyToNull(formData.get("developer_id"));
  const designerId = emptyToNull(formData.get("designer_id"));
  const seoId = emptyToNull(formData.get("seo_id"));

  if (!name || !countryId) return;
  const { supabase } = await requireUserId();

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      name,
      country_id: countryId,
      project_type: projectType,
      current_phase: projectType === "website" ? "development" : null,
      developer_id: developerId,
      designer_id: designerId,
      seo_id: seoId,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  if (projectType === "website") {
    const phaseRows: {
      project_id: string;
      phase_name: PhaseName;
      status: string;
      assigned_to: string | null;
    }[] = [
      {
        project_id: project.id,
        phase_name: "design",
        status: "in_progress",
        assigned_to: designerId,
      },
      {
        project_id: project.id,
        phase_name: "development",
        status: "in_progress",
        assigned_to: developerId,
      },
      {
        project_id: project.id,
        phase_name: "seo",
        status: "locked",
        assigned_to: seoId,
      },
    ];
    const { error: pErr } = await supabase.from("phases").insert(phaseRows);
    if (pErr) throw new Error(pErr.message);
  } else {
    const gmbRows = (
      ["emails_assigned", "reviews_done", "listing_live"] as const
    ).map((task_type) => ({
      project_id: project.id,
      task_type,
      status: "todo" as const,
    }));
    const { error: gErr } = await supabase.from("gmb_tasks").insert(gmbRows);
    if (gErr) throw new Error(gErr.message);
  }

  revalidatePath("/dashboard", "layout");
  redirect(
    projectType === "website"
      ? `/dashboard/project/${project.id}`
      : `/dashboard/gmb/${project.id}`,
  );
}

function emptyToNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}
