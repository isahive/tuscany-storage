# How do I create a unit?

**Source:** https://storageunitsoftware.zendesk.com/hc/en-us/articles/14873188711447-How-do-I-create-a-unit
**Article ID:** 14873188711447

---

You can create units one at a time or you can create them in bulk.

## Create individual units

1\. Hover your mouse over the _Units_ dropdown and click **New Unit**.  
  
![](https://d33v4339jhl8k0.cloudfront.net/docs/assets/5a0382240428633199244fa0/images/641dbc609a0fe82b2d574f8f/file-dExvuzRRnR.png)

2\. Fill in the unit name, size, and the status of the unit. 

**Name**

A unique name or number for this unit. _For Example_ , “A1”, “B912”, or “Parking Space 11”.

Although this field will allow you to add symbols, please consider that symbols in the unit name can have a negative effect on the syncing of automatic gate systems. Our recommendation is to keep it simple and use letters and numbers only.

**Gate Key**

The gate key field is for 3rd party gate system (our Cloud Access control uses one code connected to the tenant account, not a code connected to each unit.) Any Gate Keys typed in this field will be connected to the unit, and waiting to be used by the next active tenant. That codes will not be available to use at the keypad until the unit is in _Rented_ status. This is the gate key that shows up in the [[GATE_KEY]] Placeholder when used in templates.

**Unit Type**

The unit size and price are pulled from these fields. If the unit type you want to assign to this unit does not yet exist, see our article about [how to create a unit type](https://storageunitsoftware.zendesk.com/hc/en-us/articles/13791187010327-How-do-I-create-a-Unit-Type-) _._

**Notes**

Enter any notes for managerial use here. These notes should pertain to the unit (not the tenant) and can only be seen by manager and admin users.

**Status**

When creating the unit, you can mark the unit as _Available or Unavailable._

**Available** : The unit is ready to rent or connect existing customers to.

**Unavailable** _**:**_ The unit cannot by rented or assigned to a customer by a manager or online. If you are in the process of connecting existing rentals to our software for the first time, we recommend leaving your units in _Available_ status.

3\. Once you have filled in the unit details, click **Save** . Once saved, the unit will be visible under _Units > List View_, and available to be added to the site map layout under  _Units > Site Map_.

## ****

## Create units in bulk

1\. Hover your mouse over the _Units_ dropdown and click **Create Multiple Units.**

![](https://d33v4339jhl8k0.cloudfront.net/docs/assets/5a0382240428633199244fa0/images/641dbc904627a93f4d0e7914/file-pEEH3aEmsJ.png)

2\. Fill in the unit name range, size, and the status of the units.  
  
**Names**

Use a range of numbers or letters and numbers. Symbols cannot be used in the unit names.

_Example:_ Unit Names “1” and “A1” would be acceptable formats but “A-1” would not be.   
  
To create our range, we use  _dashes_ to create a run of units, and  _commas_ to skip units that we don’t want included in the current run.  
_For example:_ If you enter “1-5, 10-15, 20-25” into the names field, the software would create units 1, 2, 3, 4, 5, 10, 11, 12, 13, 14, 15, 20, 21, 22, 23, 24, 25. Notice that units 6-9 and 16-19 are not included in this range. This allows you to include them in a range for another Unit Type or to create those units individually.  
  
If you want to name your units with a Letter and Number format, simply put a letter before the first number in your run.  
_For example:_ If you enter “A1-5, B10-15, C20-25” into my names field, the software would create units A1, A2, A3, A4, A5, B10, B11, B12, B13, B14, B15, C20, C21, C22, C23, C24, C25”  
  
**Unit Type**

You can only create one unit type at a time. Using this tool, you can create all of your 5 by 10 units in one step, and all of your 10 by 10 units in another, and so on. This is where the ranges mentioned above can come in handy.  
  
**Status**

When creating the unit, you can mark the unit as _Available or Unavailable._

**Available** : The unit is ready to rent or connect existing customers to.

**Unavailable** _**:**_ The unit cannot by rented or assigned to a customer by a manager or online. If you are in the process of connecting existing rentals to our software for the first time, we recommend leaving your units in _Available_ status.

3\. Once you have filled in the unit details, click **Preview**. This will show you a summary of all of the units that are waiting to be created. Please review the size and unit numbers during the step to avoid needing to make individual edits down the road.

4\. If everything looks correct, click **Save**. Once saved, units will be visible under  _Units > List View_, and available to be added to the site map layout under  _Units > Site Map_.