# MeshVault 2.6.1

- Pastas monitoradas em todas as versões do Server. O MeshVault Server para Windows, Linux e Docker pode indexar pastas de modelos existentes onde elas já estão. Usuários conectados podem pesquisar nessas pastas, visualizar modelos compatíveis e baixar os arquivos originais. Os arquivos de origem permanecem no local.
- Configuração mais simples no Docker. Abra Options → Watched folders → Browse mounted folders e escolha uma pasta ou subpasta que você montou no Docker.
- Configuração mais clara da biblioteca principal. As configurações do servidor agora explicam onde importar, copiar e organizar modelos. Elas também mostram o que acontece ao escolher uma pasta existente, inclusive que uma verificação pode mover modelos soltos na raiz para `Unsorted`. Para transferir a biblioteca para outro computador, leve a pasta inteira, incluindo a pasta oculta `.meshvault`.
- Downloads do Docker para AMD64 e ARM64, inclusive para dispositivos NAS compatíveis com ARM64.
- Agora você pode indexar projetos do SolidCraft, Layerling e TweakCAD na biblioteca, inclusive dentro de arquivos compactados compatíveis. Projetos do SolidCraft com uma malha salva podem ser visualizados em 3D. O Layerling usa a miniatura salva para a visualização estática. Documentos e componentes do TweakCAD podem ser indexados e localizados.
