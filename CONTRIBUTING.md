# Contribuindo

Obrigado por querer contribuir com o site da Tera. O projeto é intencionalmente simples — sem build, sem framework — e o fluxo de contribuição segue a mesma filosofia.

## Preparando o ambiente

Não há dependências para instalar. Clone o repositório e sirva a raiz com qualquer servidor estático:

```bash
git clone https://github.com/canhetejr/tera-site.git
cd tera-site
python3 -m http.server 8000
```

Abra `http://localhost:8000`. Os módulos JavaScript usam `type="module"`, então é necessário servir por HTTP — abrir os arquivos diretamente pelo `file://` não funciona.

## Fazendo alterações

- Cada página é um arquivo HTML autocontido (`index.html`, `servicos.html`, `projetos.html`, `sobre.html`, `briefing.html`, `experiencia/index.html`). CSS e JSON-LD de SEO ficam inline em cada página; CSS compartilhado vive em `assets/css/`.
- O menu mobile é compartilhado por todas as páginas via `assets/js/menu.js` — não duplique o markup do menu ao adicionar uma página nova; garanta apenas que ela tenha um `<header>` com um `<nav>` dentro.
- Ao mexer na experiência WebGL (`/experiencia` ou o hero da home), veja [`docs/architecture.md`](docs/architecture.md) antes: o renderer, a gramática de conexões e os tiers de qualidade têm decisões de design explicadas nos próprios comentários dos arquivos em `assets/js/core/` e `assets/js/motion/`.
- Ao mexer no briefing (`briefing.html`), tenha em mente que ele integra dois serviços externos (FormSubmit e um webhook de chat n8n) — veja a seção correspondente em [`docs/architecture.md`](docs/architecture.md).

## Convenções

- Idioma do conteúdo: português (pt-BR), como o restante do site.
- Não introduza dependências de build (bundler, framework, gerenciador de pacotes) sem alinhar antes — é uma decisão deliberada do projeto, não uma lacuna.
- Nunca commite segredos, tokens ou credenciais. Os únicos endpoints externos hoje (FormSubmit e o webhook n8n) são endpoints públicos de recebimento, não segredos — mas qualquer chave de API, token de acesso ou credencial de serviço não deve ir para o repositório.
- Ao adicionar imagens, otimize antes de commitar (o repositório não tem pipeline de compressão automática).

## Testando

Não há suíte de testes automatizados. Antes de abrir um PR:

1. Sirva o site localmente e navegue por todas as páginas alteradas.
2. Confira o console do navegador por erros de JavaScript, especialmente em `/experiencia`.
3. Teste em uma viewport mobile (< 900px), já que o menu e vários layouts têm breakpoints dedicados.
4. Se alterou `briefing.html`, teste o fluxo completo do wizard, incluindo o envio (o FormSubmit responde mesmo em ambiente local, desde que o domínio esteja autorizado no painel do FormSubmit).

## Pull requests

- Descreva o que mudou e por quê.
- Referencie a página ou o componente afetado.
- PRs pequenos e focados são mais fáceis de revisar do que mudanças amplas.

## Deploy

O deploy é automático: qualquer push em `main` publica a raiz do repositório no GitHub Pages via GitHub Actions (`.github/workflows/static.yml`). Não é necessário nenhum passo manual de build ou publicação.
