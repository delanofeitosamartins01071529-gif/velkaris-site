# Supabase da Casa Velkaris

O app funciona em dois modos:

- Sem Supabase: usa `data/*.json` e `static/uploads`.
- Com Supabase: usa `public.velkaris_documents` para conteúdo e o bucket público `velkaris-media` para uploads.

## Variáveis de Ambiente

```bash
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
SUPABASE_STORAGE_BUCKET=velkaris-media
```

Mantenha `SUPABASE_SERVICE_ROLE_KEY` apenas no backend/hospedagem. Nunca exponha essa chave no navegador.

## Migração

Execute o SQL em `supabase/migrations/0001_velkaris_core.sql` pelo SQL Editor do Supabase ou pelo fluxo de migrations do projeto.

Depois envie os JSON atuais para o Supabase:

```bash
python scripts/seed_supabase.py
```

## Observação de API

Em projetos recentes do Supabase, tabelas novas podem não ficar expostas automaticamente na Data API. Este projeto usa a `service_role` somente no backend, então o navegador não precisa acessar a tabela diretamente.

O bucket `velkaris-media` é público apenas para leitura dos arquivos enviados. Escrita continua passando pelo backend/admin.
