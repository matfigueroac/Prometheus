"""Check local navigation and asset references in this static wiki."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]


class Page(HTMLParser):
    def __init__(self, path):
        super().__init__()
        self.ids = set()
        self.links = []
        self.feed(path.read_text(encoding="utf-8"))
        self.close()

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if attrs.get("id"):
            self.ids.add(attrs["id"])
        for key in ("href", "src"):
            if attrs.get(key):
                self.links.append((self.getpos()[0], attrs[key]))
        for entry in attrs.get("srcset", "").split(","):
            if entry.strip():
                self.links.append((self.getpos()[0], entry.split()[0]))


def main():
    pages = {path: Page(path) for path in ROOT.glob("*.html")}
    issues = []
    count = 0
    for path, page in pages.items():
        for line, href in page.links:
            url = urlsplit(href)
            if url.scheme or url.netloc:
                continue
            count += 1
            destination = unquote(url.path)
            if destination.startswith("/"):
                target = ROOT / destination.lstrip("/")
            else:
                target = (path.parent / destination).resolve() if destination else path
            if not target.is_file():
                issues.append(f"{path.name}:{line}: missing file {href}")
            elif url.fragment and target in pages and unquote(url.fragment) not in pages[target].ids:
                issues.append(f"{path.name}:{line}: missing section {href}")
    if issues:
        raise SystemExit("\n".join(issues))
    print(f"Checked {count} local references across {len(pages)} pages.")


if __name__ == "__main__":
    main()
