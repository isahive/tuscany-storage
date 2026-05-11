# Default Template Placeholder Definitions

**Source:** https://storageunitsoftware.zendesk.com/hc/en-us/articles/18056804817943-Default-Template-Placeholder-Definitions
**Article ID:** 18056804817943

---

The following placeholders are available to use in document templates in order to populate facility and customer data. 

📖 Learn more about[ using placeholders.](https://storageunitsoftware.zendesk.com/hc/en-us/articles/18031379586071-Using-placeholders)

**Placeholder** | **Where it pulls from**  
---|---  
ADDITIONAL_DEPOSIT | Customer Profile > Rentals > Deposit Paid > Additional Deposit > Additional Deposit Charged > Amount  
ADDITIONAL_DEPOSIT_REFUND_AMOUNT | Customer Profile > Rentals > Deposit Paid > **** Additional Deposit > Additional Deposit Charged > Amount  
ALTERNATE_ADDRESS | Customer Profile > Customer Information > Alternate Contact Information > Address (Street address, city, state & zip)  
ALTERNATE_CITY_STATE_ZIP | Customer Profile > Customer Information > Alternate Contact Information > City, State & Zip  
ALTERNATE_CONTACT | Customer Profile > Customer Information > Alternate Contact Information > Contact  
ALTERNATE_PHONE_NUMBER | Customer Profile > Customer Information > Alternate Contact Information > Phone Number  
ALTERNATE_STREET_ADDRESS | Customer Profile > Customer Information > Alternate Contact Information > Street Address Only  
ALTERNATE_EMAIL | Customer Profile > Customer Information > Alternate Contact Information > Email  
AUCTION_DATE | Auction Date appearing in the Red bar across the top of a Customer Profile.  
This can be set by the lockout rules OR on the Customer Profile > Gate Access page  
BALANCE | Customer Profile > Balance; total owed on the customers account (oustanding minus credit)  
BILLING_CYCLE | Customer Profile > Rentals > Billing; shows number of months for the current billing cycle  
CUSTOMER_ACCESS_CODE | Customer Profile > Customer Information > Account & Access > Access Code; this only works for the Storable Access Control (PDK)  
CUSTOMER_ADDRESS | Customers Profile > Customer Information Contact > Address (Street address, city, state & zip)  
CUSTOMER_CELL_PHONE_NUMBER | Customer Profile > Customer Information > Contact > Cell Phone  
CUSTOMER_CITY_STATE_ZIP | Customer Profile > Customer Information > Contact > City, State & Zip  
CUSTOMER_NAME | Customer Profile > Customer Information > Contact > Name  
CUSTOMER_PASSWORD | Pulls customer password, can ONLY be used in Automatic templates  
CUSTOMER_PHONE_NUMBER | Customer Profile > Customer Information > Contact > Phone  
CUSTOMER_STREET_ADDRESS | Customers Profile > Customer Information Contact > > Street Address only  
CUSTOMER_USERNAME | Customer Profile > Customer Information > Account & Access > Username  
DATE | Todays date  
DATE_IN_15_DAYS | The date in 15 days  
DATE_IN_30_DAYS | The date in 30 days  
DAVINCI_LOCK_CODE | This comes from DaVinci and CANNOT be changed/edited in our software  
DAYS_BEHIND | Reports > Collections > Days behind  
DEPOSIT | Customer Profile > Rentals > Deposit Paid >>> Deposit > Deposit Charged > Amount  
DRIVERS_LICENSE_NUMBER | Customer Profile > Customer Information > Personal Information > Driver's License Number  
DRIVERS_LICENSE_STATE | Customer Profile > Customer Information > Personal Information > Driver's License State  
EMAIL_ADDRESS | Customer Profile > Customer Information > Contact > Email  
EMERGENCY_CONTACT | Customer Profile > Customer Information > Personal Information > Emergency Contact  
EMERGENCY_CONTACT_PHONE_NUMBER | Customers Profile > Customer Information Personal Information > > Emergency Contact Phone Number  
EMPLOYER_NAME | Customers Profile > Customer Information Personal Information > > Employer Name  
EMPLOYER_PHONE_NUMBER | Customer Profile > Customer Information > Personal Information > Employer Phone Number  
FACILITY_ADDRESS | Setup > Contact > Billing Address > Address  
FACILITY_CITY | Setup > Contact > Billing Address > City  
FACILITY_EMAIL | Email, Txt & Print > Settings > Email Settings > Notifications Email  
FACILITY_NAME | Setup > Contact > General > Facility Name  
FACILITY_PHONE | Setup > Contact > Billing Address > Phone  
FACILITY_PHYSICAL_ADDRESS | Setup > Contact > Physical Address > Physical Address  
FACILITY_PHYSICAL_CITY | Setup > Contact > Physical Address > Physical City  
FACILITY_PHYSICAL_STATE | Setup > Contact > Physical Address > Physical State  
FACILITY_PHYSICAL_ZIP | Setup > Contact > Physical Address > Physical Zip  
FACILITY_STATE | Setup > Contact > Billing Address > State/Province  
FACILITY_URL | Setup > Contact > General > Website Address  
FACILITY_ZIP | Setup > Contact > Billing Address > Zip/Postal Code  
GATE_KEY | Customers Profile > Rentals > Details > Gate Key  
INSURANCE_CERTIFICATE_NUMBER | Only works when StorSmart is enabled  
INSURANCE_COVERAGE_AMOUNT | Customer Profile > Rentals > Billing > Insurance >>> Active Policy > Coverage  
INSURANCE_DOCUMENT_SIGNATURE_URL | Only works when StorSmart is enabled  
INSURANCE_FACILITY_NUMBER | Only works when StorSmart is enabled; Setup > Insurance > Storsmart Settings > Facility ID  
INSURANCE_POLICY_URL | Only works when StorSmart is enabled  
INSURANCE_PREMIUM_AMOUNT | Customer Profile > Rentals > Billing > Insurance >>> Active Policy > Premium  
INSURANCE_SIGNATURE_DATE | Only works when StorSmart is enabled  
INSURANCE_START_DATE | Customer Profile > Rentals > Billing > Insurance >>> Active Policy > Start Date  
MAX_12_MONTH_PRICE |  Units > Unit Types > Edit > Max Price over First 12 Months **Note** : available for California facilities only  
NEXT_BILL_DUE | Customer Inforamtion > Rentals > Billing > Next Bill Due  
PAID_TO_DATE | Customer Profile > Rentals > Billing > Paid to Date  
PAST_DUE_BALANCE | Coming Soon! Shows the balance of all invoices that are past due  
PAST_DUE_LINE_ITEMS | Customer Profile > Billing HIstory > All unpaid, past due line items (they will show in the order they are in the Billing History)  
PREVIOUS_RENT | Customer Profile > Billing History > Last Rent Invoice amount  
PREVIOUS_RENT_DUE_ON | Customer Profile > Billing History > Last Invoice Due Date  
This will only work if there are no other invoices/fees for that unit invoiced after the rent invoice  
PREVIOUS_RENT_PLUS_TAX | Customer Profile > Billing History > Last Rent Invoice amount; it will show the tax included in the price  
PROMOTIONAL_DETAILS | Displays the Promo_beginning_date**(** calculated as the rental date plus any promotion’s configured start offset for the facility) and Promo_end_date: (calculated by adding the facility’s configured promotion duration (in billing cycles) to the Promo_beginning_date)).  
RENT | Customer Profile > Rentals > Biling  
RENT_DUE_ON | Customer Profile > Rentals > Billing > Edit >>> Next Bill Due  
This will differ from NEXT_BILL_DUE if an invoice has been billed but is not yet due.  
RENT_PLUS_TAX | Customers Profile > Rentals > Billing; it will show the tax included in the price  
RENTAL_BILLING_DAY_OF_MONTH | Customer Profile > Rentals > Billing > Next Bill Due > Day  
RENTAL_DEPOSIT_REFUND | Customer Profile > Rentals > Billing > Deposit Paid  
Adds this full verbiage, "Our records indicate that you have paid a deposit for this unit in the amount of $total deposit amount.  
After reviewing your account we will be refunding $Deposit refund amount from the original deposit paid."  
RENTAL_DEPOSIT_REFUND_AMOUNT | Customer Profile > Rentals > Billing > Deposit refund amount entered on Move out  
RENTAL_MOVE_IN_DATE | Customer Profile > Rentals > Details > Move-In Date  
RENTAL_SCHEDULED_MOVE_OUT_DATE | Customer Profile > Rentals > Move Out > Move-out Scheduled  
RENTAL_SCHEDULED_PRICE_CHANGE_DATE | Customer Profile > Rentals > Yellow Alert > View >>> Change Date  
RESERVATION_AMOUNT | Customer Profile > Billing History > Reservation Invoice  
RESERVATION_AMOUNT_PAID | Customer Profile > Billing History > Amount of the Reservation Invoice that has been marked paid  
RESERVATION_DATE | Customer Profile > Reservation > Details > Date Reserved  
RESERVATION_DESIRED_MOVE_IN_DATE | Customer Profile > Reservation > Details > Desired Move-In Date  
SCHEDULED_RENT | Customer Profile > Rentals > Yellow Alert > View >>> New Monthly Amount  
SCHEDULED_RENT_PLUS_TAX | Customer Profile > Rentals > Yellow Alert > View >>> New Monthly Amount; it will show the tax included in the price  
SETUP_FEE | Customer Profile > Rentals > Unit >>> Setup Fee Amount (this will be the row beneath the pricing options or deposit)  
SETUP_FEE_NAME | Customer Profile > Rentals > Unit >>> Setup Name (this will be the row beneath the pricing options or the deposit)  
Name varies based on what you set up in the Unit Type  
SOCIAL_SECURITY_NUMBER | Customer Profile > Customer Information > Personal Information > Social Security Number  
STORAGE_AGREEMENT_URL | Customer Profile > Rentals > Details > Storage Agreement; the link is not available to view unless the email/text is sent  
TENANT_PROTECTION_FEE | Only works when TPP is enabled; Customer Profile > Rentals > Details > Tenant Protection >>> Active Plan > Fee  
TENANT_PROTECTION_LIMIT | Only works when TPP is enabled; Customer Profile > Rentals > Details > Tenant Protection >>> Active Plan > Limit  
TENANT_PROTECTION_START_DATE | Only works when TPP is enabled; Customer Profile > Rentals > Details > Tenant Protection >>> Active Plan > Created  
TRANSACTION_EXPLANATION | Customer Profile > Billing History > Payment; Only works in the Receipt templates (Automatic & Manual)  
TRANSACTION_MESSAGE | Customer Profile > Billing History > Payment; Only works in the Receipt templates (Automatic & Manual)  
TRANSACTION_PAYMENT_AMOUNT | Customer Profile > Billing History > Payment; Only works in the Receipt templates (Automatic & Manual)  
TRANSACTION_PAYMENT_DATE | Customer Profile > Billing History > Payment; Only works in the Receipt templates (Automatic & Manual)  
UNIT | Customer Profile > Rentals > Unit  
UNIT_NOTES | Customer Profile > Rentals > Unit >>> Notes  
UNIT_SIZE | Customer Profile > Rentals > Details > Size  
UNIT_TYPE_PRICE | Customer Profile > Rentals > Unit >>> Pricing Options (whichever biling cycle the customer has for that unit)  
UNPAID_LINE_ITEMS | Customer Profile > Billing HIstory > All unpaid line items