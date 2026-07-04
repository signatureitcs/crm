import { createServiceClient } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/notify/push";
import { postToTeams } from "@/lib/notify/teams";

// Absolute URL builder for links in Teams cards / push payloads.
export function absoluteUrl(path: string): string | undefined {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL;
  if (!base) return undefined;
  const origin = base.startsWith("http") ? base : `https://${base}`;
  return `${origin.replace(/\/$/, "")}${path}`;
}

// Low-level: record an in-app notification and push to the user's devices.
// `admin` may be passed in (cron) or created here (server actions).
export async function notifyUser(
  userId: string,
  n: { title: string; body: string; url?: string; kind?: string },
  adminClient?: ReturnType<typeof createServiceClient>,
) {
  let admin;
  try {
    admin = adminClient ?? createServiceClient();
  } catch {
    // Service role key missing — degrade gracefully (no in-app / push).
    console.warn("[notify] service client unavailable; skipping user notify.");
    return;
  }

  await admin.from("notifications").insert({
    user_id: userId,
    title: n.title,
    body: n.body,
    url: n.url ?? null,
    kind: n.kind ?? null,
  });

  await sendPushToUser(admin, userId, {
    title: n.title,
    body: n.body,
    url: n.url,
  });
}

// ----- Event helpers -------------------------------------------------------

export async function notifyTaskAssigned(input: {
  assigneeId: string;
  taskTitle: string;
  projectName: string;
  projectPath: string;
}) {
  const url = absoluteUrl(input.projectPath);
  await Promise.all([
    notifyUser(input.assigneeId, {
      title: "New task assigned",
      body: `${input.taskTitle} · ${input.projectName}`,
      url: input.projectPath,
      kind: "task_assigned",
    }),
    postToTeams({
      title: "🗂️ Task assigned",
      text: `**${input.taskTitle}**`,
      facts: [{ title: "Project", value: input.projectName }],
      linkUrl: url,
    }),
  ]);
}

export async function notifyHandoff(input: {
  seoId: string;
  seoName: string;
  projectName: string;
  projectPath: string;
}) {
  const url = absoluteUrl(input.projectPath);
  await Promise.all([
    notifyUser(input.seoId, {
      title: "Project handed off to SEO",
      body: `${input.projectName} is ready for SEO`,
      url: input.projectPath,
      kind: "handoff",
    }),
    postToTeams({
      title: "🚀 Handed off to SEO",
      text: `**${input.projectName}** passed development sign-off.`,
      facts: [{ title: "SEO lead", value: input.seoName }],
      linkUrl: url,
    }),
  ]);
}

export async function notifyGmbLive(input: {
  projectName: string;
  projectPath: string;
  link: string;
  recipientIds: string[];
}) {
  const url = absoluteUrl(input.projectPath);
  await Promise.all([
    ...input.recipientIds.map((id) =>
      notifyUser(id, {
        title: "GMB listing is live",
        body: `${input.projectName} listing published`,
        url: input.projectPath,
        kind: "gmb_live",
      }),
    ),
    postToTeams({
      title: "📍 GMB listing live",
      text: `**${input.projectName}** listing is now live.`,
      facts: [{ title: "Listing", value: input.link }],
      linkUrl: url,
    }),
  ]);
}
