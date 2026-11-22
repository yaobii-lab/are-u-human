"""Build two static document roots: python3 deploy/build.py OUTPUT UMAMI_WEBSITE_ID."""
import argparse
import shutil
from pathlib import Path
from uuid import UUID

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("output", type=Path, help="new directory for the release")
parser.add_argument("website_id", type=UUID)
args = parser.parse_args()
source = Path(__file__).resolve().parents[1]
args.output.mkdir(parents=True, exist_ok=False)

tracker = f"""<script>
if (window.self === window.top) {{
  const tracker = document.createElement('script');
  tracker.src = 'https://analytics.yaobii.com/script.js';
  tracker.dataset.domains = 'ariari.art,portal.ariari.art';
  tracker.dataset.websiteId = '{args.website_id}';
  document.head.appendChild(tracker);
}}
</script>"""
groups = {
    "ariari.art": ["index.html", "forum.html"],
    "portal.ariari.art": ["start.html", "face.html", "stage2.html", "stage3.html", "jury.html", "pass.html", "credits.html"],
}
for host, pages in groups.items():
    root = args.output / host
    root.mkdir()
    for asset in (source / "assets").rglob("*"):
        portal_font_asset = (source / "assets/fonts/portal") in asset.parents
        if asset.is_file() and (portal_font_asset or asset.suffix.lower() in {".png", ".jpg", ".svg", ".gif", ".webp", ".jpeg", ".avif", ".woff", ".woff2", ".ttf"}):
            dest = root / asset.relative_to(source)
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(asset, dest)
    for name in ["visitor.js", "flow.js", "i18n.js", "gate.css", "tokens.css", "bloom.js"]:
        shutil.copyfile(source / name, root / name)
    shutil.copytree(source / "i18n", root / "i18n")
    for name in pages:
        if name == "credits.html":
            soundtrack = Path("assets/audio/credits.mp3")
            (root / soundtrack.parent).mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source / soundtrack, root / soundtrack)
        page = (source / name).read_text().replace("</head>", tracker + "\n</head>", 1)
        page = page.replace('href="start.html"', 'href="https://portal.ariari.art/"')
        page = page.replace('data-background-page="index.html"', 'data-background-page="https://ariari.art/"')
        (root / ("index.html" if name == "start.html" else name)).write_text(page)
