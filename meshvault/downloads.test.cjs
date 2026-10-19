const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const appImageLink = html.match(/<a\b[^>]*id="linux-appimage-download"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/);
assert.ok(appImageLink, "The Linux download card needs an AppImage link");
assert.equal(appImageLink[2], "Linux .AppImage");
const debLink = html.match(/href="([^"]+\/MeshVault-linux-x64-setup\.deb)"/)[1];
const release = debLink.match(/\/download\/(v[\d.]+)\//)[1];
assert.equal(appImageLink[1], debLink.replace("MeshVault-linux-x64-setup.deb",
    `MeshVault-linux-x64-${release.slice(1)}.AppImage`));

function runPage(source, userAgent) {
    const appImageUrl = source.match(/id="linux-appimage-download"[^>]*href="([^"]+)"/)[1];
    const elements = new Map();
    const document = {
        body: { classList: { add() {} } },
        getElementById(id) {
            if (!elements.has(id)) elements.set(id, {
                hidden: id.startsWith("hero-download-"),
                href: id === "linux-appimage-download" ? appImageUrl : "",
                removeAttribute() {},
            });
            return elements.get(id);
        },
        querySelectorAll() { return []; },
        querySelector() { return null; },
    };
    const script = [...source.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
    vm.runInNewContext(script, { document, navigator: { userAgent }, location: { hash: "" }, window: {} });
    return elements;
}

const linux = runPage(html, "Mozilla/5.0 (X11; Linux x86_64)");
assert.equal(linux.get("hero-download-title").textContent, "Download MeshVault for Linux");
assert.equal(linux.get("hero-download-primary").href, debLink);
assert.equal(linux.get("hero-download-secondary").href, appImageLink[1]);
assert.equal(linux.get("hero-download-secondary").textContent, "Download .AppImage");
assert.equal(linux.get("hero-download-secondary").hidden, false);
assert.equal(linux.get("hero-download-tertiary").hidden, true);

// Release updates to the static AppImage link must also reach the Linux recommendation.
const nextAppImage = appImageLink[1].replaceAll(release, "v9.8.7.6").replace(`-${release.slice(1)}.AppImage`, "-9.8.7.6.AppImage");
assert.equal(runPage(html.replace(appImageLink[1], nextAppImage), "Linux x86_64")
    .get("hero-download-secondary").href, nextAppImage);
const windows = runPage(html, "Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
assert.equal(windows.get("hero-download-title").textContent, "Download MeshVault for Windows");
assert.ok(windows.get("hero-download-secondary").href.endsWith("MeshVault-win-x64-setup.exe"));
console.log("MeshVault download recommendations passed");
