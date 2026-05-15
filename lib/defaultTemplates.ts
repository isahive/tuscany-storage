/** Default notification templates seeded when none exist. */
export const DEFAULT_TEMPLATES = [
  {
    name: 'Invoice Reminder',
    type: 'default' as const,
    emailSubject: 'Payment Reminder — [[FACILITY_NAME]]',
    emailContent: `<p>Dear [[CUSTOMER_NAME]],</p>
<p>This is a friendly reminder that your storage rental payment of <strong>[[BALANCE]]</strong> for unit <strong>[[UNIT_NUMBER]]</strong> is due on <strong>[[DUE_DATE]]</strong>.</p>
<p>Please log into your tenant portal to make a payment or set up autopay.</p>
<p>Thank you,<br/>[[FACILITY_NAME]]<br/>[[FACILITY_PHONE]]</p>`,
    textContent: '[[FACILITY_NAME]]: Reminder — [[BALANCE]] due on [[DUE_DATE]] for unit [[UNIT_NUMBER]]. Log in to pay: [[PORTAL_URL]]',
    postcardContent: `<p>Dear [[CUSTOMER_NAME]],</p><p>Your payment of [[BALANCE]] for unit [[UNIT_NUMBER]] is due [[DUE_DATE]].</p><p>[[FACILITY_NAME]] — [[FACILITY_PHONE]]</p>`,
    emailEnabled: true,
    textEnabled: false,
    printEnabled: true,
    rule: 'manual' as const,
    description: 'Automatically sent to a customer to remind them of an upcoming payment.',
  },
  {
    name: 'Failed Recurring Payment',
    type: 'default' as const,
    emailSubject: 'Payment Failed — [[FACILITY_NAME]]',
    emailContent: `<p>Dear [[CUSTOMER_NAME]],</p>
<p>Unfortunately, your recent payment for unit <strong>[[UNIT_NUMBER]]</strong> could not be processed.</p>
<p>Please log into your tenant portal and update your payment method or try again.</p>
<p>If you have any questions, please contact us at [[FACILITY_PHONE]].</p>
<p>[[FACILITY_NAME]]</p>`,
    textContent: '[[FACILITY_NAME]]: Your payment for unit [[UNIT_NUMBER]] failed. Please log in and update your payment method or contact us at [[FACILITY_PHONE]].',
    postcardContent: '',
    emailEnabled: true,
    textEnabled: false,
    printEnabled: false,
    rule: 'manual' as const,
    description: 'Automatically sent to a customer after a failed payment. Can also be manually sent while bouncing a check/ach.',
  },
  {
    name: 'Rental Instructions',
    type: 'default' as const,
    emailSubject: 'Welcome to [[FACILITY_NAME]] — Rental Instructions',
    emailContent: `<p>Dear [[CUSTOMER_NAME]],</p>
<p>Welcome to <strong>[[FACILITY_NAME]]</strong>! Here are your rental details:</p>
<ul>
<li><strong>Unit:</strong> [[UNIT_NUMBER]]</li>
<li><strong>Monthly Rate:</strong> [[MONTHLY_RATE]]</li>
<li><strong>Gate Code:</strong> [[GATE_CODE]]</li>
</ul>
<p>Access hours are posted at the facility. Please keep your gate code confidential.</p>
<p>If you have any questions, contact us at [[FACILITY_PHONE]] or [[FACILITY_EMAIL]].</p>
<p>Thank you,<br/>[[FACILITY_NAME]]</p>`,
    textContent: '[[FACILITY_NAME]]: Welcome! Unit [[UNIT_NUMBER]], Gate code: [[GATE_CODE]], Rate: [[MONTHLY_RATE]]/mo. Questions? Call [[FACILITY_PHONE]].',
    postcardContent: '',
    emailEnabled: true,
    textEnabled: true,
    printEnabled: false,
    rule: 'manual' as const,
    description: 'Automatically sent to a customer after successfully renting a unit.',
  },
  {
    name: 'Storage Agreement',
    type: 'default' as const,
    emailSubject: 'Your Storage Agreement — [[FACILITY_NAME]]',
    emailContent: `<p>Dear [[CUSTOMER_NAME]],</p>
<p>Attached is your signed storage agreement for unit <strong>[[UNIT_NUMBER]]</strong> at <strong>[[FACILITY_NAME]]</strong>.</p>
<p>Please keep this for your records. If you have any questions, contact us at [[FACILITY_PHONE]].</p>
<p>[[FACILITY_NAME]]</p>`,
    textContent: '[[FACILITY_NAME]]: Your storage agreement for unit [[UNIT_NUMBER]] has been sent to [[CUSTOMER_EMAIL]]. Contact us at [[FACILITY_PHONE]] with questions.',
    postcardContent: '',
    emailEnabled: true,
    textEnabled: false,
    printEnabled: false,
    rule: 'manual' as const,
    description: 'Manually sent to a customer when viewing a storage agreement.',
  },
  {
    name: 'Notice of Scheduled Rate Change',
    type: 'default' as const,
    emailSubject: 'Upcoming Rate Change — [[FACILITY_NAME]]',
    emailContent: `<p>Dear [[CUSTOMER_NAME]],</p>
<p>This notice is to inform you that a rental rate change has been <strong>scheduled</strong> for your unit at <strong>[[FACILITY_NAME]]</strong>.</p>
<p>Effective <strong>[[DUE_DATE]]</strong>, the monthly rental rate for unit <strong>[[UNIT_NUMBER]]</strong> will change to <strong>[[MONTHLY_RATE]]</strong>.</p>
<p>If you have any questions, please contact us at [[FACILITY_PHONE]].</p>
<p>Thank you,<br/>[[FACILITY_NAME]]</p>`,
    textContent: '[[FACILITY_NAME]]: A rate change is scheduled — unit [[UNIT_NUMBER]] new rate [[MONTHLY_RATE]] effective [[DUE_DATE]]. Call [[FACILITY_PHONE]] with questions.',
    postcardContent: '',
    emailEnabled: true,
    textEnabled: true,
    printEnabled: true,
    rule: 'manual' as const,
    description: 'Manually sent to one or more customers when scheduling rental price changes.',
  },
  {
    name: 'Move Out Receipt',
    type: 'default' as const,
    emailSubject: 'Move-Out Confirmation — [[FACILITY_NAME]]',
    emailContent: `<p>Dear [[CUSTOMER_NAME]],</p>
<p>This confirms that you have moved out of unit <strong>[[UNIT_NUMBER]]</strong> at <strong>[[FACILITY_NAME]]</strong> as of <strong>[[DATE]]</strong>.</p>
<p>Your final balance is <strong>[[BALANCE]]</strong>.</p>
<p>Thank you for choosing [[FACILITY_NAME]]. We hope to serve you again in the future!</p>
<p>[[FACILITY_NAME]]<br/>[[FACILITY_PHONE]]</p>`,
    textContent: '[[FACILITY_NAME]]: Move-out confirmed for unit [[UNIT_NUMBER]]. Final balance: [[BALANCE]]. Thank you!',
    postcardContent: '',
    emailEnabled: true,
    textEnabled: false,
    printEnabled: false,
    rule: 'manual' as const,
    description: 'Automatically sent to a customer after successfully moving out of a rental.',
  },
  {
    name: 'Reservation Receipt',
    type: 'default' as const,
    emailSubject: 'Reservation Confirmed — [[FACILITY_NAME]]',
    emailContent: `<p>Dear [[CUSTOMER_NAME]],</p>
<p>Your reservation for unit <strong>[[UNIT_NUMBER]]</strong> at <strong>[[FACILITY_NAME]]</strong> has been confirmed.</p>
<p>Monthly Rate: <strong>[[MONTHLY_RATE]]</strong></p>
<p>We will contact you when it is time to complete your move-in. If you have questions, call us at [[FACILITY_PHONE]].</p>
<p>[[FACILITY_NAME]]</p>`,
    textContent: '[[FACILITY_NAME]]: Reservation confirmed for unit [[UNIT_NUMBER]] at [[MONTHLY_RATE]]/mo. We will contact you for move-in. Call [[FACILITY_PHONE]] with questions.',
    postcardContent: '',
    emailEnabled: true,
    textEnabled: true,
    printEnabled: false,
    rule: 'manual' as const,
    description: 'Automatically sent to a customer after successfully reserving a unit. Manually sent when viewing an active reservation.',
  },
  {
    name: 'Scheduled Move Out',
    type: 'default' as const,
    emailSubject: 'Move-Out Scheduled — [[FACILITY_NAME]]',
    emailContent: `<p>Dear [[CUSTOMER_NAME]],</p>
<p>Your move-out from unit <strong>[[UNIT_NUMBER]]</strong> at <strong>[[FACILITY_NAME]]</strong> has been <strong>scheduled for [[DUE_DATE]]</strong>.</p>
<p>Please ensure your unit is emptied and clean by your scheduled move-out date. Your gate code will be deactivated upon move-out.</p>
<p>If you need to cancel or change your scheduled date, please contact us at [[FACILITY_PHONE]].</p>
<p>[[FACILITY_NAME]]</p>`,
    textContent: '[[FACILITY_NAME]]: Your move-out for unit [[UNIT_NUMBER]] is scheduled for [[DUE_DATE]]. Questions? Call [[FACILITY_PHONE]].',
    postcardContent: '',
    emailEnabled: true,
    textEnabled: false,
    printEnabled: false,
    rule: 'manual' as const,
    description: 'Automatically sent to a customer when a rental is scheduled for move out on a future date.',
  },
  {
    name: 'Waiting List Confirmation',
    type: 'default' as const,
    emailSubject: 'Waiting List Confirmation — [[FACILITY_NAME]]',
    emailContent: `<p>Dear [[CUSTOMER_NAME]],</p>
<p>You have been added to the waiting list at <strong>[[FACILITY_NAME]]</strong>.</p>
<p>We will notify you as soon as a unit matching your preference becomes available.</p>
<p>If you have any questions, please contact us at [[FACILITY_PHONE]] or [[FACILITY_EMAIL]].</p>
<p>[[FACILITY_NAME]]</p>`,
    textContent: '[[FACILITY_NAME]]: You have been added to our waiting list. We will notify you when a unit is available. Call [[FACILITY_PHONE]] with questions.',
    postcardContent: '',
    emailEnabled: true,
    textEnabled: true,
    printEnabled: false,
    rule: 'manual' as const,
    description: 'Automatically sent to a customer immediately after they are added to the waiting list.',
  },
  {
    name: 'Account Information',
    type: 'default' as const,
    emailSubject: '[[FACILITY_NAME]] Account Created',
    emailContent: `<p>Dear [[CUSTOMER_NAME]],</p>
<p>You have successfully registered with [[FACILITY_NAME]].</p>
<p>Your username is: <strong>[[CUSTOMER_USERNAME]]</strong>.</p>
<p>If you are having trouble logging in, please use the &lsquo;forgot password&rsquo; link.</p>
<p>You can log in at [[FACILITY_URL]].</p>
<p>Thank you,</p>
<p>[[FACILITY_NAME]]<br/>[[FACILITY_PHONE]]</p>`,
    textContent: 'You have registered with [[FACILITY_NAME]]. Username: [[CUSTOMER_USERNAME]]. Login at [[FACILITY_URL]]. For help call [[FACILITY_PHONE]].',
    postcardContent: '',
    emailEnabled: true,
    textEnabled: true,
    printEnabled: false,
    rule: 'manual' as const,
    description: 'Automatically sent to a customer after registering on your website. It does not send to imported customers.',
  },
  {
    name: 'Manually Sent Payment Receipt',
    type: 'default' as const,
    emailSubject: 'Payment Receipt — [[FACILITY_NAME]]',
    emailContent: `<p>Dear [[CUSTOMER_NAME]],</p>
<p>Per your request, here is your payment receipt:</p>
<ul>
<li><strong>Amount:</strong> [[PAYMENT_AMOUNT]]</li>
<li><strong>Date:</strong> [[PAYMENT_DATE]]</li>
<li><strong>Unit:</strong> [[UNIT_NUMBER]]</li>
</ul>
<p>If you have any questions, contact us at [[FACILITY_PHONE]].</p>
<p>Thank you,<br/>[[FACILITY_NAME]]</p>`,
    textContent: '[[FACILITY_NAME]]: Receipt — [[PAYMENT_AMOUNT]] on [[PAYMENT_DATE]] for unit [[UNIT_NUMBER]]. Questions? [[FACILITY_PHONE]]',
    postcardContent: '',
    emailEnabled: true,
    textEnabled: false,
    printEnabled: false,
    rule: 'manual' as const,
    description: 'Manually sent to a customer when viewing a previous payment receipt.',
  },
  {
    name: 'Automatic Payment Receipt',
    type: 'default' as const,
    emailSubject: 'Payment Processed — [[FACILITY_NAME]]',
    emailContent: `<p>Dear [[CUSTOMER_NAME]],</p>
<p>Your payment of <strong>[[PAYMENT_AMOUNT]]</strong> for unit <strong>[[UNIT_NUMBER]]</strong> has been processed on <strong>[[PAYMENT_DATE]]</strong>.</p>
<p>Your current balance is <strong>[[BALANCE]]</strong>.</p>
<p>If you need to update your payment method or cancel autopay, please log into your tenant portal.</p>
<p>Thank you,<br/>[[FACILITY_NAME]]<br/>[[FACILITY_PHONE]]</p>`,
    textContent: '[[FACILITY_NAME]]: Payment of [[PAYMENT_AMOUNT]] processed for unit [[UNIT_NUMBER]]. Balance: [[BALANCE]]. Thank you!',
    postcardContent: '',
    emailEnabled: true,
    textEnabled: false,
    printEnabled: false,
    rule: 'manual' as const,
    description: 'Automatically sent to a customer immediately following a successful payment.',
  },
]
