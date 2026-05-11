# Marketing website bootstrap upgrade

**Source:** https://storageunitsoftware.zendesk.com/hc/en-us/articles/35139469666967-Marketing-website-bootstrap-upgrade
**Article ID:** 35139469666967

---

## Marketing website bootstrap upgrade

The Storable Easy team is upgrading**** Easy Marketing websites and HTML code in website widgets to use Bootstrap v5. These infrastructure enhancements make websites more modern, responsive, and effective at converting leads into tenants.  
  
**If you’ve customized your website using complex custom CSS, your site’s appearance or functionality may be affected depending on how the CSS was implemented.**

We recommend reviewing your code with the original CSS implementer and following the instructions below to ensure widgets work as expected once we enable this new feature.

1\. Open two browser windows. 2\. Navigate to **Website** > **Pages** in your Easy software in both windows.  | ![](https://storageunitsoftware.zendesk.com/hc/article_attachments/35139469634455)  
---|---  
3\. Click the **View** link to view the same page in both windows. ![](https://storageunitsoftware.zendesk.com/hc/article_attachments/35139462241687) 4\. In the first window, add ?bootstrap=3 to the end of the URL to preview it as the old version. 5\. In the second window, add ?bootstrap=5 to the end of the URL to preview it as the new version. 6\. Note any widget content that is behaving abnormally. Pay special attention to widgets that contain images, panels, glyphicons, arrows, checkboxes, dividers, or an image carousel. 7\. If you find a widget that behaves differently in Bootstrap 5 than in its old version, it’s likely that the widget will require manual adjustments to the HTML code.  
8\. Navigate back to _Pages_ and click **edit** to edit the page. ![](https://storageunitsoftware.zendesk.com/hc/article_attachments/35139462243479)  
9\. Find the widget that needs to be updated in the _Current Widgets_ list. 10\. Click **Edit** next to the widget.   
| ![](https://storageunitsoftware.zendesk.com/hc/article_attachments/35139469641751)  
11\. Find the section with the broken content.  
12\. In the _Content_ section, click the HTML button to show the content as HTML code. | ![](https://storageunitsoftware.zendesk.com/hc/article_attachments/35139462249623)  
13\. Copy the code into a text editor to make changes more easily. 14\. Review the CSS classes in the code and convert them according to the guidelines below.  15\. Paste the updated code into the HTML editor in Easy.  16\. Click **Update Widget** to save the changes. ![](https://storageunitsoftware.zendesk.com/hc/article_attachments/35139462252695) 17\. Preview the changes to compare the old and new versions using steps 1-5.  
  
For more information on Bootstrap 5, [refer to this documentation](https://getbootstrap.com/docs/5.0/getting-started/introduction/).

## Bootstrap 5 CSS Class Conversion

**Bootstrap 3** | **Bootstrap 5**  
---|---  
btn-block | w-100  
center-block | mx-auto  
dropdown-menu-right | dropdown-menu-end  
form-group | mb-3  
hidden | d-none  
img-responsive | img-fluid  
in | show  
media | d-flex  
media-body | flex-grow-1  
media-left | flex-shrink-0  
media-middle | align-self-center  
navbar-header | Remove (No longer needed)  
page-header | border-bottom pb-2 mb-3  
pull-left | float-start  
pull-right | float-end  
well | p-3 mb-2 bg-light rounded  
glyphicon, glyphicon-ok | No longer available: This needs to be replaced with Bootstrap Icons, Font Awesome, or other icon libraries.  
col-xs (with any number) |  No longer uses xs classes. Remove xs like this example:
    
    
    <!-- Bootstrap 3 -->
    <div class="col-xs-12"></div>
    <!-- Bootstrap 5 -->
    <div class="col-12"></div>  
  
col-sm-offset-0 (any size with an offset) | Drop the col from the class like offset-sm-0  
col-sm-push-6 | order-sm-1, order-sm-2 The numbers represent order instead of columns.  
panel | card  
panel-body | card-body  
panel-heading | card-header  
panel-title | card-title (on a header tag like h5)  
panel-group |  accordion  Requires restructuring, like in this example:
    
    
    <!-- Bootstrap 3 -->
    <div class="panel-group" id="accordion">
      <div class="panel panel-default">
        <div class="panel-heading">
          <h4 class="panel-title">
            <a data-toggle="collapse" data-parent="#accordion" href="#collapseOne">
              Collapsible Group Item #1
            </a>
          </h4>
        </div>
        <div id="collapseOne" class="panel-collapse collapse in">
          <div class="panel-body">Content</div>
        </div>
      </div>
    </div>
    <!-- Bootstrap 5 -->
    <div class="accordion" id="accordionExample">
      <div class="accordion-item">
        <h2 class="accordion-header" id="headingOne">
          <button class="accordion-button" type="button" data-bs-toggle="collapse" 
                  data-bs-target="#collapseOne" aria-expanded="true" 
                  aria-controls="collapseOne">
            Collapsible Group Item #1
          </button>
        </h2>
        <div id="collapseOne" class="accordion-collapse collapse show" 
             aria-labelledby="headingOne" data-bs-parent="#accordionExample">
          <div class="accordion-body">
            Content
          </div>
        </div>
      </div>
    </div>  
  
carousel-control | Replaced with carousel-control-prev and carousel-control-next  
checkbox |  form-check  Requires restructuring, like in this example:
    
    
    <!-- Bootstrap 3 -->
    <div class="checkbox">
      <label>
        <input type="checkbox"> Option 1
      </label>
    </div>
    
     
    <!-- Bootstrap 5 -->
    <div class="form-check">
      <input class="form-check-input" type="checkbox" value="" id="option1">
      <label class="form-check-label" for="option1">
        Option 1
      </label>
    </div>