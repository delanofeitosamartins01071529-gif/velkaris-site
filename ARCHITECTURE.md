# Velkaris: mapa tecnico

Este arquivo serve como indice rapido para manutencao. O conteudo cadastrado pelo usuario deve ser preservado durante alteracoes de codigo.

## Dados persistentes

Nao sobrescrever, recriar ou normalizar manualmente estes arquivos sem uma solicitacao explicita:

- `data/house.json`: configuracoes e textos da Casa.
- `data/members.json`: familiares e vinculos genealogicos.
- `data/publish.json`: estado de publicacao.
- `static/uploads/`: imagens enviadas pelo painel administrativo.

## Backend

- `app.py`: aplicacao Flask, normalizacao de dados, arvore familiar, uploads e rotas administrativas.
- `scripts/check.ps1`: verificacao rapida de sintaxe e integridade do diff.
- `scripts/run-local.ps1`: reinicia o servidor local e confirma `/healthz`.

## Interface publica

- `templates/base.html`: estrutura global, cabecalho, painel de audio e ordem dos scripts.
- `templates/index.html`: secoes publicas, modais e marcadores de interacao.
- `static/css/styles.css`: estilos globais e responsivos.
- `static/js/site-ui.js`: navegacao, barra lateral, animacoes de secoes, paralaxe da capa e filtros de retratos.
- `static/js/main.js`: cursor, modais, retratos expansiveis, arvore genealogica e utilitarios administrativos compartilhados.
- `static/js/interactive-map.js`: mapa e modal de territorios.
- `static/js/use-audio-manager.js`: musica ambiente e vento.

## Painel administrativo

- `templates/admin.html`: formularios e secoes de edicao.
- `static/js/admin-bulk-members.js`: busca e salvamento em lote dos cards.
- `static/js/admin-bulk-timeline.js`: salvamento em lote das cronicas.

## Convencoes

- Novos comportamentos visuais de pagina devem ir para `static/js/site-ui.js`.
- Alteracoes da arvore genealogica devem permanecer agrupadas no bloco `familyTree` de `static/js/main.js`.
- Antes de entregar uma alteracao, executar `powershell -ExecutionPolicy Bypass -File scripts/check.ps1`.
- Para disponibilizar a versao local, executar `powershell -ExecutionPolicy Bypass -File scripts/run-local.ps1`.
