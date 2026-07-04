import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { notifyUser, absoluteUrl } from "@/lib/notify";
import { postToTeams } from "@/lib/notify/teams";

// Web-push requires the Node.js runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Daily job: ping assignees about tasks due within 24h or already overdue.
// Protected by CRON_SECRET (Vercel Cron sends it as a Bearer token).
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  let admin;
  try {
    admin = createServiceClient();
  } catch {
    return NextResponse.json(
      { error: "service role key not configured" },
      { status: 500 },
    );
  }

  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const { data: tasks, error } = await admin
    .from("tasks")
    .select("id, title, due_date, assigned_to, project_id, projects(name, project_type)")
    .neq("status", "completed")
    .not("assigned_to", "is", null)
    .not("due_date", "is", null)
    .lte("due_date", in24h.toISOString());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let overdue = 0;
  let dueSoon = 0;

  await Promise.all(
    (tasks ?? []).map(async (t) => {
      const project = t.projects as unknown as
        | { name: string; project_type: string }
        | null;
      const isOverdue = new Date(t.due_date as string) < now;
      if (isOverdue) overdue++;
      else dueSoon++;

      const path =
        project?.project_type === "gmb"
          ? `/dashboard/gmb/${t.project_id}`
          : `/dashboard/project/${t.project_id}`;

      await notifyUser(
        t.assigned_to as string,
        {
          title: isOverdue ? "Task overdue" : "Task due soon",
          body: `${t.title}${project ? ` · ${project.name}` : ""}`,
          url: path,
          kind: isOverdue ? "task_overdue" : "task_due_soon",
        },
        admin,
      );
    }),
  );

  const total = (tasks ?? []).length;
  if (total > 0) {
    await postToTeams({
      title: "⏰ Task reminders",
      text: `${total} task${total === 1 ? "" : "s"} need attention today.`,
      facts: [
        { title: "Overdue", value: String(overdue) },
        { title: "Due within 24h", value: String(dueSoon) },
      ],
      linkUrl: absoluteUrl("/dashboard"),
    });
  }

  return NextResponse.json({ ok: true, total, overdue, dueSoon });
}
