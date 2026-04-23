/**
 * Tenant context resolver — single source of truth for "which tenant am I in?"
 *
 * Today APEX runs as a single-tenant deployment for the Manipal Evergreen
 * Fund (tenant id 1). When we add a second tenant, this is the ONLY place
 * that needs to change — every router uses tenantIdForRequest() rather
 * than hardcoding the constant.
 *
 * Migration plan when going multi-tenant:
 *   1. Update tenantIdForRequest() to read from a JWT claim, subdomain, or
 *      explicit user→tenant join via getPersonByUserIdOrEmail
 *   2. Remove the singleton fallback (throw instead)
 *   3. Search-and-replace `const TENANT_ID = 1;` in every router with
 *      `const tenantId = await tenantIdForRequest(ctx);`
 */

import type { User } from "../drizzle/schema";

const SINGLETON_TENANT_ID = 1;

export async function tenantIdForRequest(_ctx: { user: User | null }): Promise<number> {
  // TODO: replace with proper resolution when multi-tenancy is enabled
  return SINGLETON_TENANT_ID;
}

export const SINGLETON_TENANT_ID_EXPORT = SINGLETON_TENANT_ID;
