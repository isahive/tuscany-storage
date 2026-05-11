# Rate Management

**Source:** https://storageunitsoftware.zendesk.com/hc/en-us/articles/14496570370839-Rate-Management
**Article ID:** 14496570370839

---

Rate Management is a set of tools that allow you to stay on top of both "street rates" (Unit Type Price) and rates for existing tenants using occupancy rates and time since the last rate change to suggest increases. The Rate Management tools **do not** automatically change rates, they only suggest changes based on the rules you configure. 

# Rate Management Settings

The Settings page is where you will configure and update your Rate Management rules. To begin, go to Setup > Rate Management, enable Rate Management and choose your Reminder Day of the Month. The Reminder Day of the Month will be the day of the month you will receive an email reminding you to check Rate Management; this will be sent to the notifications email. _Note:_ Rate Management can be done at any time and not just once a month. The optional monthly email is simply a reminder.

### Rule Types

There are two rule types, _Unit Type Price Change Rules_ and _Rental Price Change Rules_. Unit Type Price rules are based on occupancy and govern Street rates. Rental Price rules are based on time since the last rate change and govern current tenant rates.

### Unit Type Price Change Rules

You can set this rule type for one, multiple or all Unit Types. You will choose an amount or percentage to change the amounts by, the rounding rule, and the occupancy rate upon which to trigger this change.  _Note: These rules will effect Units Types and ALL pricing plans associated with them._

To configure a Unit Type Price Change Rule(s):

  * **Add Rule:** This will show the rule options and allow you to set up each rule. You can have up to one rule per Unit Type.
  * **Increase Monthly Unit Type Price By:** Choose to increase the Unit Type price by a fixed amount or a percentage.
  * **When Occupancy Has Met or Exceeded:** Enter the target occupancy percentage at which you want to be prompted to change the Unit Type Price. The occupancy percentage will be per Unit Type not for the facility as a whole.
  * **Applies to:** Choose Specific Unit Types or leave it on All. Selected Unit Types will show blue. Each Unit Type will show its current occupancy below the name.



### Rental Price Change Rules

You can set this rule type for one, multiple, or all Unit Types. There are 3 options that effect all of these rule types: Advance Notice, Rounding, and Exceed Street Rate.

  * **Advance Notice:** The number of days prior to the invoice date (number of days before the due date the customer is invoiced - Billing Period) that the customer should be notified.  
_Note: You must enter a number of days but the notification is optional._  
Example: A customer has a Due Date of the 20th, a 5 day Billing Period, and an Advance Notice period of 5 days. The Notification Date will be the 10th and the Change Date will be the 15th.
  * **Rental Price Increases Can Exceed Street Rate:** By checking this option, you will allow the new suggested price to exceed the current Unit Type Price, or street rate, on the current rental.
  * **Round Rental Price to the Nearest Dollar** : By checking this option, the new suggested price will round to the nearest whole dollar amount.



To configure a Rental Price Change Rules(s):

  * **Add Rule** : This will show the rule options and allow you to set up each rule. You can have up to one rule per Unit Type.
  * **Increase Monthly Unit Type Price By:** Choose to increase the Unit Type price by a fixed amount or a percentage.
  * **When Price Hasn't Changed In:** Enter the number of months since the last price update at which you'd like to be prompted to change the rate.
  * **Applies to** : Choose Specific Unit Types or leave it on All. Selected Unit Types will show blue.



Once you have your rules configured, or after making changes to existing rules, click **Update Settings** at the bottom of the page.

# Rate Management Summary

The Summary page is where you will review and submit the actual changes prompted by the rules on the Settings page. The Summary page can be visited at any time and will show Unit Types and Rentals that match the configured rules. You may choose to make adjustments to the new suggested prices, or skip a given change which will leave it on the Summary page for a later date. The changes are separated into two sections, one for each rule type. Review each section completely before clicking Submit Changes.

### Unit Type Price Changes

This section will show a table of Unit Types and suggested changes for each Occupancy Percentage configured in the rules from the Settings page. Review the New Price field and make any desired changes to it, or uncheck the box to skip that Unit Type and leave it unchanged. 

The form also allows you to enter a New Target Occupancy percentage that will update the rule from the Settings page upon clicking Submit Changes. We recommend updating this setting so the same Unit Types don't show up again immediately after the change has been submitted.

### Rental Price Changes

This section will show each Rental and the Customer associated with it along with the dates and amount of the change. The Notification Date is the day the Customer will be optionally notified (see below) of the rate change. The Change Date is the day the new rate will be applied to the rental and will be used moving forward for all invoices created for that rental.

### Notifications

Here you will choose how you want the notifications to go out; Email, Text or Print. You can choose any combination of the three, all or none of them. You will **not** be able to change this once you have selected it and hit Submit Changes.

# Rate Management Batches

The Batches page will show you all batches that have been submitted from Rate Management and [Mass Edit Rental Prices](https://storageunitsoftware.zendesk.com/hc/en-us/articles/20064249790615-Mass-Edit-Rental-Prices). You can click on the date of the batch to see when it was created, who created it, if printing was one of the notification options, and a list of unit types/who the price change will effect. You can also click the view next to each customers Change Date.

### Scheduled Price Change

From this page, you can change the New Monthly Price, reprint the notification (if you chose printing as a notification option), or Cancel Scheduled Price Change.

To make a rental exempt from Rate Management/Mass Edit Rental Prices, go to the customer's profile page. Under the _Rentals_ section, click **Edit** next to _Billing_. Check the box to **Exempt from Rate Management** under the Plan. Be sure to save the changes.