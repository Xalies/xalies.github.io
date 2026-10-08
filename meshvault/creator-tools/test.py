"""Run: python meshvault/creator-tools/test.py"""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote

site = Path(__file__).resolve().parents[1]
repo = site.parent
names = ['gridfinity', 'vessels', 'assembly', 'brackets', 'pocket-eden', 'brick-foundry']
class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []
    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if key in ('href', 'src') and value:
                self.urls.append(value)

for relative in ['creator-tools/index.html', 'generator/index.html'] + [f'generators/{name}/index.html' for name in names]:
    page = site / relative
    parser = Links()
    parser.feed(page.read_text(encoding='utf-8'))
    for value in parser.urls:
        url = urlsplit(value)
        if url.scheme or url.netloc or not url.path:
            continue
        path = (site / unquote(url.path.lstrip('/')) if url.path.startswith('/') else page.parent / unquote(url.path)).resolve()
        assert path.is_relative_to(site) and path.exists(), (relative, value)
for name in names:
    old = (repo / f'generators/{name}/index.html').read_text(encoding='utf-8')
    assert f'https://www.meshvault.app/generators/{name}/' in old
    assert 'location.search+location.hash' in old
    assert (site / f'generators/{name}/index.html').stat().st_size > 1000
hub = (site / 'creator-tools/index.html').read_text(encoding='utf-8')
assert hub.count('class="tool"') == len(names)
assert 'creator-tools/' in (site / 'index.html').read_text(encoding='utf-8')
assert 'https://www.meshvault.app/creator-tools/' in (repo / 'index.html').read_text(encoding='utf-8')
assert 'rsync -a --delete' in (repo / '.github/workflows/publish-meshvault-site.yml').read_text(encoding='utf-8')
print('PASS: six tools, published-root assets and links, portfolio link and legacy redirects.')
