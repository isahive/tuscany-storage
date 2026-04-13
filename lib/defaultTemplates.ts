/** Default notification templates seeded when none exist. */
export const DEFAULT_TEMPLATES = [
  {
    name: 'Invoice Reminder',
    type: 'default' as const,
    emailSubject: 'Payment Reminder — [[facilityName]]',
    emailContent: `<p>Dear [[tenantName]],</p>
<p>This is a friendly reminder that your storage rental payment of <strong>$[[balance]]</strong> for unit <strong>[[unitNumber]]</strong> is due on <strong>[[dueDate]]</strong>.</p>
<p>Please log into your tenant portal to make a payment or set up autopay.</p>
<p>Thank you,<br/>[[facilityName]]<br/>[[facilityPhone]]</p>`,
    textContent: '[[facilityName]]: Reminder — $[[balance]] due on [[dueDate]] for unit [[unitNumber]]. Log in to pay: [[portalUrl]]',
    postcardContent: `<p>Dear [[tenantName]],</p><p>Your payment of $[[balance]] for unit [[unitNumber]] is due [[dueDate]].</p><p>[[facilityName]] — [[facilityPhone]]</p>`,
    emailEnabled: true,
    textEnabled: false,
    printEnabled: true,
    rule: 'manual' as const,
    description: 'Sent before a payment is due to remind tenants.',
  },
  {
    name: 'Payment Receipt',
    type: 'default' as const,
    emailSubject: 'Payment Received — [[facilityName]]',
    emailContent: `<p>Dear [[tenantName]],</p>
<p>We have received your payment of <strong>$[[paymentAmount]]</strong> on <strong>[[paymentDate]]</strong> for unit <strong>[[unitNumber]]</strong>.</p>
<p>Your current balance is <strong>$[[balance]]</strong>.</p>
<p>Thank you for your payment!<br/>[[facilityName]]<br/>[[facilityPhone]]</p>`,
    textContent: '[[facilityName]]: Payment of $[[paymentAmount]] received for unit [[unitNumber]]. Balance: $[[balance]]. Thank you!',
    postcardContent: '',
    emailEnabled: true,
    textEnabled: false,
    printEnabled: false,
    rule: 'manual' as const,
    description: 'Sent after a successful payment.',
  },
  {
    name: 'Failed Payment',
    type: 'default' as const,
    emailSubject: 'Payment Failed — [[facilityName]]',
    emailContent: `<p>Dear [[tenantName]],</p>
<p>Unfortunately, your recent payment for unit <strong>[[unitNumber]]</strong> could not be processed.</p>
<p>Please log into your tenant portal and update your payment method or try again.</p>
<p>If you have any questions, please contact us at [[facilityPhone]].</p>
<p>[[facilityName]]</p>`,
    textContent: '[[facilityName]]: Your payment for unit [[unitNumber]] failed. Please log in and update your payment method or contact us at [[facilityPhone]].',
    postcardContent: '',
    emailEnabled: true,
    textEnabled: false,
    printEnabled: false,
    rule: 'manual' as const,
    description: 'Sent when a payment attempt fails.',
  },
  {
    name: 'Rental Instructions',
    type: 'default' as const,
    emailSubject: 'Welcome to [[facilityName]] — Rental Instructions',
    emailContent: `<p>Dear [[tenantName]],</p>
<p>Welcome to <strong>[[facilityName]]</strong>! Here are your rental details:</p>
<ul>
<li><strong>Unit:</strong> [[unitNumber]]</li>
<li><strong>Monthly Rate:</strong> $[[monthlyRate]]</li>
<li><strong>Gate Code:</strong> [[gateCode]]</li>
</ul>
<p>Access hours are posted at the facility. Please keep your gate code confidential.</p>
<p>If you have any questions, contact us at [[facilityPhone]] or [[facilityEmail]].</p>
<p>Thank you,<br/>[[facilityName]]</p>`,
    textContent: '[[facilityName]]: Welcome! Unit [[unitNumber]], Gate code: [[gateCode]], Rate: $[[monthlyRate]]/mo. Questions? Call [[facilityPhone]].',
    postcardContent: '',
    emailEnabled: true,
    textEnabled: true,
    printEnabled: false,
    rule: 'manual' as const,
    description: 'Sent to new tenants after move-in.',
  },
  {
    name: 'Storage Agreement',
    type: 'default' as const,
    emailSubject: 'Your Storage Agreement — [[facilityName]]',
    emailContent: `<p>Dear [[tenantName]],</p>
<p>Attached is your signed storage agreement for unit <strong>[[unitNumber]]</strong> at <strong>[[facilityName]]</strong>.</p>
<p>Please keep this for your records. If you have any questions, contact us at [[facilityPhone]].</p>
<p>[[facilityName]]</p>`,
    textContent: '[[facilityName]]: Your storage agreement for unit [[unitNumber]] has been sent to [[email]]. Contact us at [[facilityPhone]] with questions.',
    postcardContent: '',
    emailEnabled: true,
    textEnabled: false,
    printEnabled: false,
    rule: 'manual' as const,
    description: 'Sent with the signed storage agreement.',
  },
  {
    name: 'Move Out Receipt',
    type: 'default' as const,
    emailSubject: 'Move-Out Confirmation — [[facilityName]]',
    emailContent: `<p>Dear [[tenantName]],</p>
<p>This confirms that you have moved out of unit <strong>[[unitNumber]]</strong> at <strong>[[facilityName]]</strong> as of <strong>[[todayDate]]</strong>.</p>
<p>Your final balance is <strong>$[[balance]]</strong>.</p>
<p>Thank you for choosing [[facilityName]]. We hope to serve you again in the future!</p>
<p>[[facilityName]]<br/>[[facilityPhone]]</p>`,
    textContent: '[[facilityName]]: Move-out confirmed for unit [[unitNumber]]. Final balance: $[[balance]]. Thank you!',
    postcardContent: '',
    emailEnabled: true,
    textEnabled: false,
    printEnabled: false,
    rule: 'manual' as const,
    description: 'Sent after a tenant has completed their move-out.',
  },
  {
    name: 'Move Out Request',
    type: 'default' as const,
    emailSubject: 'Move-Out Request Received — [[facilityName]]',
    emailContent: `<p>Dear [[tenantName]],</p>
<p>We have received your request to move out of unit <strong>[[unitNumber]]</strong>.</p>
<p>Please ensure your unit is emptied and clean by your scheduled move-out date. Your gate code will be deactivated upon move-out.</p>
<p>If you need to cancel or change your move-out date, please contact us at [[facilityPhone]].</p>
<p>[[facilityName]]</p>`,
    textContent: '[[facilityName]]: Your move-out request for unit [[unitNumber]] has been received. Questions? Call [[facilityPhone]].',
    postcardContent: '',
    emailEnabled: true,
    textEnabled: false,
    printEnabled: false,
    rule: 'manual' as const,
    description: 'Sent when a tenant submits a move-out request.',
  },
  {
    name: 'Reservation Receipt',
    type: 'default' as const,
    emailSubject: 'Reservation Confirmed — [[facilityName]]',
    emailContent: `<p>Dear [[tenantName]],</p>
<p>Your reservation for unit <strong>[[unitNumber]]</strong> at <strong>[[facilityName]]</strong> has been confirmed.</p>
<p>Monthly Rate: <strong>$[[monthlyRate]]</strong></p>
<p>We will contact you when it is time to complete your move-in. If you have questions, call us at [[facilityPhone]].</p>
<p>[[facilityName]]</p>`,
    textContent: '[[facilityName]]: Reservation confirmed for unit [[unitNumber]] at $[[monthlyRate]]/mo. We will contact you for move-in. Call [[facilityPhone]] with questions.',
    postcardContent: '',
    emailEnabled: true,
    textEnabled: true,
    printEnabled: false,
    rule: 'manual' as const,
    description: 'Sent when a reservation is confirmed.',
  },
  {
    name: 'Waiting List Confirmation',
    type: 'default' as const,
    emailSubject: 'Waiting List Confirmation — [[facilityName]]',
    emailContent: `<p>Dear [[tenantName]],</p>
<p>You have been added to the waiting list at <strong>[[facilityName]]</strong>.</p>
<p>We will notify you as soon as a unit matching your preference becomes available.</p>
<p>If you have any questions, please contact us at [[facilityPhone]] or [[facilityEmail]].</p>
<p>[[facilityName]]</p>`,
    textContent: '[[facilityName]]: You have been added to our waiting list. We will notify you when a unit is available. Call [[facilityPhone]] with questions.',
    postcardContent: '',
    emailEnabled: true,
    textEnabled: true,
    printEnabled: false,
    rule: 'manual' as const,
    description: 'Sent when a customer is added to the waiting list.',
  },
  {
    name: 'Rate Change Notice',
    type: 'default' as const,
    emailSubject: 'Rate Change Notice — [[facilityName]]',
    emailContent: `<p>Dear [[tenantName]],</p>
<p>This is to notify you that the monthly rental rate for unit <strong>[[unitNumber]]</strong> will be changing to <strong>$[[monthlyRate]]</strong> effective <strong>[[dueDate]]</strong>.</p>
<p>If you have any questions or concerns, please do not hesitate to contact us at [[facilityPhone]].</p>
<p>Thank you for your continued business.</p>
<p>[[facilityName]]<br/>[[facilityAddress]]<br/>[[facilityPhone]]</p>`,
    textContent: '[[facilityName]]: Rate change notice — unit [[unitNumber]] new rate: $[[monthlyRate]]/mo effective [[dueDate]]. Call [[facilityPhone]] with questions.',
    postcardContent: `<p>Dear [[tenantName]],</p><p>Your rate for unit [[unitNumber]] will change to $[[monthlyRate]]/mo on [[dueDate]].</p><p>[[facilityName]] — [[facilityPhone]]</p>`,
    emailEnabled: true,
    textEnabled: false,
    printEnabled: true,
    rule: 'manual' as const,
    description: 'Sent when a tenant rate change is scheduled.',
  },
  {
    name: 'Account Information',
    type: 'default' as const,
    emailSubject: 'Account Information — [[facilityName]]',
    emailContent: `<p>Dear [[tenantName]],</p>
<p>Here is your account information for <strong>[[facilityName]]</strong>:</p>
<ul>
<li><strong>Unit:</strong> [[unitNumber]]</li>
<li><strong>Monthly Rate:</strong> $[[monthlyRate]]</li>
<li><strong>Current Balance:</strong> $[[balance]]</li>
<li><strong>Gate Code:</strong> [[gateCode]]</li>
</ul>
<p>Log in to your tenant portal to view full details or make a payment.</p>
<p>[[facilityName]]<br/>[[facilityPhone]]</p>`,
    textContent: '[[facilityName]]: Unit [[unitNumber]], Rate: $[[monthlyRate]]/mo, Balance: $[[balance]], Gate: [[gateCode]]. Questions? [[facilityPhone]]',
    postcardContent: '',
    emailEnabled: true,
    textEnabled: false,
    printEnabled: false,
    rule: 'manual' as const,
    description: 'General account information email.',
  },
  {
    name: 'Automatic Payment Receipt',
    type: 'default' as const,
    emailSubject: 'Autopay Payment Processed — [[facilityName]]',
    emailContent: `<p>Dear [[tenantName]],</p>
<p>Your automatic payment of <strong>$[[paymentAmount]]</strong> for unit <strong>[[unitNumber]]</strong> has been processed on <strong>[[paymentDate]]</strong>.</p>
<p>Your current balance is <strong>$[[balance]]</strong>.</p>
<p>If you need to update your payment method or cancel autopay, please log into your tenant portal.</p>
<p>Thank you,<br/>[[facilityName]]<br/>[[facilityPhone]]</p>`,
    textContent: '[[facilityName]]: Autopay of $[[paymentAmount]] processed for unit [[unitNumber]]. Balance: $[[balance]]. Thank you!',
    postcardContent: '',
    emailEnabled: true,
    textEnabled: false,
    printEnabled: false,
    rule: 'manual' as const,
    description: 'Sent after an automatic (autopay) payment is processed.',
  },
]
