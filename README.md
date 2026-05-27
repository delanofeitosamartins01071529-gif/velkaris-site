# Casa Velkaris

Website premium dark fantasy para a Casa Velkaris, com Flask, HTML, CSS e JavaScript puro. O projeto inclui hero cinematográfica, brasão animado, cards de linhagem, árvore genealógica, territórios, arquivos, galeria, música ambiente opcional e painel admin para upload dos retratos.

## Stack

- Python 3.14+
- Flask
- HTML5, CSS3 e JavaScript
- Assets locais gerados por script, sem dependência de CDNs de imagem

## Como rodar

```bash
python -m venv .venv
.venv\Scripts\activate
python -m pip install -r requirements.txt
python app.py
```

Acesse `http://127.0.0.1:5000`.

## Deploy

O projeto está pronto para deploy em serviços Python como Render, Railway, Fly.io ou Heroku-like.

Arquivos de produção incluídos:

- `.python-version`: fixa Python 3.14.
- `Procfile`: inicia o app com `gunicorn app:app`.
- `render.yaml`: blueprint para Render com healthcheck em `/healthz`.

No Render, conecte o repositório GitHub e use o `render.yaml`. O blueprint usa um disco persistente em `/var/data` para manter textos editados e uploads do painel admin entre deploys/restarts. Discos persistentes exigem serviço pago no Render; para rodar totalmente grátis com persistência, o próximo passo é migrar dados/uploads para Supabase.

Variáveis importantes em produção:

```bash
SECRET_KEY=gerada automaticamente no render.yaml
ADMIN_USERNAME=admin
ADMIN_PASSWORD=defina uma senha forte no painel da hospedagem
VELKARIS_STORAGE_DIR=/var/data
```

Os assets finais já estão em `static/assets`. Rode `python scripts/generate_assets.py` apenas se quiser recriar o castelo, mapa, galeria e placeholders.

Para recarregamento automático durante desenvolvimento:

```powershell
$env:FLASK_DEBUG="1"
python app.py
```

## Admin

O painel fica em `/admin`.

Credenciais locais padrão:

- Usuário: `admin`
- Senha: `velkaris-ascende`

Antes de publicar, configure variáveis de ambiente:

```bash
set ADMIN_USERNAME=seu_usuario
set ADMIN_PASSWORD=sua_senha_forte
set SECRET_KEY=uma_chave_secreta_longa
```

No PowerShell:

```powershell
$env:ADMIN_USERNAME="seu_usuario"
$env:ADMIN_PASSWORD="sua_senha_forte"
$env:SECRET_KEY="uma_chave_secreta_longa"
```

O administrador pode editar:

- Nome da Casa, slogan, textos principais e títulos de seções.
- Brasão, imagem do hero e mapa dos territórios.
- Parágrafos da história, símbolos, territórios, arquivos/notícias e galeria.
- Familiares com retrato, título, geração, descrição, ordem e destaque.
- Familiares com campos detalhados: status, ramo, território, nascimento/era, aliança, epíteto, frase, traços e biografia.
- Árvore genealógica em uma seção própria, escolhendo ascendentes, geração, ordem e se cada familiar aparece ou não na árvore.
- Upload de imagem do familiar direto pela seção da árvore genealógica.
- Status do familiar com opções `Vivo`, `Morto` e `Desaparecido`; ao escolher `Morto`, o admin pode registrar a causa da morte.
- No site público, o visitante pode clicar em um card familiar para abrir o registro completo daquele membro.

## Estrutura

```text
.
├── app.py
├── data/
│   ├── house.json
│   └── members.json
├── scripts/
│   └── generate_assets.py
├── static/
│   ├── assets/
│   ├── css/
│   ├── js/
│   └── uploads/
└── templates/
```

## Personalização

- Use `/admin` para alterar história, símbolos, territórios, arquivos, galeria, familiares e árvore genealógica.
- Os uploads são salvos em `static/uploads`.
- Rode `python scripts/generate_assets.py` para recriar os assets locais.

## Observações de produção

- Troque as credenciais padrão.
- Use HTTPS e um servidor WSGI como Gunicorn, Waitress ou uWSGI.
- Configure backup para o diretório persistente definido em `VELKARIS_STORAGE_DIR`.
