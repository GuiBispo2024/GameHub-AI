/**
 * OpenAPI 3.0.3 Specification for GameHub AI
 * Complete technical documentation of all public and authenticated endpoints.
 */

export const swaggerDocument = {
  openapi: '3.0.3',
  info: {
    title: 'GameHub AI — RESTful API Documentation',
    version: '1.0.0',
    description: `
API modular da plataforma **GameHub AI** combinando acompanhamento inteligente de gameplay, gerenciamento de perfil gamer e biblioteca sincronizada.

### Autenticação
A API suporta autenticação state-aware via:
1. **Cookie HttpOnly** (\`gamehub_token\`): Modo primário em navegadores com proteção SameSite e Secure.
2. **Bearer Token** (\`Authorization: Bearer <token>\`): Fallback transparente para ambientes de container, desktop overlay e iframes.

### Segurança
- Hash de senhas realizado com **Argon2id**.
- Validação estrita de entrada via **Zod**.
- Proteção contra enumeração de usuários no endpoint de login.
- Rate limiting para mitigação de ataques de força bruta.
    `,
    contact: {
      name: 'GameHub AI Engineering Team',
      url: 'https://github.com/gamehub-ai',
    },
  },
  servers: [
    {
      url: '/',
      description: 'Servidor Atual (Ambiente de Execução)',
    },
  ],
  components: {
    securitySchemes: {
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'gamehub_token',
        description: 'Cookie seguro HttpOnly contendo o JWT de sessão assinado pelo servidor.',
      },
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Token JWT enviado no cabeçalho Authorization: Bearer <token>.',
      },
    },
    schemas: {
      RegisterRequest: {
        type: 'object',
        required: ['username', 'email', 'password', 'confirmPassword'],
        properties: {
          username: {
            type: 'string',
            minLength: 3,
            maxLength: 30,
            pattern: '^[a-zA-Z0-9_-]+$',
            example: 'SoulslikeMaster',
            description: 'Nome de usuário único (apenas letras, números, sublinhados e hífens).',
          },
          email: {
            type: 'string',
            format: 'email',
            example: 'player@gamehub.ai',
            description: 'Endereço de e-mail válido (normalizado para minúsculas).',
          },
          password: {
            type: 'string',
            minLength: 8,
            example: 'GamerStrongPass123!',
            description: 'Senha contendo pelo menos 8 caracteres, uma letra maiúscula, uma minúscula e um número.',
          },
          confirmPassword: {
            type: 'string',
            minLength: 8,
            example: 'GamerStrongPass123!',
            description: 'Confirmação de senha idêntica ao campo password.',
          },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: {
            type: 'string',
            format: 'email',
            example: 'player@gamehub.ai',
          },
          password: {
            type: 'string',
            example: 'GamerStrongPass123!',
          },
        },
      },
      UserPreference: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'pref_clw01928374' },
          userId: { type: 'string', example: 'usr_clw09876543' },
          theme: { type: 'string', enum: ['dark', 'neon', 'cyberpunk', 'high-contrast'], example: 'dark' },
          defaultSpoilerLevel: { type: 'string', example: 'CURRENT_CHAPTER' },
          spoilerLevelFriendly: { type: 'string', enum: ['NONE', 'LIGHT', 'ALL'], example: 'LIGHT' },
          preferredPlatforms: {
            type: 'array',
            items: { type: 'string' },
            example: ['PC', 'PlayStation 5'],
          },
          preferredGenres: {
            type: 'array',
            items: { type: 'string' },
            example: ['RPG', 'Soulslike', 'Ação'],
          },
          language: { type: 'string', example: 'pt-BR' },
          overlayEnabled: { type: 'boolean', example: true },
          overlayHotkey: { type: 'string', example: 'Alt+G' },
          notificationsEnabled: { type: 'boolean', example: true },
        },
      },
      UserPublic: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'usr_clw09876543' },
          username: { type: 'string', example: 'SoulslikeMaster' },
          email: { type: 'string', format: 'email', example: 'player@gamehub.ai' },
          avatarUrl: { type: 'string', nullable: true, example: 'https://images.unsplash.com/photo-gamer.jpg' },
          bio: { type: 'string', nullable: true, example: 'Focado em platinar RPGs e jogos difíceis.' },
          createdAt: { type: 'string', format: 'date-time', example: '2026-11-11T20:00:00.000Z' },
          preferences: { $ref: '#/components/schemas/UserPreference' },
        },
      },
      AuthResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'success' },
          message: { type: 'string', example: 'Autenticação realizada com sucesso.' },
          user: { $ref: '#/components/schemas/UserPublic' },
          token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
        },
      },
      UpdateUserRequest: {
        type: 'object',
        properties: {
          username: { type: 'string', minLength: 3, maxLength: 30, example: 'SoulslikePro' },
          bio: { type: 'string', maxLength: 300, nullable: true, example: 'Nova bio gamer atualizada.' },
          avatarUrl: { type: 'string', format: 'uri', nullable: true, example: 'https://example.com/avatar.png' },
        },
      },
      UpdatePreferencesRequest: {
        type: 'object',
        properties: {
          theme: { type: 'string', enum: ['dark', 'neon', 'cyberpunk', 'high-contrast'], example: 'dark' },
          spoilerLevel: { type: 'string', enum: ['NONE', 'LIGHT', 'ALL'], example: 'NONE' },
          preferredPlatforms: {
            type: 'array',
            items: { type: 'string' },
            example: ['PC', 'Nintendo Switch'],
          },
          preferredGenres: {
            type: 'array',
            items: { type: 'string' },
            example: ['Metroidvania', 'RPG'],
          },
          language: { type: 'string', example: 'pt-BR' },
          overlayEnabled: { type: 'boolean', example: true },
          overlayHotkey: { type: 'string', example: 'Alt+G' },
          notificationsEnabled: { type: 'boolean', example: true },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'error' },
          code: { type: 'string', example: 'VALIDATION_ERROR' },
          message: { type: 'string', example: 'Dados enviados na requisição são inválidos.' },
          errors: {
            type: 'object',
            additionalProperties: {
              type: 'array',
              items: { type: 'string' },
            },
            example: {
              email: ['Endereço de e-mail inválido'],
              password: ['A senha deve conter no mínimo 8 caracteres'],
            },
          },
        },
      },
      HealthResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'ok' },
          app: { type: 'string', example: 'GameHub AI API' },
          version: { type: 'string', example: '1.0.0' },
          timestamp: { type: 'string', format: 'date-time' },
          uptimeSeconds: { type: 'number', example: 120 },
          environment: { type: 'string', example: 'development' },
          database: {
            type: 'object',
            properties: {
              status: { type: 'string', example: 'CONNECTED' },
              engine: { type: 'string', example: 'PostgreSQL' },
              provider: { type: 'string', example: 'Prisma ORM 6.19.3' },
              connected: { type: 'boolean', example: true },
              message: { type: 'string', example: 'Conexão com PostgreSQL ativa e operacional.' },
            },
          },
          modules: {
            type: 'object',
            properties: {
              auth: { type: 'string', example: 'ACTIVE' },
              users: { type: 'string', example: 'ACTIVE' },
              library: { type: 'string', example: 'ACTIVE' },
              companion: { type: 'string', example: 'STRUCTURE_READY' },
            },
          },
        },
      },
      NormalizedGame: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid', nullable: true, example: 'b5a03e67-d8c9-467f-a6f7-b2eb10065a44' },
          igdbId: { type: 'integer', example: 119133 },
          title: { type: 'string', example: 'Elden Ring' },
          slug: { type: 'string', example: 'elden-ring' },
          summary: { type: 'string', nullable: true, example: 'THE NEW FANTASY ACTION RPG. Rise, Tarnished, and be guided by grace to brandish the power of the Elden Ring and become an Elden Lord in the Lands Between.' },
          storyline: { type: 'string', nullable: true },
          coverUrl: { type: 'string', format: 'uri', nullable: true, example: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co4jni.jpg' },
          backdropUrl: { type: 'string', format: 'uri', nullable: true, example: 'https://images.igdb.com/igdb/image/upload/t_1080p/sc73e7.jpg' },
          rating: { type: 'number', nullable: true, example: 95.2 },
          releaseDate: { type: 'string', format: 'date', nullable: true, example: '2022-02-25' },
          genres: {
            type: 'array',
            items: { type: 'string' },
            example: ['Role-playing (RPG)', 'Adventure'],
          },
          platforms: {
            type: 'array',
            items: { type: 'string' },
            example: ['PC (Microsoft Windows)', 'PlayStation 5', 'Xbox Series X|S'],
          },
          developer: { type: 'string', nullable: true, example: 'FromSoftware' },
          publisher: { type: 'string', nullable: true, example: 'Bandai Namco Entertainment' },
          createdAt: { type: 'string', format: 'date-time', nullable: true },
          updatedAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      SearchGamesResponse: {
        type: 'object',
        properties: {
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/NormalizedGame' },
          },
          pagination: {
            type: 'object',
            properties: {
              page: { type: 'integer', example: 1 },
              limit: { type: 'integer', example: 20 },
              hasNextPage: { type: 'boolean', example: true },
            },
          },
        },
      },
      GenreItem: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 12 },
          name: { type: 'string', example: 'Role-playing (RPG)' },
          slug: { type: 'string', example: 'role-playing-rpg' },
        },
      },
      PlatformItem: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 6 },
          name: { type: 'string', example: 'PC (Microsoft Windows)' },
          abbreviation: { type: 'string', example: 'PC' },
          slug: { type: 'string', example: 'win' },
        },
      },
      LibraryStatus: {
        type: 'string',
        enum: ['WISHLIST', 'BACKLOG', 'PLAYING', 'COMPLETED', 'PAUSED', 'DROPPED'],
        example: 'PLAYING',
      },
      LibraryEntry: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid', example: '9e2e2f7a-11b2-4c3d-8a9e-0123456789ab' },
          userId: { type: 'string', format: 'uuid', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
          gameId: { type: 'string', format: 'uuid', example: 'b5a03e67-d8c9-467f-a6f7-b2eb10065a44' },
          status: { $ref: '#/components/schemas/LibraryStatus' },
          rating: { type: 'integer', minimum: 0, maximum: 10, nullable: true, example: 9 },
          hoursPlayed: { type: 'number', minimum: 0, example: 42.5 },
          notes: { type: 'string', nullable: true, maxLength: 2000, example: 'Derrotei o chefe de Caelid com build de destreza.' },
          progressPercentage: { type: 'integer', example: 0 },
          isFavorite: { type: 'boolean', example: false },
          currentChapter: { type: 'string', nullable: true },
          startedAt: { type: 'string', format: 'date-time', nullable: true },
          completedAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          game: { $ref: '#/components/schemas/NormalizedGame' },
        },
      },
      AddLibraryGameRequest: {
        type: 'object',
        required: ['gameId'],
        properties: {
          gameId: { type: 'string', format: 'uuid', example: 'b5a03e67-d8c9-467f-a6f7-b2eb10065a44' },
          status: { $ref: '#/components/schemas/LibraryStatus' },
          rating: { type: 'integer', minimum: 0, maximum: 10, nullable: true, example: 9 },
          hoursPlayed: { type: 'number', minimum: 0, example: 0 },
          notes: { type: 'string', maxLength: 2000, nullable: true, example: 'Começando a campanha principal.' },
        },
      },
      UpdateLibraryGameRequest: {
        type: 'object',
        properties: {
          status: { $ref: '#/components/schemas/LibraryStatus' },
          rating: { type: 'integer', minimum: 0, maximum: 10, nullable: true, example: 10 },
          hoursPlayed: { type: 'number', minimum: 0, example: 85.5 },
          notes: { type: 'string', maxLength: 2000, nullable: true, example: 'Zerei com final da Era das Estrelas!' },
        },
      },
      LibraryListResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'success' },
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/LibraryEntry' },
          },
          pagination: {
            type: 'object',
            properties: {
              page: { type: 'integer', example: 1 },
              limit: { type: 'integer', example: 20 },
              total: { type: 'integer', example: 12 },
              totalPages: { type: 'integer', example: 1 },
              hasNextPage: { type: 'boolean', example: false },
              hasPrevPage: { type: 'boolean', example: false },
            },
          },
        },
      },
      LibraryStats: {
        type: 'object',
        properties: {
          totalGames: { type: 'integer', example: 12 },
          completedCount: { type: 'integer', example: 4 },
          totalHoursPlayed: { type: 'number', example: 318.5 },
          averageRating: { type: 'number', nullable: true, example: 8.8 },
          ratedGamesCount: { type: 'integer', example: 9 },
          byStatus: {
            type: 'object',
            properties: {
              WISHLIST: { type: 'integer', example: 2 },
              BACKLOG: { type: 'integer', example: 3 },
              PLAYING: { type: 'integer', example: 2 },
              COMPLETED: { type: 'integer', example: 4 },
              PAUSED: { type: 'integer', example: 1 },
              DROPPED: { type: 'integer', example: 0 },
            },
          },
        },
      },
      JourneyStatus: {
        type: 'string',
        enum: ['IN_PROGRESS', 'COMPLETED'],
        example: 'IN_PROGRESS',
      },
      GameplayJourney: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid', example: 'd7a1c3f4-1122-4455-8899-aabbccddeeff' },
          userId: { type: 'string', format: 'uuid' },
          userGameId: { type: 'string', format: 'uuid' },
          gameId: { type: 'string', format: 'uuid' },
          name: { type: 'string', example: '1ª Run - Mago Astral' },
          characterName: { type: 'string', nullable: true, example: 'Aurelia' },
          characterClass: { type: 'string', nullable: true, example: 'Astrólogo / Inteligência' },
          currentLevel: { type: 'integer', nullable: true, example: 85 },
          currentArea: { type: 'string', nullable: true, example: 'Platô Altus' },
          currentObjective: { type: 'string', nullable: true, example: 'Entrar na Capital Real de Leyndell' },
          progressPercentage: { type: 'integer', example: 55 },
          playtimeHours: { type: 'number', example: 42.5 },
          isActive: { type: 'boolean', example: true },
          isCompleted: { type: 'boolean', example: false },
          status: { $ref: '#/components/schemas/JourneyStatus' },
          notes: { type: 'string', nullable: true, example: 'Focar em feitiços gravitacionais até pegar a Lua Cheia de Rennala.' },
          startedAt: { type: 'string', format: 'date-time' },
          completedAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          progressLogsCount: { type: 'integer', example: 4 },
          buildsCount: { type: 'integer', example: 2 },
        },
      },
      CreateJourneyRequest: {
        type: 'object',
        required: ['userGameId', 'name'],
        properties: {
          userGameId: { type: 'string', format: 'uuid', example: '9e2e2f7a-11b2-4c3d-8a9e-0123456789ab' },
          name: { type: 'string', maxLength: 120, example: 'Run Hardcore Sem Invocações' },
          characterName: { type: 'string', maxLength: 100, nullable: true, example: 'Vaelen' },
          characterClass: { type: 'string', maxLength: 100, nullable: true, example: 'Samurai Sangramento' },
          currentLevel: { type: 'integer', minimum: 0, nullable: true, example: 15 },
          currentArea: { type: 'string', maxLength: 150, nullable: true, example: 'Limgrave' },
          currentObjective: { type: 'string', maxLength: 300, nullable: true, example: 'Derrotar Margit no Castelo Tempesvéu' },
          playtimeHours: { type: 'number', minimum: 0, example: 3.5 },
          isCompleted: { type: 'boolean', example: false },
          isActive: { type: 'boolean', example: true },
          notes: { type: 'string', maxLength: 2000, nullable: true },
        },
      },
      UpdateJourneyRequest: {
        type: 'object',
        properties: {
          name: { type: 'string', maxLength: 120, example: 'Run Hardcore - Ato II' },
          characterName: { type: 'string', maxLength: 100, nullable: true },
          characterClass: { type: 'string', maxLength: 100, nullable: true },
          currentLevel: { type: 'integer', minimum: 0, nullable: true, example: 92 },
          currentArea: { type: 'string', maxLength: 150, nullable: true, example: 'Caelid' },
          currentObjective: { type: 'string', maxLength: 300, nullable: true, example: 'Enfrentar Radahn no Festival' },
          playtimeHours: { type: 'number', minimum: 0, example: 51 },
          isCompleted: { type: 'boolean', example: false },
          status: { $ref: '#/components/schemas/JourneyStatus' },
          notes: { type: 'string', maxLength: 2000, nullable: true },
        },
      },
      JourneyListResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'success' },
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/GameplayJourney' },
          },
          pagination: {
            type: 'object',
            properties: {
              page: { type: 'integer', example: 1 },
              limit: { type: 'integer', example: 20 },
              total: { type: 'integer', example: 3 },
              totalPages: { type: 'integer', example: 1 },
              hasNextPage: { type: 'boolean', example: false },
              hasPrevPage: { type: 'boolean', example: false },
            },
          },
        },
      },
      ProgressLog: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          userId: { type: 'string', format: 'uuid' },
          userGameId: { type: 'string', format: 'uuid' },
          journeyId: { type: 'string', format: 'uuid' },
          areaName: { type: 'string', nullable: true, example: 'Castelo Tempesvéu' },
          questName: { type: 'string', nullable: true, example: 'Derrotar Godrick, o Enxertado' },
          description: { type: 'string', example: 'Chefe derrotado na 4ª tentativa usando feitiços de Pedrilhante.' },
          completionPercent: { type: 'integer', minimum: 0, maximum: 100, nullable: true, example: 25 },
          hoursPlayedAtPoint: { type: 'number', example: 14.5 },
          playerLevelAtPoint: { type: 'integer', nullable: true, example: 38 },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      CreateProgressLogRequest: {
        type: 'object',
        required: ['description'],
        properties: {
          areaName: { type: 'string', maxLength: 150, nullable: true, example: 'Liurnia dos Lagos' },
          questName: { type: 'string', maxLength: 150, nullable: true, example: 'Academia de Raya Lucaria' },
          description: { type: 'string', minLength: 1, maxLength: 2000, example: 'Obtida a Chave Pedrilhante e liberada a entrada principal.' },
          completionPercent: { type: 'integer', minimum: 0, maximum: 100, nullable: true, example: null },
          hoursPlayedAtPoint: { type: 'number', minimum: 0, example: 21 },
          playerLevelAtPoint: { type: 'integer', minimum: 0, nullable: true, example: 48 },
        },
      },
      UpdateProgressLogRequest: {
        type: 'object',
        properties: {
          areaName: { type: 'string', maxLength: 150, nullable: true },
          questName: { type: 'string', maxLength: 150, nullable: true },
          description: { type: 'string', minLength: 1, maxLength: 2000 },
          completionPercent: { type: 'integer', minimum: 0, maximum: 100, nullable: true },
          hoursPlayedAtPoint: { type: 'number', minimum: 0 },
          playerLevelAtPoint: { type: 'integer', minimum: 0, nullable: true },
        },
      },
      GameBuild: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          userId: { type: 'string', format: 'uuid' },
          gameId: { type: 'string', format: 'uuid' },
          journeyId: { type: 'string', format: 'uuid' },
          name: { type: 'string', example: 'Mago Lunar Carian' },
          description: { type: 'string', nullable: true, example: 'Build focada em Inteligência e dano mágico de média distância.' },
          playstyle: { type: 'string', nullable: true, example: 'Ranged Burst / Sorcery' },
          attributes: {
            type: 'object',
            additionalProperties: true,
            example: { Vigor: 40, Mind: 30, Intelligence: 68, Dexterity: 18 },
          },
          equipment: {
            type: 'object',
            additionalProperties: true,
            example: { rightHand: 'Cetro Real Carian', leftHand: 'Véu da Lua', talismans: ['Ícone de Radagon', 'Massa Graven'] },
          },
          notes: { type: 'string', nullable: true, example: 'Usar Elixir Magnífico com Lágrima Cerúlea Oculta contra chefes.' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      CreateGameBuildRequest: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', maxLength: 120, example: 'Mago Lunar Carian' },
          description: { type: 'string', maxLength: 2000, nullable: true },
          playstyle: { type: 'string', maxLength: 100, nullable: true, example: 'Sorcery' },
          attributes: {
            type: 'object',
            additionalProperties: true,
            example: { Vigor: 35, Intelligence: 60 },
          },
          equipment: {
            type: 'object',
            additionalProperties: true,
            example: { weapon: 'Carian Regal Scepter', armor: 'Snow Witch Set' },
          },
          notes: { type: 'string', maxLength: 2000, nullable: true },
        },
      },
      UpdateGameBuildRequest: {
        type: 'object',
        properties: {
          name: { type: 'string', maxLength: 120 },
          description: { type: 'string', maxLength: 2000, nullable: true },
          playstyle: { type: 'string', maxLength: 100, nullable: true },
          attributes: { type: 'object', additionalProperties: true },
          equipment: { type: 'object', additionalProperties: true },
          notes: { type: 'string', maxLength: 2000, nullable: true },
        },
      },
    },
  },
  paths: {
    '/api/auth/register': {
      post: {
        tags: ['Autenticação'],
        summary: 'Cadastrar novo usuário gamer',
        description: 'Valida os dados com Zod, verifica duplicidade de e-mail e username, aplica hash Argon2id e cria atomicamente o perfil com preferências padrão.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RegisterRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Usuário cadastrado com sucesso. Retorna dados do usuário e define cookie HttpOnly gamehub_token.',
            headers: {
              'Set-Cookie': {
                schema: { type: 'string', example: 'gamehub_token=jwt_value; Path=/; HttpOnly; SameSite=Lax' },
              },
            },
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthResponse' },
              },
            },
          },
          '400': {
            description: 'Erro de validação nos campos de entrada (Zod).',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '409': {
            description: 'Conflito — e-mail ou username já cadastrado.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '429': {
            description: 'Muitas tentativas de autenticação — Rate limit acionado.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Autenticação'],
        summary: 'Autenticar com e-mail e senha',
        description: 'Verifica as credenciais via Argon2id e emite um JWT de sessão assinado por 7 dias via cookie HttpOnly.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Autenticação bem-sucedida.',
            headers: {
              'Set-Cookie': {
                schema: { type: 'string', example: 'gamehub_token=jwt_value; Path=/; HttpOnly' },
              },
            },
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthResponse' },
              },
            },
          },
          '400': {
            description: 'Requisição inválida (formato de e-mail ou senha ausente).',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '401': {
            description: 'Credenciais inválidas (mensagem uniforme anti-enumeração).',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '429': {
            description: 'Muitas tentativas de autenticação — Rate limit acionado.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/auth/logout': {
      post: {
        tags: ['Autenticação'],
        summary: 'Encerrar sessão ativa',
        description: 'Limpa o cookie HttpOnly de sessão no navegador.',
        responses: {
          '200': {
            description: 'Sessão encerrada com sucesso.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    message: { type: 'string', example: 'Sessão encerrada com sucesso.' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/auth/me': {
      get: {
        tags: ['Autenticação'],
        summary: 'Consultar sessão do usuário autenticado',
        description: 'Verifica a validade do JWT e retorna os dados do usuário autenticado.',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Usuário autenticado.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    user: { $ref: '#/components/schemas/UserPublic' },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Não autenticado ou token inválido/expirado.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/users/me': {
      get: {
        tags: ['Perfil Gamer'],
        summary: 'Obter perfil completo do usuário autenticado',
        description: 'Retorna dados do gamer, biografia, avatar e preferências ativas.',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Perfil retornado com sucesso.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    user: { $ref: '#/components/schemas/UserPublic' },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Acesso não autorizado.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
      patch: {
        tags: ['Perfil Gamer'],
        summary: 'Atualizar informações do perfil do usuário',
        description: 'Atualiza username (com verificação de colisão contra outros usuários), bio e avatarUrl. O ID do usuário é extraído do token autenticado, bloqueando qualquer manipulação por terceiros.',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateUserRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Perfil atualizado com sucesso.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    user: { $ref: '#/components/schemas/UserPublic' },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Dados inválidos (username mal formatado ou avatar com URL inválida).',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '401': {
            description: 'Não autenticado.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '409': {
            description: 'Conflito — Nome de usuário já utilizado por outro jogador.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/users/me/preferences': {
      get: {
        tags: ['Perfil Gamer'],
        summary: 'Consultar preferências gamer do usuário',
        description: 'Retorna preferências de spoilers (NONE, LIGHT, ALL), plataformas e gêneros.',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Preferências retornadas com sucesso.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    preferences: { $ref: '#/components/schemas/UserPreference' },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Não autenticado.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
      patch: {
        tags: ['Perfil Gamer'],
        summary: 'Atualizar preferências gamer do usuário',
        description: 'Atualiza nível de spoiler (NONE, LIGHT, ALL), plataformas favoritas, gêneros, idioma e tema.',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdatePreferencesRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Preferências atualizadas com sucesso.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    preferences: { $ref: '#/components/schemas/UserPreference' },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Valores inválidos enviados para preferências.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '401': {
            description: 'Não autenticado.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/health': {
      get: {
        tags: ['Diagnóstico e Monitoramento'],
        summary: 'Health check raiz da aplicação',
        description: 'Verifica a disponibilidade do servidor Express e conectividade operacional com o PostgreSQL.',
        responses: {
          '200': {
            description: 'Servidor saudável e banco conectado.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthResponse' },
              },
            },
          },
        },
      },
    },
    '/api/health': {
      get: {
        tags: ['Diagnóstico e Monitoramento'],
        summary: 'Health check de serviços da API',
        description: 'Verifica o status dos módulos da API e a persistência no PostgreSQL.',
        responses: {
          '200': {
            description: 'API saudável e módulos ativos.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthResponse' },
              },
            },
          },
        },
      },
    },
    '/api/games/search': {
      get: {
        tags: ['Catálogo de Jogos'],
        summary: 'Buscar jogos no catálogo IGDB com cache PostgreSQL',
        description: 'Pesquisa jogos por título com suporte a paginação, filtros por gênero e plataforma, e sincronização automática de cache no PostgreSQL.',
        parameters: [
          {
            name: 'query',
            in: 'query',
            required: true,
            schema: { type: 'string', minLength: 1, maxLength: 100 },
            description: 'Termo de busca do jogo (ex: Elden Ring)',
            example: 'Elden Ring',
          },
          {
            name: 'page',
            in: 'query',
            required: false,
            schema: { type: 'integer', minimum: 1, default: 1 },
            description: 'Número da página',
          },
          {
            name: 'limit',
            in: 'query',
            required: false,
            schema: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
            description: 'Quantidade de jogos por página',
          },
          {
            name: 'genre',
            in: 'query',
            required: false,
            schema: { type: 'string' },
            description: 'Filtro por nome do gênero (ex: Role-playing (RPG))',
          },
          {
            name: 'platform',
            in: 'query',
            required: false,
            schema: { type: 'string' },
            description: 'Filtro por plataforma (ex: PC, PlayStation 5)',
          },
        ],
        responses: {
          '200': {
            description: 'Busca realizada com sucesso.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SearchGamesResponse' },
              },
            },
          },
          '400': {
            description: 'Parâmetros de busca inválidos.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '429': {
            description: 'Rate limit temporário da API externa IGDB.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '502': {
            description: 'Erro de comunicação com a API da IGDB.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/games/genres': {
      get: {
        tags: ['Catálogo de Jogos'],
        summary: 'Listar gêneros de jogos disponíveis',
        description: 'Retorna a lista de gêneros oficiais para exibição de filtros no frontend.',
        responses: {
          '200': {
            description: 'Lista de gêneros retornada com sucesso.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/GenreItem' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/games/platforms': {
      get: {
        tags: ['Catálogo de Jogos'],
        summary: 'Listar plataformas de jogos disponíveis',
        description: 'Retorna as principais plataformas de videogame para filtros.',
        responses: {
          '200': {
            description: 'Lista de plataformas retornada com sucesso.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/PlatformItem' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/games/igdb/{igdbId}': {
      get: {
        tags: ['Catálogo de Jogos'],
        summary: 'Obter detalhes de jogo por ID externo da IGDB',
        description: 'Busca o jogo na base local com verificação de TTL (24h) e atualiza automaticamente a partir da IGDB se desatualizado.',
        parameters: [
          {
            name: 'igdbId',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
            description: 'ID numérico do jogo no catálogo IGDB',
            example: 119133,
          },
        ],
        responses: {
          '200': {
            description: 'Detalhes do jogo retornados com sucesso.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    data: { $ref: '#/components/schemas/NormalizedGame' },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Identificador IGDB inválido.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '404': {
            description: 'Jogo não encontrado no catálogo IGDB.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/games/{id}': {
      get: {
        tags: ['Catálogo de Jogos'],
        summary: 'Obter detalhes de jogo por UUID interno do PostgreSQL',
        description: 'Busca o registro persistido no banco de dados e revalida com a IGDB caso o cache tenha expirado.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
            description: 'UUID do jogo no PostgreSQL',
            example: 'b5a03e67-d8c9-467f-a6f7-b2eb10065a44',
          },
        ],
        responses: {
          '200': {
            description: 'Detalhes do jogo retornados com sucesso.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    data: { $ref: '#/components/schemas/NormalizedGame' },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Identificador UUID inválido.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '404': {
            description: 'Jogo não encontrado na base de dados.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/library': {
      post: {
        tags: ['Biblioteca Pessoal'],
        summary: 'Adicionar jogo à biblioteca pessoal do usuário autenticado',
        description: 'Associa um jogo já catalogado no PostgreSQL ao usuário autenticado. Impede duplicidade por usuário.',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AddLibraryGameRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Jogo adicionado à biblioteca com sucesso.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    message: { type: 'string', example: 'Jogo adicionado à biblioteca com sucesso.' },
                    data: { $ref: '#/components/schemas/LibraryEntry' },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Dados inválidos.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          '401': {
            description: 'Não autenticado.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          '404': {
            description: 'Jogo não encontrado no catálogo.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          '409': {
            description: 'Jogo já cadastrado na biblioteca do usuário.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
      get: {
        tags: ['Biblioteca Pessoal'],
        summary: 'Listar biblioteca pessoal com filtros, ordenação e paginação',
        description: 'Retorna exclusivamente os jogos pertencentes ao usuário autenticado.',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [
          {
            name: 'status',
            in: 'query',
            required: false,
            schema: { $ref: '#/components/schemas/LibraryStatus' },
            description: 'Filtrar por status na biblioteca',
          },
          {
            name: 'genre',
            in: 'query',
            required: false,
            schema: { type: 'string' },
            description: 'Filtrar por gênero do jogo',
          },
          {
            name: 'platform',
            in: 'query',
            required: false,
            schema: { type: 'string' },
            description: 'Filtrar por plataforma do jogo',
          },
          {
            name: 'search',
            in: 'query',
            required: false,
            schema: { type: 'string' },
            description: 'Pesquisar pelo título do jogo',
          },
          {
            name: 'sort',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              enum: ['recentlyAdded', 'recentlyUpdated', 'titleAsc', 'titleDesc', 'ratingDesc', 'hoursPlayedDesc'],
              default: 'recentlyAdded',
            },
            description: 'Critério de ordenação',
          },
          {
            name: 'page',
            in: 'query',
            required: false,
            schema: { type: 'integer', minimum: 1, default: 1 },
          },
          {
            name: 'limit',
            in: 'query',
            required: false,
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
        ],
        responses: {
          '200': {
            description: 'Biblioteca retornada com sucesso.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/LibraryListResponse' },
              },
            },
          },
          '400': {
            description: 'Parâmetros de filtro inválidos.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          '401': {
            description: 'Não autenticado.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },
    '/api/library/stats': {
      get: {
        tags: ['Biblioteca Pessoal'],
        summary: 'Obter estatísticas reais da biblioteca pessoal',
        description: 'Calcula total de jogos, distribuição por status, horas totais, média das notas existentes (null se sem avaliações) e concluídos.',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Estatísticas calculadas com sucesso.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    data: { $ref: '#/components/schemas/LibraryStats' },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Não autenticado.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },
    '/api/library/{id}': {
      get: {
        tags: ['Biblioteca Pessoal'],
        summary: 'Consultar detalhes de uma entrada específica da biblioteca',
        description: 'O parâmetro {id} representa o UUID da entrada UserGame. Verifica propriedade antes de retornar.',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
            description: 'UUID da entrada na biblioteca (UserGame)',
          },
        ],
        responses: {
          '200': {
            description: 'Entrada retornada com sucesso.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    data: { $ref: '#/components/schemas/LibraryEntry' },
                  },
                },
              },
            },
          },
          '400': {
            description: 'UUID inválido.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          '401': {
            description: 'Não autenticado.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          '403': {
            description: 'Registro pertence a outro usuário.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          '404': {
            description: 'Entrada não encontrada.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
      patch: {
        tags: ['Biblioteca Pessoal'],
        summary: 'Atualizar parcialmente uma entrada da biblioteca',
        description: 'Permite atualizar status, rating (0 a 10 ou null), hoursPlayed (>= 0) e notes. Não permite alterar userId ou gameId.',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
            description: 'UUID da entrada na biblioteca (UserGame)',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateLibraryGameRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Entrada atualizada com sucesso.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    message: { type: 'string', example: 'Registro da biblioteca atualizado com sucesso.' },
                    data: { $ref: '#/components/schemas/LibraryEntry' },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Dados inválidos ou tentativa de alterar campos proibidos.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          '401': {
            description: 'Não autenticado.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          '403': {
            description: 'Registro pertence a outro usuário.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          '404': {
            description: 'Entrada não encontrada.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
      delete: {
        tags: ['Biblioteca Pessoal'],
        summary: 'Remover jogo da biblioteca pessoal',
        description: 'Remove apenas o vínculo UserGame do usuário autenticado, preservando o jogo compartilhado no catálogo Game. Política futura: caso existam GameplayJourneys dependentes, exigirá confirmação explícita ou remoção prévia das jornadas (HTTP 409) para evitar perda silenciosa de progresso.',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
            description: 'UUID da entrada na biblioteca (UserGame)',
          },
        ],
        responses: {
          '204': {
            description: 'Entrada removida da biblioteca com sucesso.',
          },
          '400': {
            description: 'UUID inválido.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          '401': {
            description: 'Não autenticado.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          '403': {
            description: 'Registro pertence a outro usuário.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          '404': {
            description: 'Entrada não encontrada.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          '409': {
            description: 'Exclusão bloqueada por jornadas de gameplay dependentes.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },
    '/api/journeys': {
      post: {
        tags: ['Jornadas de Gameplay'],
        summary: 'Criar uma nova jornada de gameplay para um jogo da biblioteca',
        description: 'Cria uma jornada associada a uma entrada UserGame do usuário autenticado. A primeira jornada de um jogo é marcada automaticamente como ativa (isActive: true).',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateJourneyRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Jornada criada com sucesso.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    message: { type: 'string' },
                    data: { $ref: '#/components/schemas/GameplayJourney' },
                  },
                },
              },
            },
          },
          '400': { description: 'Dados inválidos.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '401': { description: 'Não autenticado.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '403': { description: 'Entrada da biblioteca pertence a outro usuário.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '404': { description: 'Entrada UserGame não encontrada.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
      get: {
        tags: ['Jornadas de Gameplay'],
        summary: 'Listar jornadas de gameplay do usuário autenticado',
        description: 'Lista jornadas do usuário com filtro opcional por userGameId e paginação.',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [
          { name: 'userGameId', in: 'query', required: false, schema: { type: 'string', format: 'uuid' }, description: 'Filtrar jornadas por jogo da biblioteca (UserGame)' },
          { name: 'isActive', in: 'query', required: false, schema: { type: 'string', enum: ['true', 'false'] }, description: 'Filtrar apenas jornadas ativas ou inativas' },
          { name: 'page', in: 'query', required: false, schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
        ],
        responses: {
          '200': {
            description: 'Lista de jornadas retornada com sucesso.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/JourneyListResponse' } } },
          },
          '400': { description: 'Parâmetros inválidos.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '401': { description: 'Não autenticado.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '403': { description: 'userGameId pertence a outro usuário.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/journeys/{id}': {
      get: {
        tags: ['Jornadas de Gameplay'],
        summary: 'Consultar detalhes de uma jornada específica',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': {
            description: 'Detalhes da jornada retornados com sucesso.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { status: { type: 'string', example: 'success' }, data: { $ref: '#/components/schemas/GameplayJourney' } },
                },
              },
            },
          },
          '400': { description: 'UUID inválido.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '401': { description: 'Não autenticado.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '403': { description: 'Jornada pertence a outro usuário.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '404': { description: 'Jornada não encontrada.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
      patch: {
        tags: ['Jornadas de Gameplay'],
        summary: 'Atualizar dados de personagem, área, objetivo ou estado da jornada',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateJourneyRequest' } } },
        },
        responses: {
          '200': {
            description: 'Jornada atualizada com sucesso.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { status: { type: 'string', example: 'success' }, message: { type: 'string' }, data: { $ref: '#/components/schemas/GameplayJourney' } },
                },
              },
            },
          },
          '400': { description: 'Dados inválidos.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '401': { description: 'Não autenticado.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '403': { description: 'Jornada pertence a outro usuário.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '404': { description: 'Jornada não encontrada.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
      delete: {
        tags: ['Jornadas de Gameplay'],
        summary: 'Excluir jornada de gameplay',
        description: 'Remove a jornada após validar propriedade. Impacto: todos os registros de progresso (ProgressLog) e builds (GameBuild) vinculados a esta jornada também são removidos em cascata transacional para evitar registros órfãos. O jogo permanece na biblioteca pessoal (UserGame).',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '204': { description: 'Jornada e registros vinculados removidos com sucesso.' },
          '400': { description: 'UUID inválido.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '401': { description: 'Não autenticado.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '403': { description: 'Jornada pertence a outro usuário.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '404': { description: 'Jornada não encontrada.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/journeys/{id}/activate': {
      patch: {
        tags: ['Jornadas de Gameplay'],
        summary: 'Definir jornada como ativa para o respectivo jogo da biblioteca',
        description: 'Executa transação atômica protegida por índice único parcial no PostgreSQL para garantir que apenas uma jornada por UserGame permaneça ativa (isActive: true) por vez.',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': {
            description: 'Jornada ativada com sucesso.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { status: { type: 'string', example: 'success' }, message: { type: 'string' }, data: { $ref: '#/components/schemas/GameplayJourney' } },
                },
              },
            },
          },
          '401': { description: 'Não autenticado.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '403': { description: 'Jornada pertence a outro usuário.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '404': { description: 'Jornada não encontrada.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/journeys/{id}/progress': {
      get: {
        tags: ['Histórico de Progresso'],
        summary: 'Listar histórico cronológico de progresso da jornada',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, description: 'UUID da jornada' }],
        responses: {
          '200': {
            description: 'Lista cronológica de checkpoints retornada com sucesso.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    data: { type: 'array', items: { $ref: '#/components/schemas/ProgressLog' } },
                  },
                },
              },
            },
          },
          '401': { description: 'Não autenticado.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '403': { description: 'Jornada pertence a outro usuário.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '404': { description: 'Jornada não encontrada.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
      post: {
        tags: ['Histórico de Progresso'],
        summary: 'Registrar novo marco no histórico de progresso da jornada',
        description: 'Registra um checkpoint cronológico. O campo completionPercent é opcional (nullable) para suportar jogos sem progressão percentual.',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, description: 'UUID da jornada' }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateProgressLogRequest' } } },
        },
        responses: {
          '201': {
            description: 'Progresso registrado com sucesso.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { status: { type: 'string', example: 'success' }, message: { type: 'string' }, data: { $ref: '#/components/schemas/ProgressLog' } },
                },
              },
            },
          },
          '400': { description: 'Dados inválidos.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '401': { description: 'Não autenticado.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '403': { description: 'Jornada pertence a outro usuário.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '404': { description: 'Jornada não encontrada.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/progress/{id}': {
      patch: {
        tags: ['Histórico de Progresso'],
        summary: 'Editar registro de progresso existente',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateProgressLogRequest' } } },
        },
        responses: {
          '200': {
            description: 'Registro de progresso atualizado com sucesso.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { status: { type: 'string', example: 'success' }, message: { type: 'string' }, data: { $ref: '#/components/schemas/ProgressLog' } },
                },
              },
            },
          },
          '400': { description: 'Dados inválidos.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '401': { description: 'Não autenticado.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '403': { description: 'Registro pertence a outro usuário.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '404': { description: 'Registro não encontrado.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
      delete: {
        tags: ['Histórico de Progresso'],
        summary: 'Remover registro de progresso',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '204': { description: 'Registro de progresso removido com sucesso.' },
          '401': { description: 'Não autenticado.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '403': { description: 'Registro pertence a outro usuário.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '404': { description: 'Registro não encontrado.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/journeys/{id}/builds': {
      get: {
        tags: ['Builds de Personagens'],
        summary: 'Listar builds associadas a uma jornada',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, description: 'UUID da jornada' }],
        responses: {
          '200': {
            description: 'Lista de builds retornada com sucesso.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    data: { type: 'array', items: { $ref: '#/components/schemas/GameBuild' } },
                  },
                },
              },
            },
          },
          '401': { description: 'Não autenticado.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '403': { description: 'Jornada pertence a outro usuário.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '404': { description: 'Jornada não encontrada.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
      post: {
        tags: ['Builds de Personagens'],
        summary: 'Criar uma build para a jornada',
        description: 'Cria uma build com estrutura flexível para attributes e equipment (JSON validado com limite de tamanho e chaves livres para diferentes gêneros de jogos).',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, description: 'UUID da jornada' }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateGameBuildRequest' } } },
        },
        responses: {
          '201': {
            description: 'Build criada com sucesso.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { status: { type: 'string', example: 'success' }, message: { type: 'string' }, data: { $ref: '#/components/schemas/GameBuild' } },
                },
              },
            },
          },
          '400': { description: 'Dados inválidos ou JSON acima do limite permitido.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '401': { description: 'Não autenticado.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '403': { description: 'Jornada pertence a outro usuário.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '404': { description: 'Jornada não encontrada.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/builds/{id}': {
      get: {
        tags: ['Builds de Personagens'],
        summary: 'Consultar detalhes de uma build',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': {
            description: 'Build retornada com sucesso.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { status: { type: 'string', example: 'success' }, data: { $ref: '#/components/schemas/GameBuild' } },
                },
              },
            },
          },
          '401': { description: 'Não autenticado.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '403': { description: 'Build pertence a outro usuário.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '404': { description: 'Build não encontrada.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
      patch: {
        tags: ['Builds de Personagens'],
        summary: 'Atualizar build existente',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateGameBuildRequest' } } },
        },
        responses: {
          '200': {
            description: 'Build atualizada com sucesso.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { status: { type: 'string', example: 'success' }, message: { type: 'string' }, data: { $ref: '#/components/schemas/GameBuild' } },
                },
              },
            },
          },
          '400': { description: 'Dados inválidos.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '401': { description: 'Não autenticado.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '403': { description: 'Build pertence a outro usuário.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '404': { description: 'Build não encontrada.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
      delete: {
        tags: ['Builds de Personagens'],
        summary: 'Remover build',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '204': { description: 'Build removida com sucesso.' },
          '401': { description: 'Não autenticado.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '403': { description: 'Build pertence a outro usuário.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '404': { description: 'Build não encontrada.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
  },
};
