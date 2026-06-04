/**
 * NACHA-compliant ACH authorization mandate.
 *
 * Surfaced verbatim on every payment screen that accepts ACH (portal self-pay,
 * public reserve). The tenant MUST acknowledge it (checkbox) before the
 * frontend can call `stripe.confirmUsBankAccountPayment` — without this, the
 * ACH debit is exposed to NSF/fraud chargebacks without defense.
 *
 * Storable Easy uses substantively identical copy. Reviewed against NACHA
 * Operating Rules section 2.3 (Authorization) and CCD requirements.
 */
export const ACH_MANDATE_TEXT =
  "By providing your bank account information and clicking Authorize, you authorize " +
  "Tuscany Village Self Storage to electronically debit your account for the amount " +
  "shown above and, if necessary, electronically credit your account to correct " +
  "erroneous debits. This authorization will remain in effect until you provide " +
  "written notification to Tuscany Village Self Storage to cancel it, at least 3 " +
  "business days before the next scheduled payment. If a payment is returned unpaid, " +
  "you authorize Tuscany Village Self Storage to collect a returned-payment fee. " +
  "Funds may take 3-5 business days to clear."

export const ACH_MANDATE_SHORT =
  "I authorize Tuscany Village Self Storage to debit my bank account per the terms above."
