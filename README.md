# GameHub AI — Plataforma Gamer & Game Companion

Plataforma gamer moderna full-stack que combina catálogo inteligente de jogos, gerenciamento de biblioteca pessoal, personalização avançada de perfis e acompanhamento de gameplay assistido por IA com controle rigoroso de spoilers.

---

## 1. Arquitetura Técnica

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS.
- **Backend**: Node.js + Express 4 (arquitetura modular em `server/modules/*`).
- **Banco de Dados**: PostgreSQL hospedado no Neon (Serverless Postgres).
- **ORM**: Prisma ORM 6.19.3.
- **Autenticação**: JWT (`jsonwebtoken`) assinado com algoritmo HS256 e expiração de 7 dias.
- **Criptografia de Senhas**: Argon2id (`argon2`) com parâmetros de segurança recomendados pela OWASP (`m=65536`, `t=3`, `p=4`).
- **Validação de Entrada**: Zod 4 em todos os endpoints de entrada.
- **Documentação de API**: OpenAPI 3.0.3 e Swagger UI interativo.
- **Testes Automatizados**: Vitest 5 + Supertest 7.

---

## 2. Documentação da API (OpenAPI / Swagger)

A documentação interativa e os schemas OpenAPI 3.0.3 estão disponíveis nos seguintes endpoints do backend:

- **Swagger UI Interativo**: `http://localhost:3000/api/docs`
- **Especificação OpenAPI JSON**: `http://localhost:3000/api/docs.json`

### Endpoints Documentados

| Método | Endpoint | Autenticação | Descrição |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Pública | Cadastro com validação Zod, hash Argon2id e criação atômica de `UserPreference`. |
| `POST` | `/api/auth/login` | Pública | Autenticação com e-mail e senha, emissão de JWT em cookie HttpOnly e Bearer token. |
| `POST` | `/api/auth/logout` | Pública | Encerramento de sessão com invalidação imediata do cookie `gamehub_token`. |
| `GET` | `/api/auth/me` | Protegida | Consulta de sessão do usuário logado via cookie ou cabeçalho Bearer. |
| `GET` | `/api/users/me` | Protegida | Obtenção do perfil gamer, bio, avatar e preferências ativas. |
| `PATCH` | `/api/users/me` | Protegida | Atualização de username (com verificação de colisão), bio e avatar. |
| `GET` | `/api/users/me/preferences` | Protegida | Consulta de plataformas favoritas, gêneros e nível anti-spoiler. |
| `PATCH` | `/api/users/me/preferences` | Protegida | Atualização de spoiler level (`NONE`, `LIGHT`, `ALL`), plataformas, temas e hotkey. |
| `GET` | `/health` | Pública | Health check raiz da aplicação e verificação de persistência no PostgreSQL. |
| `GET` | `/api/health` | Pública | Health check dos módulos e status da infraestrutura sem expor topologia interna. |

---

## 3. Segurança e Políticas de Acesso

### Armazenamento de Tokens e Cookies
- O token JWT é transmitido primariamente via **Cookie HttpOnly** (`gamehub_token`) com flags `SameSite=Lax` (ou `None` com `Secure` em produção/iframe).
- Nunca armazenamos JWT em `localStorage` para mitigar ataques XSS.
- Um fallback transparente via header `Authorization: Bearer <token>` é mantido em memória no frontend para garantir compatibilidade em ambientes com restrições de cookies em iframes (como o preview do Google AI Studio).

### Mitigação de Força Bruta (Rate Limiting)
- Rotas sensíveis (`/api/auth/register` e `/api/auth/login`) são protegidas com `express-rate-limit` (30 requisições a cada 15 minutos por endereço IP).
- Cabeçalhos padronizados `RateLimit-*` são retornados nas respostas.

### Logging Seguro
- O logger estruturado (`server/utils/logger.ts`) aplica máscara automática em campos sensíveis (`password`, `confirmPassword`, `token`, `secret`, `gamehub_token`, `passwordHash`, `DATABASE_URL`, `DIRECT_URL`), impedindo o vazamento de credenciais em stdout/stderr.

---

## 4. Isolamento de Banco de Dados e Neon Branching

A aplicação utiliza duas variáveis de conexão:
- `DATABASE_URL`: Conexão com pooling (pgBouncer) para consultas da aplicação.
- `DIRECT_URL`: Conexão direta sem pooler para execução de migrações Prisma.

### Estratégia para Testes Isolados
Para ambientes de integração contínua (CI/CD) ou execuções locais sem risco ao banco principal:
1. Configure a variável de ambiente `TEST_DATABASE_URL` apontando para uma **branch dedicada do Neon** (ex: `ep-test-branch-pooler.sa-east-1.aws.neon.tech/neondb`).
2. O arquivo `server/config/env.ts` detecta automaticamente quando `NODE_ENV === 'test'` e utiliza a `TEST_DATABASE_URL`.
3. Quando a variável de teste não estiver configurada, os testes executam com isolamento por timestamp e prefixo controlado (`gamer_[timestamp]`), realizando limpeza no hook `afterAll` e garantindo que os dados de usuários de produção nunca sejam afetados.

---

## 5. Scripts de Execução

```bash
# Instalação de dependências
npm install

# Geração do Prisma Client
npm run prisma:generate

# Execução da suíte completa de testes automatizados (21 testes)
npm test

# Verificação estática de tipos TypeScript
npm run lint

# Build de produção do frontend
npm run build

# Inicialização do servidor em desenvolvimento
npm run dev

# Inicialização em produção
npm start
```
