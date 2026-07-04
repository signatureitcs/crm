"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  notifyTaskAssigned,
  notifyHandoff,
  notifyGmbLive,
} from "@/lib/notify";
import type { TaskStatus } from "@/lib/types";

function projectPath(projectType: string, projectId: string) {
  return projectType === "gmb"
    ? `/dashboard/gmb/${projectId}`
    : `/dashboard/project/${projectId}`;
}

async function getUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, userId: user.id };
}

export async function addTask(formData: FormData) {
  const projectId = String(formData.get("project_id") ?? "");
  const phaseId = String(formData.get("phase_id") ?? "") || null;
  const title = String(formData.get("title") ?? "").trim();
  const assignedTo = String(formData.get("assigned_to") ?? "") || null;
  const dueDate = String(formData.get("due_date") ?? "") || null;
  if (!projectId || !title) return;

  const { supabase, userId } = await getUser();
  const { error } = await supabase.from("tasks").insert({
    project_id: projectId,
    phase_id: phaseId,
    title,
    assigned_to: assignedTo,
    due_date: dueDate,
    created_by: userId,
    status: "todo",
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/project/${projectId}`);

  // Notify the assignee (skip self-assignment).
  if (assignedTo && assignedTo !== userId) {
    try {
      const { data: project } = await supabase
        .from("projects")
        .select("name, project_type")
        .eq("id", projectId)
        .single();
      if (project) {
        await notifyTaskAssigned({
          assigneeId: assignedTo,
          taskTitle: title,
          projectName: project.name,
          projectPath: projectPath(project.project_type, projectId),
        });
      }
    } catch (e) {
      console.error("[notify] task assigned failed:", e);
    }
  }
}

export async function setTaskStatus(
  taskId: string,
  projectId: string,
  status: TaskStatus,
) {
  const { supabase } = await getUser();
  const { error } = await supabase
    .from("tasks")
    .update({ status })
    .eq("id", taskId);
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/project/${projectId}`);
  revalidatePath(`/dashboard/project/${projectId}/kanban`);
}

export async function deleteTask(taskId: string, projectId: string) {
  const { supabase } = await getUser();
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/project/${projectId}`);
  revalidatePath(`/dashboard/project/${projectId}/kanban`);
}

export async function setPhaseStatus(
  phaseId: string,
  projectId: string,
  status: "locked" | "in_progress" | "complete",
) {
  const { supabase } = await getUser();
  const { error } = await supabase
    .from("phases")
    .update({ status })
    .eq("id", phaseId);
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/project/${projectId}`);
}

// ----- Checklist + handoff -------------------------------------------------

export async function toggleChecklistItem(
  projectId: string,
  phaseId: string,
  templateId: string,
  checked: boolean,
) {
  const { supabase, userId } = await getUser();
  // Upsert on the (project_id, template_id) unique key.
  const { error } = await supabase.from("checklist_completions").upsert(
    {
      project_id: projectId,
      phase_id: phaseId,
      template_id: templateId,
      checked,
      checked_by: checked ? userId : null,
      checked_at: checked ? new Date().toISOString() : null,
    },
    { onConflict: "project_id,template_id" },
  );
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/project/${projectId}`);
}

export async function handoffToSeo(input: {
  projectId: string;
  devPhaseId: string;
  seoPhaseId: string;
  seoProfileId: string;
}) {
  const { supabase } = await getUser();
  const { projectId, seoPhaseId, seoProfileId } = input;

  // Build the snapshot and verify every developer checklist item is checked.
  const [{ data: templates }, { data: completions }] = await Promise.all([
    supabase
      .from("checklist_templates")
      .select("id, label, sort_order")
      .eq("role", "developer")
      .order("sort_order"),
    supabase
      .from("checklist_completions")
      .select("template_id, checked")
      .eq("project_id", projectId),
  ]);

  const completedMap = new Map(
    (completions ?? []).map((c) => [c.template_id, c.checked]),
  );
  const snapshot = (templates ?? []).map((t) => ({
    label: t.label,
    checked: Boolean(completedMap.get(t.id)),
  }));

  if (snapshot.length === 0 || !snapshot.every((s) => s.checked)) {
    throw new Error("All checklist items must be complete before handing off.");
  }

  // 1. Record the handoff with a frozen snapshot.
  const { error: hErr } = await supabase.from("handoffs").insert({
    project_id: projectId,
    from_role: "developer",
    to_profile_id: seoProfileId,
    checklist_snapshot: snapshot,
  });
  if (hErr) throw new Error(hErr.message);

  // 2. Unlock the SEO phase.
  if (seoPhaseId) {
    const { error: pErr } = await supabase
      .from("phases")
      .update({
        status: "in_progress",
        assigned_to: seoProfileId,
        unlocked_at: new Date().toISOString(),
      })
      .eq("id", seoPhaseId);
    if (pErr) throw new Error(pErr.message);
  }

  // 3. Advance the project.
  const { error: prErr } = await supabase
    .from("projects")
    .update({ current_phase: "seo" })
    .eq("id", projectId);
  if (prErr) throw new Error(prErr.message);

  revalidatePath(`/dashboard/project/${projectId}`);

  // Notify the SEO lead + team channel.
  try {
    const [{ data: seo }, { data: project }] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", seoProfileId).single(),
      supabase.from("projects").select("name").eq("id", projectId).single(),
    ]);
    await notifyHandoff({
      seoId: seoProfileId,
      seoName: seo?.full_name ?? "SEO lead",
      projectName: project?.name ?? "Project",
      projectPath: `/dashboard/project/${projectId}`,
    });
  } catch (e) {
    console.error("[notify] handoff failed:", e);
  }
}

// ----- Assets --------------------------------------------------------------

export async function addAsset(projectId: string, path: string) {
  const { supabase, userId } = await getUser();
  const { error } = await supabase.from("assets").insert({
    project_id: projectId,
    file_url: path,
    uploaded_by: userId,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/project/${projectId}/assets`);
}

