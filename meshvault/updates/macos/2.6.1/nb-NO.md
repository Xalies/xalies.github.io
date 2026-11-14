# MeshVault 2.6.1

- Overvåkede mapper i alle Server-utgaver. MeshVault Server for Windows, Linux og Docker kan indeksere eksisterende modellmapper der de ligger. Innloggede brukere kan søke i mappene, forhåndsvise støttede modeller og laste ned originalfilene. Kildefilene blir liggende der de er.
- Enklere Docker-oppsett. Åpne Options → Watched folders → Browse mounted folders og velg en mappe eller undermappe du har montert i Docker.
- Tydeligere oppsett av hovedbiblioteket. Serverinnstillingene forklarer nå hvor du kan importere, kopiere og organisere modeller. Du får også vite hva som skjer når du velger en eksisterende mappe. En skanning kan flytte løse modeller fra rotmappen til `Unsorted`. Hvis du vil flytte biblioteket til en annen datamaskin, tar du med hele mappen, inkludert den skjulte `.meshvault`-mappen.
- Docker-nedlastinger for AMD64 og ARM64, inkludert kompatible ARM64-baserte NAS-enheter.
- Du kan nå indeksere SolidCraft-, Layerling- og TweakCAD-prosjekter i biblioteket, også i støttede arkiver. SolidCraft kan vise en 3D-forhåndsvisning når prosjektet inneholder et lagret 3D-nett. For Layerling brukes det lagrede miniatyrbildet til en statisk forhåndsvisning. TweakCAD-dokumenter og -komponenter kan indekseres og hentes frem.
