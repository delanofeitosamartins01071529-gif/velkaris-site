# Uploads persistentes no Render

Este projeto já suporta armazenamento persistente para uploads do menu ADM.

## Opção recomendada no Render

Crie o Web Service normalmente e adicione um Persistent Disk.

### Configuração do Web Service

Build Command:

```bash
pip install -r requirements.txt
```

Start Command:

```bash
gunicorn app:app
```

### Variáveis de ambiente

Adicione:

```text
ADMIN_USERNAME=admin
ADMIN_PASSWORD=velkaris123
FLASK_SECRET_KEY=troque-por-uma-chave-grande-e-secreta
VELKARIS_STORAGE_DIR=/var/data
```

### Persistent Disk

No painel do serviço no Render, adicione um disk:

```text
Mount path: /var/data
Size: 1 GB ou mais
```

Com `VELKARIS_STORAGE_DIR=/var/data`, o site passa a salvar:

```text
/var/data/data/house.json
/var/data/data/members.json
/var/data/uploads/
```

Assim, uploads feitos no ADM continuam existindo depois de novos deploys e reinícios.

## Observação

Se preferir usar Supabase Storage no futuro, o código também aceita:

```text
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=velkaris-media
```

Nesse modo, uploads vão para o bucket do Supabase e os dados JSON são salvos na tabela `velkaris_documents`.
