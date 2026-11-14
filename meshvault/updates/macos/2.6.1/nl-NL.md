# MeshVault 2.6.1

- Bewaakte mappen in elke Server-versie. MeshVault Server voor Windows, Linux en Docker kan bestaande modelmappen op hun huidige locatie indexeren. Aangemelde gebruikers kunnen erin zoeken, ondersteunde modellen bekijken en originele bestanden downloaden. De bronbestanden blijven op hun huidige locatie.
- Eenvoudigere Docker-configuratie. Open Options → Watched folders → Browse mounted folders en kies een map of submap die je in Docker hebt gekoppeld.
- Duidelijkere instellingen voor de hoofdbibliotheek. De serverinstellingen leggen nu uit waar je modellen kunt importeren, kopiëren en ordenen. Je ziet ook wat er gebeurt als je een bestaande map kiest. Bij een scan kunnen losse modellen uit de hoofdmap naar `Unsorted` worden verplaatst. Wil je je bibliotheek naar een andere computer verplaatsen, neem dan de hele map mee, inclusief de verborgen map `.meshvault`.
- Docker-downloads voor AMD64 en ARM64, ook voor compatibele ARM64-NAS-apparaten.
- Je kunt nu SolidCraft-, Layerling- en TweakCAD-projecten in je bibliotheek indexeren, ook in ondersteunde archieven. Voor SolidCraft is een 3D-voorbeeld beschikbaar als het project een opgeslagen mesh bevat. Voor een statisch voorbeeld van Layerling gebruikt MeshVault de opgeslagen miniatuur. Je kunt documenten en onderdelen van TweakCAD indexeren en terugvinden.
