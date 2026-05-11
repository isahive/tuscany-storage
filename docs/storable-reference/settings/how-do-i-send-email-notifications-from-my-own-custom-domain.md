# How do I send email notifications from my own custom domain?

**Source:** https://storageunitsoftware.zendesk.com/hc/en-us/articles/18058709671447-How-do-I-send-email-notifications-from-my-own-custom-domain
**Article ID:** 18058709671447

---

**Please Note: This is NOT an option for gmail, yahoo or other email providers.**

Email notifications sent to customers come from a generic domain: noreply@email-notifications.net. This allows good deliverability and reduces the chance of an email being flagged as spam.

However, if you prefer to have your customers receive emails from your own custom domain email address, you can do so; provided you can access your domain registrar and add a special record which allows Storable Easy to send email on behalf of your domain.

In order to send emails from your custom email address, please follow the steps below:

  1. Log in to your domain account for your domain host provider (Godaddy, Network Solutions, Etc.).
  2. Open the DNS Management page (usually located in/under the Control Panel).
  3. Add a new TXT record in the records section.
     1. **Host** field: @
     2. **Value** field: "v=spf1 a mx include:email-notifications.net ~all".
     3. Save the record.
  4. Once you have completed steps 1-3 please email [easysupport@storable.com](mailto:easysupport@storable.com) and let the support team know what your custom domain email address is. 



Note that SPF records may take up to 48 hours to take effect.  
You can verify your SPF record at [SPF CHECKER](https://www.spf-record.com/spf-lookup)

Domain DNS settings [www.dnschecker.org](http://www.dnschecker.org/)

This will also allow you to choose your own Display Name that will show on your customer's email platform. To change this, you will have to contact our support as well. Adding a Display Name is not guaranteed to work; some older email platforms will ignore it.