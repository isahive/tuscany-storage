/**
 * Storable Easy's customer "Groups" — segmentation buckets the admin can
 * filter the tenants list by (and eventually mass-email/text against).
 *
 * Group resolution happens server-side in /api/tenants. This file holds the
 * group definitions + label/description lookup; the resolver lives in
 * lib/tenantGroupResolver.ts (mongoose-coupled, kept separate so this file
 * stays unit-testable).
 */

export const TENANT_GROUPS = [
  { id: 'all',                       label: 'All',                          description: 'Every entry in the directory.' },
  { id: 'active',                    label: 'Active',                       description: 'All tenants — both currently renting and past renters.' },
  { id: 'current',                   label: 'Current',                      description: 'Tenants with at least one active rental.' },
  { id: 'recurring',                 label: 'Recurring',                    description: 'Tenants with autopay enabled.' },
  { id: 'non_recurring',             label: 'Non-Recurring',                description: 'Current tenants who pay manually each billing cycle.' },
  { id: 'outstanding',               label: 'Outstanding',                  description: 'Tenants with any balance due (pending or past due).' },
  { id: 'past_due',                  label: 'Past Due',                     description: 'Tenants with a past-due balance specifically.' },
  { id: 'late',                      label: 'Late',                         description: 'Tenants past the configured late threshold.' },
  { id: 'locked_out',                label: 'Locked Out',                   description: 'Tenants currently locked out of their unit.' },
  { id: 'auction_date_set',          label: 'Auction Date Set',             description: 'Accounts with a scheduled auction date.' },
  { id: 'waiting_list',              label: 'Waiting List',                 description: 'Prospective tenants awaiting unit availability.' },
  { id: 'late_fee_exempt',           label: 'Late Fee Exempt',              description: 'Tenants exempt from the late-fee rules.' },
  { id: 'tax_exempt',                label: 'Tax Exempt',                   description: 'Tenants whose rental charges skip sales tax.' },
  { id: 'tenant_protection_plans',   label: 'Active Tenant Protection Plans', description: 'Tenants enrolled in the facility tenant protection plan.' },
  { id: 'active_insurance_policies', label: 'Active Insurance Policies',    description: 'Tenants with an active third-party insurance policy. (Currently mirrors the protection-plan source until a separate insurance model is added.)' },
  { id: 'tenant_protection_eligible', label: 'Tenant Protection Eligible',  description: 'Active renters not yet enrolled in a protection plan.' },
  { id: 'automatic_lockout_disabled', label: 'Automatic Lockout Disabled',  description: 'Tenants flagged to skip automated lockouts.' },
  { id: 'archived',                  label: 'Archived',                     description: 'Archived (inactive) accounts. Hidden from every other view — Storable parity.' },
] as const

export type TenantGroupId = (typeof TENANT_GROUPS)[number]['id']

const GROUP_IDS: ReadonlySet<string> = new Set(TENANT_GROUPS.map((g) => g.id))

export function isValidTenantGroup(id: string): id is TenantGroupId {
  return GROUP_IDS.has(id)
}

export function tenantGroupLabel(id: TenantGroupId): string {
  return TENANT_GROUPS.find((g) => g.id === id)?.label ?? id
}

export function tenantGroupDescription(id: TenantGroupId): string {
  return TENANT_GROUPS.find((g) => g.id === id)?.description ?? ''
}