export async function deleteAsset(
  assetId: string,
  projectId: string,
  path: string,
) {
  const { supabase } = await getUser();
  await supabase.storage.from("project-assets").remove([path]);
  const { error } = await supabase.from("assets").delete().eq("id", assetId);
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/project/${projectId}/assets`);
}

// ----- Sitelinks -----------------------------------------------------------

export async function addSitelinkRow(projectId: string, sortOrder: number) {
  const { supabase } = await getUser();
  const { error } = await supabase
    .from("sitelinks_rows")
    .insert({ project_id: projectId, sort_order: sortOrder });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/project/${projectId}/sitelinks`);
}

export async function updateSitelinkCell(
  rowId: string,
  column: "page_url" | "sitelink_1" | "sitelink_2" | "sitelink_3",
  value: string,
) {
  const { supabase } = await getUser();
  const { error } = await supabase
    .from("sitelinks_rows")
    .update({ [column]: value })
    .eq("id", rowId);
  if (error) throw new Error(error.message);
}

export async function deleteSitelinkRow(rowId: string, projectId: string) {
  const { supabase } = await getUser();
  const { error } = await supabase
    .from("sitelinks_rows")
    .delete()
    .eq("id", rowId);
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/project/${projectId}/sitelinks`);
}

// ----- SEO daily log -------------------------------------------------------

export async function addSeoLog(formData: FormData) {
  const projectId = String(formData.get("project_id") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!projectId || !note) return;
  const { supabase, userId } = await getUser();
  const { error } = await supabase
    .from("seo_daily_logs")
    .insert({ project_id: projectId, author_id: userId, note });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/project/${projectId}`);
}

// ----- GMB -----------------------------------------------------------------

export async function setGmbStatus(
  gmbTaskId: string,
  projectId: string,
  status: "todo" | "in_progress" | "done",
) {
  const { supabase } = await getUser();
  const { error } = await supabase
    .from("gmb_tasks")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", gmbTaskId);
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/gmb/${projectId}`);
}

export async function saveListingLink(
  gmbTaskId: string,
  projectId: string,
  link: string,
) {
  const { supabase } = await getUser();
  const { error } = await supabase
    .from("gmb_tasks")
    .update({
      listing_link: link,
      status: link ? "done" : "todo",
      updated_at: new Date().toISOString(),
    })
    .eq("id", gmbTaskId);
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/gmb/${projectId}`);

  // Notify managers + the team channel when a listing goes live.
  if (link) {
    try {
      const [{ data: project }, { data: managers }] = await Promise.all([
        supabase.from("projects").select("name").eq("id", projectId).single(),
        supabase.from("profiles").select("id").eq("role", "manager"),
      ]);
      await notifyGmbLive({
        projectName: project?.name ?? "Project",
        projectPath: `/dashboard/gmb/${projectId}`,
        link,
        recipientIds: (managers ?? []).map((m) => m.id),
      });
    } catch (e) {
      console.error("[notify] gmb live failed:", e);
    }
  }
}
