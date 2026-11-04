import { apiRequest } from "./auth";

export type Centre = {
  id: string;
  slug: string;
  name: string;
  join_code: string;
  include_global: boolean;
  /** False means none of this centre's work is sent to a model. */
  ai_enabled: boolean;
  disabled: boolean;
  students: number;
  exams: number;
};

export type CentreAdmin = {
  id: string;
  email: string;
  display_name: string;
  disabled: boolean;
  created_at: string;
  /** Returned only when the account is created or re-keyed, and never again. */
  password?: string;
};

export const centresAPI = {
  list: async () => (await apiRequest<{ centres: Centre[] }>("/api/v1/admin/centres")).centres,
  create: async (name: string, slug: string, includeGlobal: boolean, aiEnabled: boolean) =>
    (await apiRequest<{ centre: Centre }>("/api/v1/admin/centres", {
      method: "POST",
      body: JSON.stringify({ name, slug, include_global: includeGlobal, ai_enabled: aiEnabled }),
    })).centre,
  update: async (centre: Centre) =>
    (await apiRequest<{ centre: Centre }>(`/api/v1/admin/centres/${centre.id}`, {
      method: "PUT",
      body: JSON.stringify({ name: centre.name, include_global: centre.include_global, ai_enabled: centre.ai_enabled, disabled: centre.disabled }),
    })).centre,
  listAdmins: async (centreID: string) =>
    (await apiRequest<{ admins: CentreAdmin[] }>(`/api/v1/admin/centres/${centreID}/admins`)).admins,
  createAdmin: async (centreID: string, email: string, displayName: string) =>
    (await apiRequest<{ admin: CentreAdmin }>(`/api/v1/admin/centres/${centreID}/admins`, {
      method: "POST",
      body: JSON.stringify({ email, display_name: displayName }),
    })).admin,
  setAdminDisabled: (centreID: string, adminID: string, disabled: boolean) =>
    apiRequest<void>(`/api/v1/admin/centres/${centreID}/admins/${adminID}`, {
      method: "PUT",
      body: JSON.stringify({ disabled }),
    }),
  resetAdminPassword: async (centreID: string, adminID: string) =>
    (await apiRequest<{ admin: CentreAdmin }>(`/api/v1/admin/centres/${centreID}/admins/${adminID}`, {
      method: "PUT",
      body: JSON.stringify({ reset_password: true }),
    })).admin,
};

/**
 * The invite a centre gives its students. Opening it starts the bot, which
 * attaches them to the centre and sends back a login link, so this one URL is
 * the whole onboarding path.
 */
export function inviteLink(centre: Centre, bot: string) {
  return `https://t.me/${bot}?start=c_${centre.join_code}`;
}
