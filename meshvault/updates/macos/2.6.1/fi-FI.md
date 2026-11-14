# MeshVault 2.6.1

- Seuratut kansiot kaikissa palvelinversioissa. Windows-, Linux- ja Docker-palvelimet voivat indeksoida olemassa olevat mallikansiot niiden nykyisessä sijainnissa. Kirjautuneet käyttäjät voivat tehdä hakuja kansioissa, esikatsella tuettuja malleja ja ladata alkuperäiset tiedostot. Lähdetiedostot pysyvät paikoillaan.
- Helpompi Dockerin käyttöönotto. Avaa Options → Watched folders → Browse mounted folders ja valitse Dockeriin liittämäsi kansio tai alikansio.
- Selkeämmät pääkirjaston asetukset. Palvelimen asetuksissa kerrotaan nyt, minne mallit voi tuoda ja kopioida ja miten niitä voi järjestellä. Niissä kerrotaan myös, mitä tapahtuu, kun valitset olemassa olevan kansion. Tarkistus voi siirtää suoraan juurikansiossa olevat mallit `Unsorted`-kansioon. Jos siirrät kirjaston toiselle tietokoneelle, ota mukaan koko kansio ja sen piilotettu `.meshvault`-kansio.
- Docker-lataukset AMD64- ja ARM64-laitteille, mukaan lukien yhteensopivat ARM64-NAS-laitteet.
- Kirjasto osaa nyt indeksoida SolidCraft-, Layerling- ja TweakCAD-projekteja myös tuetuista arkistoista. SolidCraft-projektista voi näyttää 3D-esikatselun, jos siihen on tallennettu monikulmioverkko. Layerlingin tallennettu pienoiskuva toimii staattisena esikatseluna. TweakCAD-asiakirjat ja -komponentit voi indeksoida ja hakea kirjastosta.
