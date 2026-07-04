// Posts an Adaptive Card to a Microsoft Teams channel via an Incoming Webhook
// or a Power Automate "Workflow" webhook URL (TEAMS_WEBHOOK_URL).
// No-op (logs a warning) if the URL isn't configured, so the app still works.

type Fact = { title: string; value: string };

export async function postToTeams(input: {
  title: string;
  text: string;
  facts?: Fact[];
  linkUrl?: string;
  linkText?: string;
}) {
  const url = process.env.TEAMS_WEBHOOK_URL;
  if (!url) {
    console.warn("[teams] TEAMS_WEBHOOK_URL not set — skipping Teams post.");
    return;
  }

  const body = {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            {
              type: "TextBlock",
              size: "Medium",
              weight: "Bolder",
              text: input.title,
              wrap: true,
            },
            { type: "TextBlock", text: input.text, wrap: true },
            ...(input.facts && input.facts.length
              ? [{ type: "FactSet", facts: input.facts }]
              : []),
          ],
          actions: input.linkUrl
            ? [
                {
                  type: "Action.OpenUrl",
                  title: input.linkText ?? "Open in Project Hub",
                  url: input.linkUrl,
                },
              ]
            : [],
        },
      },
    ],
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error(
        `[teams] webhook responded ${res.status}: ${await res.text()}`,
      );
    }
  } catch (e) {
    console.error("[teams] failed to post:", e);
  }
}
