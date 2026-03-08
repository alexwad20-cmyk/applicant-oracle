import { DbCandidate, DbJob } from "@/types/database";

export const ALL_PLACEHOLDERS = [
  "{{hm_name}}", "{{hm_email}}",
  "{{candidate_name}}", "{{candidate_email}}", "{{candidate_phone}}",
  "{{job_title}}", "{{department}}", "{{location}}",
  "{{visa_required}}", "{{source}}", "{{agency_name}}",
  "{{applied_date}}", "{{cv_url}}", "{{candidate_link}}",
  "{{yes_url}}", "{{no_url}}",
  "{{candidate_count}}", "{{candidate_list_html}}", "{{candidate_list_text}}",
  "{{outcome}}", "{{outcome_color}}", "{{reason}}", "{{notes}}",
] as const;

export interface PlaceholderValues {
  [key: string]: string;
}

export function buildCandidatePlaceholders(
  candidate: DbCandidate,
  job: DbJob | undefined,
  extra: Partial<PlaceholderValues> = {}
): PlaceholderValues {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return {
    "{{candidate_name}}": candidate.full_name,
    "{{candidate_email}}": candidate.email || "",
    "{{candidate_phone}}": candidate.phone || "",
    "{{job_title}}": job?.title || "Position",
    "{{department}}": job?.department || "",
    "{{location}}": job?.location || "",
    "{{visa_required}}": candidate.visa_required ? "Yes" : "No",
    "{{source}}": candidate.source || "",
    "{{agency_name}}": candidate.agency_name ? ` (${candidate.agency_name})` : "",
    "{{applied_date}}": new Date(candidate.created_at).toLocaleDateString(),
    "{{cv_url}}": extra["{{cv_url}}"] || "#",
    "{{candidate_link}}": `${origin}/candidates/${candidate.id}`,
    "{{yes_url}}": extra["{{yes_url}}"] || "#",
    "{{no_url}}": extra["{{no_url}}"] || "#",
    ...extra,
  };
}

export function interpolateTemplate(
  template: string,
  values: PlaceholderValues
): string {
  let result = template;
  for (const [key, val] of Object.entries(values)) {
    result = result.split(key).join(val);
  }
  return result;
}

export function buildCandidateBlockHtml(
  candidate: DbCandidate,
  job: DbJob | undefined,
  extra: Partial<PlaceholderValues> = {}
): string {
  const vals = buildCandidatePlaceholders(candidate, job, extra);
  return `<div style="background:#f8f9fa;border-radius:8px;padding:16px;margin:16px 0;border:1px solid #e5e7eb;">
    <h3 style="margin:0 0 12px 0;">${vals["{{candidate_name}}"]}</h3>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <tr><td style="padding:4px 8px;font-weight:bold;">Job</td><td style="padding:4px 8px;">${vals["{{job_title}}"]} — ${vals["{{department}}"]}</td></tr>
      <tr><td style="padding:4px 8px;font-weight:bold;">Email</td><td style="padding:4px 8px;">${vals["{{candidate_email}}"]}</td></tr>
      <tr><td style="padding:4px 8px;font-weight:bold;">Phone</td><td style="padding:4px 8px;">${vals["{{candidate_phone}}"]}</td></tr>
      <tr><td style="padding:4px 8px;font-weight:bold;">Visa Required</td><td style="padding:4px 8px;">${vals["{{visa_required}}"]}</td></tr>
      <tr><td style="padding:4px 8px;font-weight:bold;">Source</td><td style="padding:4px 8px;">${vals["{{source}}"]}${vals["{{agency_name}}"]}</td></tr>
      <tr><td style="padding:4px 8px;font-weight:bold;">Applied</td><td style="padding:4px 8px;">${vals["{{applied_date}}"]}</td></tr>
      <tr><td style="padding:4px 8px;font-weight:bold;">CV</td><td style="padding:4px 8px;"><a href="${vals["{{cv_url}}"]}">Download CV</a></td></tr>
      <tr><td style="padding:4px 8px;font-weight:bold;">Profile</td><td style="padding:4px 8px;"><a href="${vals["{{candidate_link}}"]}">View in App</a></td></tr>
    </table>
    <div style="text-align:center;margin:16px 0 8px 0;">
      <a href="${vals["{{yes_url}}"]}" style="display:inline-block;padding:10px 28px;background:#16a34a;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;margin-right:12px;">YES</a>
      <a href="${vals["{{no_url}}"]}" style="display:inline-block;padding:10px 28px;background:#dc2626;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">NO</a>
    </div>
  </div>`;
}
