"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { formatDate } from "@/lib/format";
import { addComment, deleteComment } from "@/app/dashboard/project/actions";

export type CommentView = {
  id: string;
  body: string;
  created_at: string;
  author_id: string | null;
  author_name: string;
};

type Member = { id: string; full_name: string };

export function CommentThread({
  projectId,
  members,
  comments,
  currentUserId,
  canPost,
}: {
  projectId: string;
  members: Member[];
  comments: CommentView[];
  currentUserId: string;
  canPost: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [body, setBody] = useState("");
  const [selected, setSelected] = useState<Record<string, string>>({}); // id -> full_name
  const [menu, setMenu] = useState<{ query: string } | null>(null);

  function onChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setBody(value);
    const caret = e.target.selectionStart ?? value.length;
    const upToCaret = value.slice(0, caret);
    const m = upToCaret.match(/(?:^|\s)@(\w*)$/);
    setMenu(m ? { query: m[1].toLowerCase() } : null);
  }

  function pick(member: Member) {
    const ta = taRef.current;
    const caret = ta?.selectionStart ?? body.length;
    const upToCaret = body.slice(0, caret);
    const rest = body.slice(caret);
    const replaced = upToCaret.replace(/(^|\s)@(\w*)$/, `$1@${member.full_name} `);
    const next = replaced + rest;
    setBody(next);
    setSelected((s) => ({ ...s, [member.id]: member.full_name }));
    setMenu(null);
    // return focus
    requestAnimationFrame(() => ta?.focus());
  }

  function submit() {
    const text = body.trim();
    if (!text) return;
    // Keep only mentions whose token is still in the text.
    const mentions = Object.entries(selected)
      .filter(([, name]) => text.includes(`@${name}`))
      .map(([id]) => id);
    startTransition(async () => {
      await addComment({ projectId, taskId: null, body: text, mentions });
      setBody("");
      setSelected({});
      setMenu(null);
      router.refresh();
    });
  }

  const filteredMembers = menu
    ? members.filter((m) => m.full_name.toLowerCase().includes(menu.query))
    : [];

  return (
    <div>
      {canPost && (
        <div className="relative mb-5">
          <textarea
            ref={taRef}
            rows={3}
            className="input h-auto py-2"
            placeholder="Write a note… use @ to mention a teammate"
            value={body}
            onChange={onChange}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
            }}
          />
          {menu && filteredMembers.length > 0 && (
            <div className="absolute left-2 top-full z-20 mt-1 w-56 overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
              {filteredMembers.slice(0, 6).map((m) => (
                <button
                  key={m.id}
                  onClick={() => pick(m)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-subtle"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
                    {m.full_name[0]?.toUpperCase()}
                  </span>
                  {m.full_name}
                </button>
              ))}
            </div>
          )}
          <div className="mt-2 flex items-center justify-between">
            <p className="text-xs text-ink-subtle">
              Everyone on the project is notified. ⌘/Ctrl + Enter to post.
            </p>
            <button
              onClick={submit}
              disabled={pending || !body.trim()}
              className="btn-primary"
            >
              {pending ? "Posting…" : "Post note"}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {comments.length === 0 && (
          <p className="text-sm text-ink-subtle">No notes yet.</p>
        )}
        {comments.map((c) => (
          <div
            key={c.id}
            className="group flex gap-3 rounded-lg border border-border bg-surface p-3"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
              {c.author_name[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{c.author_name}</span>
                <span className="text-xs text-ink-subtle">
                  {formatDate(c.created_at)}
                </span>
              </div>
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink-muted">
                {renderBody(c.body, members)}
              </p>
            </div>
            {(c.author_id === currentUserId || canPost) && (
              <button
                onClick={() =>
                  startTransition(async () => {
                    await deleteComment(c.id, projectId);
                    router.refresh();
                  })
                }
                className="text-ink-subtle opacity-0 transition-opacity hover:text-status-error-text group-hover:opacity-100"
                aria-label="Delete note"
              >
                <Icon name="delete" size={16} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Bold any @Name that matches a project member.
function renderBody(body: string, members: Member[]) {
  const names = members.map((m) => m.full_name).sort((a, b) => b.length - a.length);
  const parts: (string | JSX.Element)[] = [];
  let rest = body;
  let key = 0;
  outer: while (rest.length) {
    for (const name of names) {
      const token = `@${name}`;
      const idx = rest.indexOf(token);
      if (idx === 0) {
        parts.push(
          <span key={key++} className="font-semibold text-primary">
            {token}
          </span>,
        );
        rest = rest.slice(token.length);
        continue outer;
      }
    }
    // find the next @ that starts a mention
    const at = rest.indexOf("@", 1);
    if (at === -1) {
      parts.push(rest);
      break;
    }
    parts.push(rest.slice(0, at));
    rest = rest.slice(at);
  }
  return parts;
}
