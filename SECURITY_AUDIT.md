# Relatório de Auditoria de Segurança - Casa Velkaris

Data: 2026-06-05

Base: OWASP Top 10:2021.

## Resumo executivo

O projeto foi auditado com foco em autenticação, controle de acesso, entradas de formulário, uploads, headers, HTTPS, dependências e logs. As correções aplicadas reduzem principalmente riscos de A01 Broken Access Control, A02 Cryptographic Failures, A05 Security Misconfiguration, A06 Vulnerable and Outdated Components e A07 Identification and Authentication Failures.

Nota geral após correções: 8/10.

## Vulnerabilidades encontradas e corrigidas

### Alta - Senha administrativa em texto puro

Categoria OWASP: A02 Cryptographic Failures e A07 Identification and Authentication Failures.

Problema: o login administrativo comparava a senha recebida diretamente com `ADMIN_PASSWORD`. Isso incentivava configuração por senha em texto puro no ambiente.

Correção aplicada:
- Adicionada verificação por Argon2 via `ADMIN_PASSWORD_HASH`.
- Mantido fallback de texto puro apenas se `ALLOW_PLAINTEXT_ADMIN_PASSWORD=1`, com log de alerta.
- Atualizado `render.yaml` para usar `ADMIN_PASSWORD_HASH`.
- Atualizado `README.md` com comando para gerar hash Argon2.

Arquivos alterados: `app.py`, `requirements.txt`, `render.yaml`, `README.md`.

### Alta - Upload validado apenas por extensão

Categoria OWASP: A05 Security Misconfiguration e A08 Software and Data Integrity Failures.

Problema: arquivos enviados eram aceitos se a extensão fosse `.png`, `.jpg`, `.jpeg` ou `.webp`; um arquivo malicioso poderia ser enviado com extensão falsa.

Correção aplicada:
- Uploads agora são abertos e verificados pelo Pillow.
- Imagens inválidas ou corrompidas são bloqueadas.
- Imagens válidas são reprocessadas antes de salvar.
- Definido limite de pixels para reduzir risco de imagem-bomba.
- A rota `/uploads` rejeita nomes sem extensão permitida.

Arquivos alterados: `app.py`.

### Média - Redirecionamento aberto no login

Categoria OWASP: A01 Broken Access Control.

Problema: o parâmetro `next` do login podia apontar para URL externa.

Correção aplicada:
- Criada validação `safe_next_url`.
- O login só redireciona para caminhos locais iniciados por `/`.

Arquivos alterados: `app.py`.

### Média - Sessão administrativa sem expiração explícita

Categoria OWASP: A07 Identification and Authentication Failures.

Problema: a sessão admin não tinha tempo de validade próprio.

Correção aplicada:
- Configurado `PERMANENT_SESSION_LIFETIME`.
- Registrado `admin_login_at`.
- Rotas admin expiram a sessão após o limite configurado.

Arquivos alterados: `app.py`.

### Média - CSRF sem expiração

Categoria OWASP: A01 Broken Access Control e A05 Security Misconfiguration.

Problema: o token CSRF existia, mas não expirava.

Correção aplicada:
- Tokens agora usam `secrets.token_urlsafe`.
- Adicionado `csrf_token_issued_at`.
- `validate_csrf` rejeita token expirado.

Arquivos alterados: `app.py`.

### Média - Headers de segurança incompletos

Categoria OWASP: A05 Security Misconfiguration.

Problema: havia alguns headers, mas faltavam CSP, Permissions-Policy, HSTS e política de cache para admin.

Correção aplicada:
- Adicionado `Content-Security-Policy`.
- Adicionado `Permissions-Policy`.
- Adicionado `Strict-Transport-Security` quando HTTPS estiver ativo ou `FORCE_HTTPS=1`.
- Admin e login recebem `Cache-Control: no-store`.

Arquivos alterados: `app.py`.

### Média - Dependências vulneráveis

Categoria OWASP: A06 Vulnerable and Outdated Components.

Problema: `pip-audit` encontrou vulnerabilidades em Flask 3.1.2 e Pillow 12.0.0.

Correção aplicada:
- Flask atualizado para 3.1.3.
- Pillow atualizado para 12.2.0.
- `pip-audit -r requirements.txt` passou sem vulnerabilidades conhecidas após a atualização.

Arquivos alterados: `requirements.txt`.

### Baixa - Logs insuficientes para incidentes comuns

Categoria OWASP: A09 Security Logging and Monitoring Failures.

Problema: falhas de login, bloqueios, CSRF inválido e upload inválido não eram registrados de forma consistente.

Correção aplicada:
- Adicionados logs para acesso admin negado, login bloqueado, falha de login, sucesso de login, CSRF inválido e upload bloqueado.

Arquivos alterados: `app.py`.

### Baixa - Informações desnecessárias no healthcheck

Categoria OWASP: A05 Security Misconfiguration.

Problema: `/healthz` retornava o nome da casa, informação desnecessária para monitoramento.

Correção aplicada:
- `/healthz` agora retorna apenas `{"status": "ok"}`.

Arquivos alterados: `app.py`.

## Itens verificados sem vulnerabilidade crítica encontrada

- SQL Injection: não há SQL direto no app. A integração Supabase usa endpoints fixos e payload JSON.
- SSRF: não há URL controlada pelo usuário sendo chamada pelo servidor. URLs de mídia externas são apenas renderizadas no cliente.
- Controle de acesso: rotas administrativas estão protegidas por `@admin_required`.
- Logout: usa POST, CSRF e `session.clear()`.
- XSS: templates Jinja têm autoescape; a árvore genealógica criada via JavaScript usa `escapeHtml`.

## Validações executadas

- `python -m compileall app.py`
- `powershell -ExecutionPolicy Bypass -File scripts/check.ps1`
- `pip-audit -r requirements.txt`
- Teste manual de acesso a `/admin` sem sessão: redireciona para login.
- Teste manual de login `adm` / `velkaris`: autentica com hash Argon2.
- Teste manual de `next=https://evil.example`: redirecionamento externo bloqueado.
- Teste manual de upload falso `.png`: bloqueado.
- Teste manual de headers: CSP, X-Frame-Options, X-Content-Type-Options e Referrer-Policy presentes.

## Melhorias recomendadas para produção

- Trocar o hash padrão por um hash novo de uma senha forte antes de publicar.
- Usar HTTPS real no domínio e manter `FORCE_HTTPS=1`.
- Configurar alertas externos para muitas falhas de login e erros 5xx.
- Usar WAF/CDN com rate limiting por IP para proteger endpoints públicos.
- Executar `pip-audit` no CI a cada deploy.
- Considerar autenticação multifator para o painel administrativo.
- Considerar armazenamento de sessão server-side se o painel crescer.
- Manter backups dos JSONs/Supabase e controle de restauração.

