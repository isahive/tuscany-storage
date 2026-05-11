# How to Enter & Display Maximum Rent and the Duration of Promotions and Discounts on Leases

**Source:** https://storageunitsoftware.zendesk.com/hc/en-us/articles/37034171729047-How-to-Enter-Display-Maximum-Rent-and-the-Duration-of-Promotions-and-Discounts-on-Leases
**Article ID:** 37034171729047

---

To provide your tenants with optimal transparency, you can display the following information on rental leases: 

  * The Maximum Rental Rate that you would potentially charge for this unit in the first year
  * Duration of Promotional or Discounted Rates



### Setting the Maximum Rental Rate

You can set the “Max Price Over First 12 Months” at the Unit Group level when [creating or editing a unit type](https://storageunitsoftware.zendesk.com/hc/en-us/articles/13791187010327-How-do-I-create-or-edit-a-Unit-Type). Please note that the system will not prevent you from exceeding the maximum rate when later adjusting the unit type’s rate.

![](https://storageunitsoftware.zendesk.com/hc/article_attachments/37034196267543)

**Please note:** This field will only be accessible to facilities with a physical address in California and to users with the Owner or Manager role.

### Displaying the Maximum Rental Rate

When you [create or edit your lease](https://storageunitsoftware.zendesk.com/hc/en-us/articles/14504625404951-How-do-I-upload-or-edit-my-lease-agreement), you can use the [**[MAX_12_MONTH_PRICE]]** placeholder to display the maximum rate entered for the unit.

![](https://storageunitsoftware.zendesk.com/hc/article_attachments/37034196268439)

### Displaying Duration of Promotional or Discounted Rates

When you [create or edit your lease](https://storageunitsoftware.zendesk.com/hc/en-us/articles/14504625404951-How-do-I-upload-or-edit-my-lease-agreement), you can use the **[[PROMOTIONAL_DETAILS]]** placeholder to display promotional or discount information, which will display as: **Promo_type promo_amount beginning promo_beginning_date until promo_end_date**

  * **Promo_beginning_date:** Calculated as the rental date plus any promotion’s configured start offset for the facility.
  * **Promo_end_date:** Calculated by adding the facility’s configured promotion duration (in billing cycles) to the Promo_beginning_date.
  * If “This promotion should never expire” is selected in the manager backend, the text “until promo_end_date” will be replaced with “and lasting indefinitely.”



![](https://storageunitsoftware.zendesk.com/hc/article_attachments/37034171723287)

For more information on placeholders, please refer to our help articles [Default Template Placeholder Definitions](https://storageunitsoftware.zendesk.com/hc/en-us/articles/18056804817943-Default-Template-Placeholder-Definitions) and [Using Placeholders](https://storageunitsoftware.zendesk.com/hc/en-us/articles/18031379586071-Using-placeholders).