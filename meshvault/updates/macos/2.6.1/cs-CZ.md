# MeshVault 2.6.1

- Sledované složky ve všech verzích serveru. Servery pro Windows, Linux i Docker dokážou indexovat stávající složky s modely přímo na místě. Přihlášení uživatelé v nich mohou vyhledávat, zobrazovat náhledy podporovaných modelů a stahovat originály. Zdrojové soubory zůstávají na svém místě.
- Snazší nastavení Dockeru. V nabídce Options → Watched folders → Browse mounted folders vyberte složku nebo podsložku, kterou jste připojili k Dockeru.
- Přehlednější nastavení hlavní knihovny. Nastavení serveru nyní vysvětluje, kam modely importovat a kopírovat a jak je uspořádat. Dozvíte se také, co se stane při výběru existující složky. Při prohledávání se mohou modely uložené přímo v kořenové složce přesunout do `Unsorted`. Při přesunu knihovny na jiný počítač přeneste celou složku včetně skryté složky `.meshvault`.
- Docker ke stažení pro AMD64 a ARM64, včetně kompatibilních zařízení NAS s architekturou ARM64.
- Knihovna nyní může indexovat projekty SolidCraft, Layerling a TweakCAD, a to i v podporovaných archivech. SolidCraft umožňuje zobrazit 3D náhled, pokud projekt obsahuje uloženou síť. Layerling používá uloženou miniaturu jako statický náhled. Dokumenty a součásti TweakCAD lze indexovat a později vyhledat.
