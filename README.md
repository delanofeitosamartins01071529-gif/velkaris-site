# Casa Velkaris

Website premium dark fantasy para a Casa Velkaris, com interface cinematográfica, brasão oficial, linhagem editável, árvore genealógica, territórios, crônicas históricas, eras e painel administrativo.

## Stack

- Python 3.14+
- Flask + Gunicorn
- HTML5, CSS3 moderno e JavaScript puro
- Pillow para corte automático de retratos
- Supabase opcional para dados e uploads em produção
- Render blueprint pronto em `render.yaml`

## Como rodar

```bash
python -m venv .venv
.venv\Scripts\activate
python -m pip install -r requirements.txt
python app.py
```

Acesse `http://127.0.0.1:5000`.

## Admin

O acesso administrativo fica em `/velkaris-admin`.

Credenciais locais padrão:

- Usuário: `admin`
- Senha: `velkaris-ascende`

Configure uma senha forte em produção:

```bash
ADMIN_USERNAME=admin
ADMIN_PASSWORD=sua_senha_forte
SECRET_KEY=uma_chave_longa_e_secreta
```

O painel permite editar:

- Textos principais, slogan, títulos de seções, brasão, hero e mapa.
- Familiares com nome, slug, títulos, status, causa da morte, geração, relações, biografia, feitos e imagem.
- Retratos com corte automático para o formato dos cards e da árvore.
- Ordenação drag-and-drop dos familiares.
- Árvore genealógica com inclusão, exclusão, ascendentes e exibição na árvore.
- Territórios com coordenadas no mapa, status e lore.
- Galeria, arquivos, crônicas históricas e eras.
- Prévia ao vivo e botão “Publicar alterações”.

## Site público

Recursos principais:

- Hero cinematográfico com brasão oficial sem sobrepor o nome da família.
- Ancestrais em cards compactos e clicáveis.
- Cards de familiares com modal detalhado.
- Página individual por familiar, por exemplo `/linhagem/kayzer-velkaris`.
- Árvore genealógica com casais lado a lado, filhos centralizados, zoom, pan/arrastar, linhas SVG recalculadas e modal ao clicar em qualquer membro.
- Mapa interativo de territórios.
- Linha do tempo histórica.
- Sistema de eras.
- SEO básico e metadados para compartilhamento.

## Supabase

O app lê e grava em arquivos locais por padrão. Em produção, basta configurar:

```bash
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
SUPABASE_STORAGE_BUCKET=velkaris-media
```

Depois aplique a migration em `supabase/migrations/0001_velkaris_core.sql` e rode:

```bash
python scripts/seed_supabase.py
```

Mais detalhes estão em `SUPABASE_SETUP.md`.

## Deploy

O projeto está preparado para Render:

- `Procfile`: inicia `gunicorn app:app`.
- `render.yaml`: define serviço web, disco persistente opcional e healthcheck em `/healthz`.
- Variáveis sensíveis ficam fora do código.

Também pode ser adaptado para Railway ou Fly.io usando o mesmo comando de start.

## Estrutura

```text
.
├── app.py
├── data/
│   ├── house.json
│   └── members.json
├── scripts/
│   └── seed_supabase.py
├── static/
│   ├── assets/
│   ├── css/
│   ├── js/
│   └── uploads/
├── supabase/
│   └── migrations/
└── templates/
```

## Produção

- Troque a senha padrão.
- Use HTTPS.
- Configure Supabase para persistência real de conteúdo e uploads.
- Configure domínio próprio no provedor de deploy.
- Mantenha `SUPABASE_SERVICE_ROLE_KEY` apenas no backend.

## Fluxo da Árvore

No painel admin, use `Montagem visual da linhagem` para vincular o par/cônjuge e marcar os filhos daquele núcleo. Apenas um membro do casal edita os filhos do núcleo, evitando duplicidade. Depois use `Salvar toda a arvore` para publicar várias alterações de uma vez.

A renderização pública escolhe automaticamente o ramo principal de cada casal pela ordem visual/admin, separa gerações, evita duplicar o mesmo núcleo familiar e ancora a linha no membro correto do casal, por exemplo no Olaf quando apenas ele é filho dos ascendentes.
