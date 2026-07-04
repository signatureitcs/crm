import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { CommentThread, type CommentView } from "@/components/comment-thread";
import type { Comment, Profile, Project, ProjectMember } from "@/lib/types";

export default async function NotesPage({
  params,
}: {
  params: { projectId: string };
}) {
  const profile = await requireProfile();
  const supabase = createClient();
  const projectId = params.projectId;

  const [{ data: project }, { data: comments }, { data: profiles }, { data: memberRows }] =
    await Promise.all([
      supabase
        .from("projects")
        .select("developer_id, designer_id, seo_id")
        .eq("id", projectId)
        .single(),
      supabase
        .from("comments")
        .select("*")
        .eq("project_id", projectId)
        .is("task_id", null)
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name, role, created_at"),
      supabase
        .from("project_members")
        .select("profile_id")
        .eq("project_id", projectId),
    ]);

  const p = project as Pick<Project, "developer_id" | "designer_id" | "seo_id">;
  const people = (profiles as Profile[]) ?? [];
  const nameById = new Map(people.map((pr) => [pr.id, pr.full_name]));

  const memberIds = new Set<string>();
  ((memberRows as ProjectMember[] | null) ?? []).forEach((m) =>
    memberIds.add(m.profile_id),
  );
  [p?.developer_id, p?.designer_id, p?.seo_id].forEach(
    (id) => id && memberIds.add(id),
  );

  const members = people
    .filter((pr) => memberIds.has(pr.id))
    .map((pr) => ({ id: pr.id, full_name: pr.full_name }));

  const commentViews: CommentView[] = ((comments as Comment[]) ?? []).map((c) => ({
    id: c.id,
    body: c.body,
    created_at: c.created_at,
    author_id: c.author_id,
    author_name: c.author_id ? nameById.get(c.author_id) ?? "Unknown" : "Unknown",
  }));

  const canPost = profile.role === "manager" || memberIds.has(profile.id);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Project notes</h2>
        <p className="text-sm text-ink-muted">
          Shared notes for the team. @mention someone to notify them directly.
        </p>
      </div>
      <CommentThread
        projectId={projectId}
        members={members}
        comments={commentViews}
        currentUserId={profile.id}
        canPost={canPost}
      />
    </div>
  );
}
