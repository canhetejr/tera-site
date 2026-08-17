# Changelog

Todas as mudanças notáveis deste projeto são documentadas neste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o versionamento segue [SemVer](https://semver.org/lang/pt-BR/). Como o site não tinha releases nem tags antes desta entrada, as versões abaixo foram reconstruídas a partir do histórico real de commits e pull requests do repositório — cada uma corresponde a um marco identificável no `git log`, não a uma numeração inventada.

## [Não lançado]

### Adicionado
- Documentação do projeto: `README.md`, `CONTRIBUTING.md`, `docs/architecture.md` e este `CHANGELOG.md`.

### Corrigido
- `.gitignore` ampliado para cobrir arquivos comuns de SO (`.DS_Store`, `Thumbs.db`) e de editor (`.vscode/`, `.idea/`, arquivos de swap), além de `.env*` como prevenção — o projeto não usa variáveis de ambiente hoje, mas nunca deve versionar segredos.

## [0.6.5] — 2026-08-16
### Corrigido
- Contato por WhatsApp, cópia do briefing para o próprio lead e opção de falar diretamente com a equipe. (#12)

## [0.6.4] — 2026-08-15
### Modificado
- Pano de fundo animado do briefing pausa quando a aba não está visível, reduzindo consumo de recursos. (#11)

## [0.6.3] — 2026-08-15
### Corrigido
- Auditoria fina de acessibilidade e consistência visual: fonte da marca, contraste e robustez geral do briefing. (#10)

## [0.6.2] — 2026-08-15
### Corrigido
- Auditoria de SEO: configuração de domínio, favicons, hierarquia de `H1`, `sitemap.xml` e `robots.txt`. (#9)

## [0.6.1] — 2026-08-15
### Corrigido
- Formatação das respostas no chat da Tera AI, exportação do briefing em PDF e prompt do agente mais conciso. (#8)

## [0.6.0] — 2026-08-15
### Modificado
- O formulário estático de briefing foi substituído por um wizard em checklist com refinamento opcional por IA (Tera AI). (#7)

## [0.5.1] — 2026-08-15
### Corrigido
- Botão de fechar do painel de navegação mobile.
### Modificado
- Ícone do botão de menu substituído por um rótulo na linguagem do site. (#6)

## [0.5.0] — 2026-08-15
### Adicionado
- Menu de navegação responsivo para telas pequenas, compartilhado entre todas as páginas.
### Corrigido
- Inconsistências de CSS nas páginas internas (serviços, projetos, sobre). (#5)

## [0.4.1] — 2026-08-15
### Revertido
- A experiência guiada por scroll foi revertida para a versão anterior do site; o código da experiência foi arquivado em `/experiencia` como showcase técnico independente, em vez de ser removido. (#4)

## [0.4.0] — 2026-08-14
### Adicionado
- Experiência de home guiada por scroll, com cena 3D em WebGL. (#2)

## [0.3.0] — 2026-08-13
### Adicionado
- Wizard interativo de briefing em 3 passos, substituindo a abordagem inicial de chat com IA. (#1)

## [0.2.0] — 2026-08-10
### Adicionado
- Seção de projetos reais da Tera em destaque na home.

## [0.1.0] — 2026-07-20
### Adicionado
- Lançamento inicial do site institucional da Tera.
- Deploy automático para GitHub Pages via GitHub Actions.
- Assets oficiais da marca (logos, símbolos e imagem de preview para Open Graph).

[Não lançado]: https://github.com/canhetejr/tera-site/compare/v0.6.5...HEAD
[0.6.5]: https://github.com/canhetejr/tera-site/compare/v0.6.4...v0.6.5
[0.6.4]: https://github.com/canhetejr/tera-site/compare/v0.6.3...v0.6.4
[0.6.3]: https://github.com/canhetejr/tera-site/compare/v0.6.2...v0.6.3
[0.6.2]: https://github.com/canhetejr/tera-site/compare/v0.6.1...v0.6.2
[0.6.1]: https://github.com/canhetejr/tera-site/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/canhetejr/tera-site/compare/v0.5.1...v0.6.0
[0.5.1]: https://github.com/canhetejr/tera-site/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/canhetejr/tera-site/compare/v0.4.1...v0.5.0
[0.4.1]: https://github.com/canhetejr/tera-site/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/canhetejr/tera-site/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/canhetejr/tera-site/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/canhetejr/tera-site/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/canhetejr/tera-site/releases/tag/v0.1.0
