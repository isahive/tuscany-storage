"""Bulk fetch Storable Easy help center articles and save as markdown."""
import json
import re
import urllib.request
from pathlib import Path
import html2text

BASE = "https://storageunitsoftware.zendesk.com/api/v2/help_center/en-us/articles"
OUT = Path(__file__).parent

ARTICLES = {
    "website-portal": [
        (35139469666967, "Marketing website bootstrap upgrade"),
        (26932074985111, "ADA compliance"),
        (26928519806103, "Enhancing your website"),
        (19152848770583, "Tenant portal overview"),
        (19122891923479, "How do I allow tenants to select the unit number they want online"),
        (19122310397719, "SEO and Google Ranking"),
        (18090220685079, "How do I change the colors on my website"),
        (18089192134551, "How do I change the office hours on my website"),
        (18089076163223, "How do I change the logo on my website"),
        (18089003561495, "Website basics"),
        (18082789513367, "How do I create a blog article on my website"),
        (18082396001431, "How do I edit the content on the Rent Storage page"),
        (18079609880727, "How do I edit the map page on my website"),
        (18079278219671, "How do I edit the facility address shown on my website map"),
        (18078801133079, "Website images"),
        (18061475825815, "How do I add multiple location site maps to my website"),
        (18061338182423, "How do I edit the Contact Us tab of my website"),
        (18061194120471, "How do I change my website homepage picture"),
        (17804425902359, "How do I change the questions the customers have to answer when they sign up online"),
        (17631129755159, "How do I enable online move-ins"),
        (17630131499543, "How does a customer rent online"),
        (17630001757719, "How do I enable online reservations"),
        (17720204367639, "How do I create a login for a tenant"),
        (17630459947159, "How does a customer log into their customer portal"),
        (15697366328087, "How can a tenant reset their password"),
        (19152986697239, "How does my customer make a payment online"),
        (19153236790295, "How does my customer print an account history"),
        (19153111906711, "How does my customer print a receipt online"),
        (19153062151703, "How does my customer change their login information"),
        (19130189097495, "How do my customers enter their billing information for recurring billing"),
        (19122777782295, "Why cant my customer or I log in"),
    ],
    "insurance": [
        (13820878515095, "Tenant Protection Plan Auto-Protect"),
        (13820685823383, "Tenant Protection Plan How to submit a claim"),
        (13820627039511, "Tenant Protection Plan How do I add a protection plan to a tenants account"),
        (13790574072471, "Tenant Protection Overview"),
    ],
    "access-control": [
        (14014734450071, "Access Control Quick Setup Guide"),
        (14014580130071, "Access Control Gate Group Setup"),
        (14014089821975, "Assigning Gate Keys Access Codes to tenants"),
        (14012079584279, "Access Control Enable Text to Open"),
        (14011565230999, "Access Control Open Close Command"),
        (14010948711191, "Gate Activity Log"),
        (14010813390743, "Storable Access Control FAQ"),
    ],
}


def slugify(text):
    text = re.sub(r"[^\w\s-]", "", text).strip().lower()
    return re.sub(r"[-\s]+", "-", text)[:80]


h = html2text.HTML2Text()
h.body_width = 0
h.ignore_images = False
h.ignore_links = False

manifest = []

for folder, items in ARTICLES.items():
    out_dir = OUT / folder
    out_dir.mkdir(exist_ok=True)
    for art_id, title in items:
        url = f"{BASE}/{art_id}.json"
        try:
            with urllib.request.urlopen(url, timeout=30) as resp:
                data = json.load(resp)
        except Exception as e:
            print(f"FAIL {art_id}: {e}")
            continue
        article = data.get("article", {})
        real_title = article.get("title", title)
        html_url = article.get("html_url", "")
        body_html = article.get("body", "") or ""
        body_md = h.handle(body_html).strip()

        slug = slugify(real_title)
        out_file = out_dir / f"{slug}.md"
        front = f"# {real_title}\n\n**Source:** {html_url}\n**Article ID:** {art_id}\n\n---\n\n"
        out_file.write_text(front + body_md, encoding="utf-8")
        manifest.append((folder, art_id, real_title, str(out_file.relative_to(OUT))))
        print(f"OK {folder}/{slug}.md")

print(f"\nTotal saved: {len(manifest)}")
(OUT / "_manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
