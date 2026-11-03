import { apiRequest } from "./auth";

export type Centre = {
  id: string;
  slug: string;
  name: string;
  join_code: string;
  include_global: boolean;
  disabled: boolean;
  students: number;
  exams: number;
};

export const centresAPI = {
  list: async () => (await apiRequest<{ centres: Centre[] }>("/api/v1/admin/centres")).centres,
  create: async (name: string, slug: string, includeGlobal: boolean) =>
    (await apiRequest<{ centre: Centre }>("/api/v1/admin/centres", {
      method: "POST",
      body: JSON.stringify({ name, slug, include_global: includeGlobal }),
    })).centre,
  update: async (centre: Centre) =>
    (await apiRequest<{ centre: Centre }>(`/api/v1/admin/centres/${centre.id}`, {
      method: "PUT",
      body: JSON.stringify({ name: centre.name, include_global: centre.include_global, disabled: centre.disabled }),
    })).centre,
};

/**
 * The invite a centre gives its students. Opening it starts the bot, which
 * attaches them to the centre and sends back a login link, so this one URL is
 * the whole onboarding path.
 */
export function inviteLink(centre: Centre, bot: string) {
  return `https://t.me/${bot}?start=c_${centre.join_code}`;
}
