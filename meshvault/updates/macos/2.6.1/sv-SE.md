# MeshVault 2.6.1

- Bevakade mappar i alla Server-versioner. MeshVault Server för Windows, Linux och Docker kan indexera befintliga modellmappar där de ligger. Inloggade användare kan söka i mapparna, förhandsgranska modeller som stöds och ladda ned originalfilerna. Källfilerna ligger kvar på sin plats.
- Enklare Docker-konfiguration. Öppna Options → Watched folders → Browse mounted folders och välj en mapp eller undermapp som du har monterat i Docker.
- Tydligare inställningar för huvudbiblioteket. Serverinställningarna förklarar nu var du kan importera, kopiera och ordna modeller. De beskriver också vad som händer när du väljer en befintlig mapp. En genomsökning kan flytta lösa modeller från rotmappen till `Unsorted`. Om du vill flytta biblioteket till en annan dator tar du med hela mappen, inklusive den dolda mappen `.meshvault`.
- Docker-nedladdningar för AMD64 och ARM64, inklusive kompatibla ARM64-baserade NAS-enheter.
- Du kan nu indexera SolidCraft-, Layerling- och TweakCAD-projekt i biblioteket, även i arkiv som stöds. För SolidCraft kan du få en förhandsvisning i 3D om projektet innehåller ett sparat mesh. För Layerling används den sparade miniatyrbilden till en statisk förhandsvisning. TweakCAD-dokument och -komponenter kan indexeras och sökas fram.
