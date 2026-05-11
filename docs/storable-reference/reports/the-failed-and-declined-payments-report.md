# The Failed and Declined Payments Report

**Source:** https://storageunitsoftware.zendesk.com/hc/en-us/articles/18027946762519-The-Failed-and-Declined-Payments-Report
**Article ID:** 18027946762519

---

You can run the _Failed and Declined Payments_ Report to see all the declined payments over any specified date range. 

1\. Log in to your Storable Easy account.

2\. Hover over the **Reports** tab and select either **All Reports** or Accounting/Financials. Either will take you to the next screen.

![Reports_Drop_Down.JPG](https://d33v4339jhl8k0.cloudfront.net/docs/assets/5a0382240428633199244fa0/images/5a14989c042863319924a860/Reports_Drop_Down.JPG)

3\. Click **Failed and Declined Payments** under the Accounting/Financials column.

![Screen Shot 2024-02-02 at 11.23.40 AM \(1\).png](https://storageunitsoftware.zendesk.com/hc/article_attachments/21075972522391)

4\. Select which type of payments you want to show in the report.

![Screen Shot 2024-02-02 at 11.24.13 AM.png](https://storageunitsoftware.zendesk.com/hc/article_attachments/21075972533911)

5\. Set the date range and click **Load Report**.

![4.JPG](https://d33v4339jhl8k0.cloudfront.net/docs/assets/5a0382240428633199244fa0/images/5a14989d042863319924a862/4.JPG)

6\. The report shows the date of the transaction, the customer, what type of payment it was, why the payment failed, and the amount of the item being billed. 

This can be formatted for printing by clicking the grey button in the top right corner of the page.

**_Note:_ **The _Failed Recurring Billing_ email, if enabled, will be sent both to the tenant and also to the email located in the "Email, Txt & Print" tab > Settings.

## Failure reasons

**Code** |  **Reason**  
---|---  
Insufficient Funds |  The card does not have enough funds to cover the transaction.  
Issuer Unavailable |  There is a problem with the issuer network. Please contact the issuing bank.  
Invalid Transaction |  The transaction is not permitted; contact the issuing bank.  
Re-submit Transaction |  There is a temporary problem with your submission. Please re-submit the transaction.  
Invalid or expired card |  The card is invalid or expired. Contact cardholder to update information.  
Expired Card |  The card is expired. The tenant needs to delete the payment account and create a new one so the expiration date is updated.  
Issuer Generated Error |  An unspecified error was returned by the issuer. Please retry the transaction and if the problem persist, contact the issuing bank.  
Suspected Fraud |  The issuing bank declined the transaction as suspected fraud.  
Pickup Card - Lost Card |  The submitted card was reported as lost and should be removed from use.  
Pickup Card - Stolen Card |  The submitted card was reported as stolen and should be removed from use.  
Pickup card - Other than Lost/Stolen |  The issuer indicated that the gift card should be removed from use.  
Invalid Account Number |  The account number is not valid; contact the cardholder to confirm information or inquire about another form of payment  
Restricted Card |  The card has a restriction preventing approval for this transaction. Please contact the issuing bank for a specific reason. You may also receive this code if the transaction was declined due to Fraud Filtering.  
Restricted Card - Chargeback |  This transaction is being declined due to a Prior Chargeback Card Filtering Service or the card has a restriction preventing approval if there are any chargebacks against it.  
No such issuer |  The card number references an issuer that does not exist. Do not process the transaction.  
Do Not Honor |  The issuing bank has put a temporary hold on the card.  
Generic Decline |  There is an unspecified problem; contact the issuing bank for more details. Check the Credit Card Expiration Dates report. If the CC expiration date is expired, the tenant needs to add a new payment account. Note: This code can be a hard or soft decline, depending on the method of payment, and other variables.  
Decline CVV2/CID Fail |  The CVV2/CID is invalid.  
Transaction declined: Cardholder transaction not permitted |  This response code is returned by a payment processor or issuer when a transaction is attempted with a credit or debit card flagged as restricted or blocked.  
Card Not Active |  A new card has been issued to the cardholder but the cardholder has not activated the card.  
The related merchants record is frozen |  The Payment Processing account has been put on hold or frozen.  
Transaction Declined: Duplicate Transaction |  If issuing a refund, this means a refund has already been processed on the same credit card. The additional refund will have to be postponed until the next day.  
Transaction declined: The account was closed |  The bank account used for payment has been closed.  
R03: No account/unable to locate account |  The bank account either does not exist or has not been activated.  
E-check processing disabled for this account |  The bank account is not set up to process ACH/e-check payments OR the bank account has been blocked due to previously failed payments.  
R29: Corporate customer advises not authorized |  A debit block or debit filter that has been enabled on the bank account.  
Decline error 050 |  This message is received from the customer's credit card issuing bank. Decline code 050 means “Do not honor” the purchase. The tenant needs to call their bank.  
Please correct the following errors and try again Transaction declined: Duplicate transaction" |  When refunding a payment, only one refund is allowed per day.  
If a second refund is attempted on a transaction on the same day as the initial refund, this error will occur.  
The additional refund will have to be submitted the following day.  
Payment.Method is required to be set |  The payment may be declined for a number of reasons: the card has expired, the customer is over their credit limit, the card issuer sees suspicious activity that could be a sign of fraud, etc.  
Decline - Re-try Transaction. |  This type of decline is one that indicates the transaction can be reattempted. The second payment attempt may be successful if the problem that caused the first decline has been fixed. If not, the tenant needs to reach out to their bank.  
Transaction declined: Invalid transaction or card restriction; verify information and resubmit |  This code is often returned from the issuer when they do not accept the transaction. This can be when a transaction for the same amount and merchant is attempted multiple times quickly for the same card. The card holder should contact their issuing bank.  
Message: Transaction declined: Invalid Merchant |  This indicates that there is something wrong with the payment processing account.