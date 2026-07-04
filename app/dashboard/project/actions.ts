"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  notifyTaskAssigned,
  notifyHandoff,
  notifyGmbLive,
  notifyComment,
} from "@/lib/notify";
import { canAssignRole, type Role, type TaskStatus } from "@/lib/types";

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

  // Enforce the role-based assignment matrix server-side.
  if (assignedTo) {
    const [{ data: creator }, { data: assignee }] = await Promise.all([
      supabase.from("profiles").select("role").eq("id", userId).single(),
      supabase.from("profiles").select("role").eq("id", assignedTo).single(),
    ]);
    if (
      creator &&
      assignee &&
      !canAssignRole(creator.role as Role, assignee.role as Role)
    ) {
      throw new Error(
        "Your role is not allowed to assign tasks to this person's role.",
      );
    }
  }

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
  revalidatePath("/dashboard/overview");
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
  note: string,
) {
  // A box can only be checked once its justification is filled in.
  const trimmed = note.trim();
  if (checked && !trimmed) {
    throw new Error("Add a justification before checking this item.");
  }
  const { supabase, userId } = await getUser();
  const { error } = await supabase.from("checklist_completions").upsert(
    {
      project_id: projectId,
      phase_id: phaseId,
      template_id: templateId,
      checked,
      note: trimmed || null,
      checked_by: checked ? userId : null,
      checked_at: checked ? new Date().toISOString() : null,
    },
    { onConflict: "project_id,template_id" },
  );
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/project/${projectId}`);
}

// Persist a justification without changing the checked state (autosave on blur).
export async function saveChecklistNote(
  projectId: string,
  phaseId: string,
  templateId: string,
  note: string,
) {
  const { supabase } = await getUser();
  const { error } = await supabase.from("checklist_completions").upsert(
    {
      project_id: projectId,
      phase_id: phaseId,
      template_id: templateId,
      note: note.trim() || null,
    },
    { onConflict: "project_id,template_id" },
  );
  if (error) throw new Error(error.message);
}

export async function handoffToSeo(input: {
  projectId: string;
  devPhaseId: string;
  seoPhaseId: string;
  seoProfileId: string;
  devSummary: string;
}) {
  const { supabase, userId } = await getUser();
  const { projectId, seoPhaseId, seoProfileId } = input;
  const devSummary = input.devSummary.trim();

  if (!devSummary) {
    throw new Error("Add a completion summary before handing off.");
  }

  // Build the snapshot and verify every developer checklist item is checked.
  const [{ data: templates }, { data: completions }] = await Promise.all([
    supabase
      .from("checklist_templates")
      .select("id, label, sort_order")
      .eq("role", "developer")
      .order("sort_order"),
    supabase
      .from("checklist_completions")
      .select("template_id, checked, note")
      .eq("project_id", projectId),
  ]);

  const completedMap = new Map(
    (completions ?? []).map((c) => [c.template_id, c]),
  );
  const snapshot = (templates ?? []).map((t) => {
    const c = completedMap.get(t.id);
    return {
      label: t.label,
      checked: Boolean(c?.checked),
      note: c?.note ?? null,
    };
  });

  if (snapshot.length === 0 || !snapshot.every((s) => s.checked)) {
    throw new Error("All checklist items must be complete before handing off.");
  }

  // 1. Record the handoff with a frozen snapshot + developer write-up.
  const { error: hErr } = await supabase.from("handoffs").insert({
    project_id: projectId,
    from_role: "developer",
    to_profile_id: seoProfileId,
    checklist_snapshot: snapshot,
    dev_summary: devSummary,
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

  // 3. Make the SEO lead a project member (so they can see it) + advance.
  await supabase.from("project_members").upsert(
    { project_id: projectId, profile_id: seoProfileId, added_by: userId },
    { onConflict: "project_id,profile_id" },
  );
  const { error: prErr } = await supabase
    .from("projects")
    .update({ current_phase: "seo", seo_id: seoProfileId })
    .eq("id", projectId);
  if (prErr) throw new Error(prErr.message);

  revalidatePath("/dashboard", "layout");
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

// Bulk import (CSV) into a target project's sitelinks.
export async function importSitelinkRows(
  projectId: string,
  rows: {
    page_url: string;
    sitelink_1: string;
    sitelink_2: string;
    sitelink_3: string;
  }[],
) {
  if (!projectId || rows.length === 0) return { inserted: 0 };
  const { supabase } = await getUser();

  // Continue numbering after existing rows.
  const { data: existing } = await supabase
    .from("sitelinks_rows")
    .select("sort_order")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: false })
    .limit(1);
  let sort = (existing?.[0]?.sort_order ?? -1) + 1;

  const payload = rows.map((r) => ({
    project_id: projectId,
    page_url: r.page_url || null,
    sitelink_1: r.sitelink_1 || null,
    sitelink_2: r.sitelink_2 || null,
    sitelink_3: r.sitelink_3 || null,
    sort_order: sort++,
  }));

  const { error } = await supabase.from("sitelinks_rows").insert(payload);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/sitelinks");
  revalidatePath(`/dashboard/project/${projectId}/sitelinks`);
  return { inserted: payload.length };
}

// ----- QA review -----------------------------------------------------------

export async function qaSetReview(
  projectId: string,
  status: "approved" | "rejected" | "pending",
  note: string,
) {
  const { supabase, userId } = await getUser();
  const { error } = await supabase
    .from("projects")
    .update({
      qa_status: status,
      qa_note: note.trim() || null,
      qa_reviewer_id: userId,
      qa_reviewed_at: new Date().toISOString(),
    })
    .eq("id", projectId);
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/project/${projectId}`);

  // Notify the team of the QA verdict.
  try {
    const [{ data: project }, { data: memberRows }, { data: reviewer }] =
      await Promise.all([
        supabase
          .from("projects")
          .select("name, developer_id, designer_id, seo_id")
          .eq("id", projectId)
          .single(),
        supabase
          .from("project_members")
          .select("profile_id")
          .eq("project_id", projectId),
        supabase.from("profiles").select("full_name").eq("id", userId).single(),
      ]);
    const memberIds = new Set<string>();
    (memberRows ?? []).forEach((m) => memberIds.add(m.profile_id));
    [project?.developer_id, project?.designer_id, project?.seo_id].forEach(
      (id) => id && memberIds.add(id),
    );
    memberIds.delete(userId);
    await notifyComment({
      authorName: reviewer?.full_name ?? "QA",
      projectName: project?.name ?? "a project",
      projectPath: `/dashboard/project/${projectId}`,
      snippet: `QA ${status}${note.trim() ? `: ${note.trim()}` : ""}`,
      memberIds: Array.from(memberIds),
      mentionIds: [],
    });
  } catch (e) {
    console.error("[notify] qa review failed:", e);
  }
}

