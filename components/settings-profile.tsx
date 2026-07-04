"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/icon";
import { SubmitButton } from "@/components/submit-button";
import { updateMyProfile } from "@/app/profile/actions";
import { ROLE_LABELS, type Profile } from "@/lib/types";

export function SettingsProfile({ profile }: { profile: Profile }) {
  const router = useRouter();
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${profile.id}/${Date.now()}_${safe}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const url = supabase.storage.from("avatars").getPublicUrl(path).data
        .publicUrl;
      setAvatarUrl(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form
      action={async (fd) => {
        await updateMyProfile(fd);
        router.refresh();
      }}
      className="card max-w-lg p-5"
    >
      <h3 className="mb-4 font-semibold">My profile</h3>

      <div className="mb-4 flex items-center gap-4">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt="Avatar"
            className="h-16 w-16 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft text-xl font-bold text-primary">
            {profile.full_name[0]?.toUpperCase()}
          </div>
        )}
        <div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="btn-secondary"
          >
            <Icon
              name={uploading ? "progress_activity" : "photo_camera"}
              size={16}
              className={uploading ? "animate-spin" : ""}
            />
            {uploading ? "Uploading…" : "Change photo"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onFile(e.target.files)}
          />
        </div>
      </div>

      <input type="hidden" name="avatar_url" value={avatarUrl} />

      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="full_name">
            Full name
          </label>
          <input
            id="full_name"
            name="full_name"
            required
            defaultValue={profile.full_name}
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="phone">
            Phone <span className="text-ink-subtle">(optional)</span>
          </label>
          <input
            id="phone"
            name="phone"
            defaultValue={profile.phone ?? ""}
            className="input"
            placeholder="+44 …"
          />
        </div>
        <div>
          <label className="label">Role</label>
          <input
            className="input bg-surface-subtle"
            value={ROLE_LABELS[profile.role]}
            disabled
          />
          <p className="mt-1 text-xs text-ink-subtle">
            Your role is set by a manager.
          </p>
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-status-error-bg px-3 py-2 text-sm text-status-error-text">
          {error}
        </p>
      )}

      <div className="mt-5 flex justify-end">
        <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
      </div>
    </form>
  );
}
