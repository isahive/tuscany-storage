/**
 * Keep `tenant.status` in sync with `tenant.balance` after any payment-ledger
 * change. Storable's model:
 *   - `delinquent` is purely a balance-derived state — once the customer pays
 *     down (balance <= 0), they go back to `active`.
 *   - `active` flips to `delinquent` when balance > 0 (we let downstream
 *     delinquency-tier UI decide late vs pre-lien vs lien).
 *   - `locked_out` and `moved_out` are terminal in this helper — they only
 *     flip back via an explicit admin action.
 *
 * Call this after writing the new tenant.balance and BEFORE `tenant.save()`.
 */
export function syncTenantStatusFromBalance(tenant: { balance?: number; status?: string }) {
  const balance = tenant.balance ?? 0
  if (tenant.status === 'locked_out' || tenant.status === 'moved_out') return
  if (balance > 0 && tenant.status === 'active') {
    tenant.status = 'delinquent'
  } else if (balance <= 0 && tenant.status === 'delinquent') {
    tenant.status = 'active'
  }
}
