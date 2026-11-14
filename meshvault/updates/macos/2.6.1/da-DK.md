# MeshVault 2.6.1

- Overvågede mapper i alle serverudgaver. Servere til Windows, Linux og Docker kan indeksere eksisterende modelmapper dér, hvor de ligger. Brugere, der er logget ind, kan søge i mapperne, se forhåndsvisninger af understøttede modeller og downloade originalerne. Kildefilerne bliver, hvor de er.
- Nemmere opsætning af Docker. Åbn Options → Watched folders → Browse mounted folders for at vælge en mappe eller undermappe, du har monteret i Docker.
- Tydeligere opsætning af hovedbiblioteket. Serverindstillingerne forklarer nu, hvor du kan importere og kopiere modeller, og hvordan du kan organisere dem. De forklarer også, hvad der sker, når du vælger en eksisterende mappe. En scanning kan flytte modeller, der ligger direkte i rodmappen, til `Unsorted`. Hvis du flytter biblioteket til en anden computer, skal du tage hele mappen med, inklusive den skjulte mappe `.meshvault`.
- Docker-downloads til AMD64 og ARM64, herunder kompatible ARM64-baserede NAS-enheder.
- Biblioteket kan nu indeksere SolidCraft-, Layerling- og TweakCAD-projekter, også i understøttede arkiver. SolidCraft kan vise en 3D-forhåndsvisning, når projektet indeholder et gemt polygonnet. Layerling bruger sit gemte miniaturebillede til en statisk forhåndsvisning. TweakCAD-dokumenter og -komponenter kan indekseres og findes igen.
