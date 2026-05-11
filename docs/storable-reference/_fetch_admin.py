"""Bulk fetch admin-side Storable docs (behaviors, settings, automations)."""
import json
import re
import urllib.request
from pathlib import Path
import html2text

BASE = "https://storageunitsoftware.zendesk.com/api/v2/help_center/en-us/articles"
OUT = Path(__file__).parent

# Filtered: removed SSO, Storable/Easy Payments specifics, Canadian processing,
# PCI vendor setup, mass text TOS, hardware/swipers, internal admin nav fluff.
ARTICLES = {
    "settings": [
        34490713466647, 33175596636311, 18058709671447, 18029174245655,
        15341355272343, 14875582496151, 14509987325079, 14509065280535,
        14508690226583, 14508473525271, 14508183168023, 14504625404951,
        14503789578263, 14502868969367, 14502628172951, 14501720951191,
        14499863473815, 14153528683927, 14150546685591, 13821865892631,
        19153561847319, 14497705972503, 18057297323159, 17630735534743,
        17628024737687, 16792867712791, 14507691434775,
    ],
    "units-admin": [
        33330447209879, 20470433795863, 20037890362519, 14879185850135,
        14878567671319, 14878175728791, 14873188711447, 14871969658647,
        14871323007255, 13792237109911, 13791187010327,
    ],
    "tenants-admin": [
        32213618579351, 20870529495575, 20869149745431, 19156476564503,
        18029213479063, 18028976404759, 17806644746519, 17720094554775,
        17719957723671, 17629530526103, 17629203013655, 17628650406295,
        16793494017431, 15694613316119, 15486895640599, 15485351360023,
        15480978718487, 15456761911831, 15454090162327, 15453815149847,
        15344051615511, 15115239609111, 15113947246743, 15005022431255,
    ],
    "billing-admin": [
        14507255594647, 14500728364055, 14500439732119, 17975765764887,
        17805854258967, 17805025703703, 17804068482967, 17803736995479,
        16794289278103, 16794113309207, 15694061277719, 15486009551127,
        15485093209879, 15483432641687, 22685906158999, 34217142907415,
        20649790731671, 18023280628503, 18022954922647, 13787399817751,
    ],
    "reports": [
        17976813802263, 18027331026711, 18027392560279, 18027582506263,
        18027734602775, 18027946762519, 18027980227223, 18028078519063,
        18028197258007, 18028323674135, 18028561286935, 18028665363863,
        18029394597783, 18029590753687, 18030260608919, 18030332081815,
        18023851036439, 29722162076695,
    ],
    "documents-communications": [
        20442565158423, 20061697455639, 19152785464983, 19129966809239,
        18060446977687, 18059036858007, 18058822026647, 18056804817943,
        18034169745303, 18033825396759, 18033139951767, 18032140758423,
        18031786050583, 18031379586071, 18031042253591, 16793941386007,
        15696482048535, 15486142993687, 15481771360791, 15481495584919,
        15456542423831,
    ],
    "rate-management": [
        37034171729047, 14496570370839, 20064249790615, 15693887456663,
        15115877748759,
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
total = 0

for folder, ids in ARTICLES.items():
    out_dir = OUT / folder
    out_dir.mkdir(exist_ok=True)
    for art_id in ids:
        url = f"{BASE}/{art_id}.json"
        try:
            with urllib.request.urlopen(url, timeout=30) as resp:
                data = json.load(resp)
        except Exception as e:
            print(f"FAIL {art_id}: {e}")
            continue
        article = data.get("article", {})
        title = article.get("title", str(art_id))
        html_url = article.get("html_url", "")
        body_html = article.get("body", "") or ""
        body_md = h.handle(body_html).strip()

        slug = slugify(title)
        out_file = out_dir / f"{slug}.md"
        front = f"# {title}\n\n**Source:** {html_url}\n**Article ID:** {art_id}\n\n---\n\n"
        out_file.write_text(front + body_md, encoding="utf-8")
        manifest.append((folder, art_id, title, str(out_file.relative_to(OUT))))
        total += 1
        print(f"OK {folder}/{slug}.md")

print(f"\nTotal saved: {total}")
existing = []
mf = OUT / "_manifest.json"
if mf.exists():
    existing = json.loads(mf.read_text(encoding="utf-8"))
combined = existing + manifest
mf.write_text(json.dumps(combined, indent=2), encoding="utf-8")
print(f"Manifest has {len(combined)} total entries")
