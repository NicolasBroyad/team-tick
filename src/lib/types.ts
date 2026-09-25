import type { Tables } from "@/lib/database.types";

export type Profile = Tables<"profiles">;
export type Project = Tables<"projects">;
export type List = Tables<"lists">;
export type Task = Tables<"tasks">;
export type Invite = Tables<"project_invites">;

export type Member = {
  user_id: string;
  role: "owner" | "member";
  joined_at: string;
  profile: Pick<Profile, "id" | "display_name" | "email">;
};

export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string };
