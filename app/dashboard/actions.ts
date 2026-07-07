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
  const description = emptyToNull(formData.get("description"));
  const clientName = emptyToNull(formData.get("client_name"));
  const clientContact = emptyToNull(formData.get("client_contact"));

  if (!name || !countryId) return;
  const { supabase, userId } = await requireUserId();

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
      description,
      client_name: clientName,
      client_contact: clientContact,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  // Seed the project team from the chosen leads AND the creator, so the
  // project is visible to them (hide-until-assigned). Whoever creates a
  // project always has access to it.
  const memberIds = Array.from(
    new Set(
      [developerId, designerId, seoId, userId].filter(
        (id): id is string => Boolean(id),
      ),
    ),
  );
  if (memberIds.length > 0) {
    await supabase.from("project_members").insert(
      memberIds.map((profileId) => ({
        project_id: project.id,
        profile_id: profileId,
        added_by: userId,
      })),
    );
  }

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

// ----- Team membership & project settings ----------------------------------

export async function addProjectMember(projectId: string, profileId: string) {
  const { supabase, userId } = await requireUserId();
  const { error } = await supabase
    .from("project_members")
    .upsert(
      { project_id: projectId, profile_id: profileId, added_by: userId },
      { onConflict: "project_id,profile_id" },
    );
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard", "layout");
  revalidatePath(`/dashboard/project/${projectId}/settings`);
}

export async function removeProjectMember(projectId: string, profileId: string) {
  const { supabase } = await requireUserId();
  const { error } = await supabase
    .from("project_members")
    .delete()
    .eq("project_id", projectId)
    .eq("profile_id", profileId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard", "layout");
  revalidatePath(`/dashboard/project/${projectId}/settings`);
}

export async function updateProjectMeta(formData: FormData) {
  const projectId = String(formData.get("project_id") ?? "");
  if (!projectId) return;
  const { supabase } = await requireUserId();
  const { error } = await supabase
    .from("projects")
    .update({
      description: emptyToNull(formData.get("description")),
      client_name: emptyToNull(formData.get("client_name")),
      client_contact: emptyToNull(formData.get("client_contact")),
    })
    .eq("id", projectId);
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/project/${projectId}/settings`);
  revalidatePath(`/dashboard/project/${projectId}`);
}

export async function deleteProject(projectId: string, countryId: string | null) {
  const { supabase } = await requireUserId();
  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard", "layout");
  redirect(countryId ? `/dashboard/${countryId}` : "/dashboard");
}