// ----- Comments / project notes --------------------------------------------

export async function addComment(input: {
  projectId: string;
  taskId?: string | null;
  body: string;
  mentions: string[];
}) {
  const body = input.body.trim();
  if (!input.projectId || !body) return;
  const { supabase, userId } = await getUser();

  const { error } = await supabase.from("comments").insert({
    project_id: input.projectId,
    task_id: input.taskId ?? null,
    author_id: userId,
    body,
    mentions: input.mentions,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/project/${input.projectId}/notes`);

  // Notify the whole team + mentioned users.
  try {
    const [{ data: project }, { data: memberRows }, { data: author }] =
      await Promise.all([
        supabase
          .from("projects")
          .select("name, developer_id, designer_id, seo_id")
          .eq("id", input.projectId)
          .single(),
        supabase
          .from("project_members")
          .select("profile_id")
          .eq("project_id", input.projectId),
        supabase.from("profiles").select("full_name").eq("id", userId).single(),
      ]);

    const memberIds = new Set<string>();
    (memberRows ?? []).forEach((m) => memberIds.add(m.profile_id));
    [project?.developer_id, project?.designer_id, project?.seo_id].forEach(
      (id) => id && memberIds.add(id),
    );
    memberIds.delete(userId); // don't notify yourself
    const mentionIds = input.mentions.filter((id) => id !== userId);

    await notifyComment({
      authorName: author?.full_name ?? "Someone",
      projectName: project?.name ?? "a project",
      projectPath: `/dashboard/project/${input.projectId}/notes`,
      snippet: body.length > 120 ? body.slice(0, 117) + "…" : body,
      memberIds: Array.from(memberIds),
      mentionIds,
    });
  } catch (e) {
    console.error("[notify] comment failed:", e);
  }
}

export async function deleteComment(commentId: string, projectId: string) {
  const { supabase } = await getUser();
  const { error } = await supabase.from("comments").delete().eq("id", commentId);
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/project/${projectId}/notes`);
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
