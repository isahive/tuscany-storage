# Late/Lien settings

**Source:** https://storageunitsoftware.zendesk.com/hc/en-us/articles/14501720951191-Late-Lien-settings
**Article ID:** 14501720951191

---

The Late/Lien feature allows you to fully control what happens when a rent line item remains unpaid past its due date. You can set up multiple status events to occur on different dates past the due date of the invoiced rent. For example, you can set up an automatic late fee to be queued 5 days after the due date coupled with an automated text message reminder and an automated email reminder. On top of that, you can add an event to add an automatic late fee to be applied 10 days past the due date with the same auto notification settings. 

The 5 events below will/can be correlated with the status color of the unit, notifications (email, text, or print), as well as fees that can automatically be generated on the tenant's account. 

  * **Late** \- The customer is past due. This event will reoccur every month that the tenant is late.
  * **Locked Out** \- The customer is locked out of their unit/ has no access (if software is integrated with a gate system)
  * **Pre-Lien** \- Warning that the facility will take possession of belongings.
  * **Lien** \- The facility has the right to take belongings.
  * **Auction** \- Belongings will be sold.



When**setting the days past due** , keep in mind the due date is not included. If the rule is set to 4 days and rent is due on the 1st of the month, the rule will apply on the 5th.

Keep in mind that the rules you set need to be sequential. For example, a Lockout rule needs to be set to at least one day greater than the Late rule, the Pre-Lien rule needs to be set to at least one day later than the lockout rule, etc.

When **editing and changing the days past due** on a current rule, it is important to keep in mind the date you are making the change. For example:  
If the days past due is set to 10 and you change it to 5, in order for the change to take effect for the current month, the update would need to happen prior to the 5th day of the month.  
If you make this same change on 8th day of the month, your late tenants may be charged another late fee. 

Follow the steps below to access the Late/Lien Settings:

1\. Log into your account

2\. Click the **Setup** tab

3\. Click the **Late/Lien** sub-tab

![](https://d33v4339jhl8k0.cloudfront.net/docs/assets/5a0382240428633199244fa0/images/5a2986850428631b6b6dbf0f/file-HR6BUbFJJy.jpg)

4\. Click **Edit** , to the far right of the page, to customize the days past due, the notifications that get sent and how they get sent, and the fees associated with each status.

![](https://d33v4339jhl8k0.cloudfront.net/docs/assets/5a0382240428633199244fa0/images/5a2989c52c7d3a1a640cb34c/file-Z9c8KSibMR.png)

These notifications are automatically sent, following the late rules that you have listed here. If you do not want the emails or text messages to automatically send until your setup is complete, wait until you are live to enable the notifications. The rest of the late rule can be set up, just choose "Printed Letter" for the notification option if you do not want to system to send the text or email. 

If you**** choose to [exempt a tenant from a late fee](https://storageunitsoftware.zendesk.com/hc/en-us/articles/20870529495575), the tenant will not be charged the late fee as well as any other fees that are setup in your Late/Lien page. Depending on the situation for the exemption, it is advisable that you also [disable the customer's Late/Lien notifications](https://storageunitsoftware.zendesk.com/hc/en-us/articles/15456761911831-How-do-I-enable-or-disable-late-notices-for-a-customer).

## Auction fee and grace period

The Auction fee will be applied after the number of grace period days, however, the grace period is based on Rent line items, not Fee line items. 

For example, if you set up an auction fee for a 45 day grace period and you look at the Collections Report and are wondering why some people are 45 days past due but haven't been charged their auction fee yet, then the reason would most likely be because the number of past due days is based on Fees & Rent, whereas the auction grace period is based on the days behind of the Rent line item. 

## FAQ

_A past due tenant's unit status did not change and a late and/or lock out fee was not applied to their account, why is this?_  
If a tenant pays via ACH and the payment fails 5 to 7 days later due to Insufficient Funds, the late/lien rules will NOT apply to the tenant's account. In this case, you would need to manually change the status of the unit and [apply a manual fee](https://storageunitsoftware.zendesk.com/hc/en-us/articles/14500439732119-How-do-I-manually-charge-a-fee) to the account.

_Will late/lien events repeat?_

The late/lien event repeats every month, resending the notifications and processing a late fee. The lock-out rules and later events only occur once.