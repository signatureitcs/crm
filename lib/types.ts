// Shared domain types mirroring the Supabase schema.

export type Role = "manager" | "developer" | "designer" | "seo" | "gmb";
export type ChecklistRole = "developer" | "designer" | "seo";
export type ProjectType = "website" | "gmb";
export type ProjectPhase = "design" | "development" | "seo" | "complete";
export type PhaseName = "design" | "development" | "seo";
export type PhaseStatus = "locked" | "in_progress" | "complete";
export type TaskStatus = "todo" | "processing" | "completed";
export type GmbTaskType = "emails_assigned" | "reviews_done" | "listing_live";
export type GmbTaskStatus = "todo" | "in_progress" | "done";

export interface Profile {
  id: string;
  full_name: string;
  role: Role;
  created_at: string;
}

export interface Country {
  id: string;
  name: string;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  country_id: string | null;
  project_type: ProjectType;
  current_phase: ProjectPhase | null;
  developer_id: string | null;
  designer_id: string | null;
  seo_id: string | null;
  description: string | null;
  client_name: string | null;
  client_contact: string | null;
  created_at: string;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  profile_id: string;
  added_by: string | null;
  created_at: string;
}

export interface Phase {
  id: string;
  project_id: string;
  phase_name: PhaseName;
  status: PhaseStatus;
  assigned_to: string | null;
  unlocked_at: string | null;
}

export interface Task {
  id: string;
  project_id: string;
  phase_id: string | null;
  title: string;
  assigned_to: string | null;
  status: TaskStatus;
  due_date: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ChecklistTemplate {
  id: string;
  role: ChecklistRole;
  label: string;
  sort_order: number;
}

export interface ChecklistCompletion {
  id: string;
  project_id: string;
  phase_id: string | null;
  template_id: string;
  checked: boolean;
  note: string | null;
  checked_by: string | null;
  checked_at: string | null;
}

export interface Handoff {
  id: string;
  project_id: string;
  from_role: string | null;
  to_profile_id: string | null;
  checklist_snapshot:
    | { label: string; checked: boolean; note?: string | null }[]
    | null;
  dev_summary: string | null;
  created_at: string;
}

export interface Asset {
  id: string;
  project_id: string;
  file_url: string;
  uploaded_by: string | null;
  created_at: string;
}

export interface SitelinkRow {
  id: string;
  project_id: string;
  page_url: string | null;
  sitelink_1: string | null;
  sitelink_2: string | null;
  sitelink_3: string | null;
  sort_order: number;
}

export interface SeoDailyLog {
  id: string;
  project_id: string;
  author_id: string | null;
  note: string;
  created_at: string;
}

export interface GmbTask {
  id: string;
  project_id: string;
  task_type: GmbTaskType;
  assigned_to: string | null;
  status: GmbTaskStatus;
  listing_link: string | null;
  updated_at: string;
}

export const ROLE_LABELS: Record<Role, string> = {
  manager: "Manager",
  developer: "Developer",
  designer: "Designer",
  seo: "SEO specialist",
  gmb: "GMB specialist",
};

// Role-based task-assignment matrix (creator role -> roles they may assign to).
// "—" on the diagonal in the spec is read as "own role allowed". Managers may
// assign to anyone; designers may only assign to themselves (own role).
export const ASSIGNABLE_ROLES: Record<Role, Role[]> = {
  manager: ["manager", "developer", "designer", "seo", "gmb"],
  developer: ["developer", "seo"],
  seo: ["seo", "developer"],
  designer: ["designer"],
  gmb: ["gmb"],
};

export function canAssignRole(creator: Role, target: Role): boolean {
  return ASSIGNABLE_ROLES[creator].includes(target);
}
