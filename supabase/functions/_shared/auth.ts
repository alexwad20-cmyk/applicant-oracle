// Authenticated edge-function helper.
// Verifies the caller's JWT (or service-role for cron) and returns the user id + role flags.
// All authenticated functions MUST call this before doing any privileged work.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface CallerContext {
  userId: string | null;
  isServiceRole: boolean;
  isHrOrAdmin: boolean;
  isHm: (candidateId: string) => Promise<boolean>;
  admin: SupabaseClient;
}

export async function requireAuth(req: Request): Promise<CallerContext> {
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  const token = authHeader.slice("Bearer ".length);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Service-role bypass (used by pg_cron and internal callers)
  if (token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
    return {
      userId: null,
      isServiceRole: true,
      isHrOrAdmin: true,
      isHm: async () => false,
      admin,
    };
  }

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: claims, error } = await userClient.auth.getClaims(token);
  if (error || !claims?.claims?.sub) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  const userId = claims.claims.sub as string;
  const { data: isHr } = await admin.rpc("is_hr_or_admin", { _user_id: userId });

  return {
    userId,
    isServiceRole: false,
    isHrOrAdmin: !!isHr,
    isHm: async (candidateId: string) => {
      const { data } = await admin.rpc("is_hm_for_candidate", {
        _user_id: userId,
        _candidate_id: candidateId,
      });
      return !!data;
    },
    admin,
  };
}

export function requireRole(ctx: CallerContext, role: "hr_admin"): void {
  if (role === "hr_admin" && !(ctx.isHrOrAdmin || ctx.isServiceRole)) {
    throw new Response(JSON.stringify({ error: "Permission denied" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
}
