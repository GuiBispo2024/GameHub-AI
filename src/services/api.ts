import {
  HealthResponse,
  User,
  UserPreference,
  LibraryEntry,
  LibraryPagination,
  LibraryStats,
  LibraryStatus,
  LibrarySortOption,
  GameplayJourney,
  ProgressLogItem,
  GameBuildItem,
  JourneyStatus,
} from '../types';

export class ApiService {
  private static baseUrl = '/api';
  private static inMemoryToken: string | null = null;

  static setToken(token: string | null) {
    this.inMemoryToken = token;
  }

  static getToken(): string | null {
    return this.inMemoryToken;
  }

  private static getHeaders(customHeaders: Record<string, string> = {}): HeadersInit {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...customHeaders,
    };

    if (this.inMemoryToken) {
      headers['Authorization'] = `Bearer ${this.inMemoryToken}`;
    }

    return headers;
  }

  static async getHealth(): Promise<HealthResponse> {
    const response = await fetch(`${this.baseUrl}/health`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Health check failed with status: ${response.status}`);
    }
    return response.json();
  }

  // Auth Endpoints
  static async register(data: {
    username: string;
    email: string;
    password: string;
    confirmPassword: string;
  }): Promise<{ user: User; token: string }> {
    const res = await fetch(`${this.baseUrl}/auth/register`, {
      method: 'POST',
      headers: this.getHeaders(),
      credentials: 'include',
      body: JSON.stringify(data),
    });

    const json = await res.json();
    if (!res.ok) {
      const errorMsg = json.errors
        ? Object.values(json.errors).flat().join(', ')
        : json.message || 'Erro ao realizar cadastro';
      throw new Error(errorMsg);
    }

    if (json.token) {
      this.setToken(json.token);
    }

    return { user: json.user, token: json.token };
  }

  static async login(data: {
    email: string;
    password: string;
  }): Promise<{ user: User; token: string }> {
    const res = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: this.getHeaders(),
      credentials: 'include',
      body: JSON.stringify(data),
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || 'Credenciais inválidas.');
    }

    if (json.token) {
      this.setToken(json.token);
    }

    return { user: json.user, token: json.token };
  }

  static async logout(): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/auth/logout`, {
        method: 'POST',
        headers: this.getHeaders(),
        credentials: 'include',
      });
    } finally {
      this.setToken(null);
    }
  }

  static async getMe(): Promise<User> {
    const res = await fetch(`${this.baseUrl}/auth/me`, {
      headers: this.getHeaders(),
      credentials: 'include',
    });

    if (!res.ok) {
      throw new Error('Sessão expirada ou não autenticado.');
    }

    const json = await res.json();
    return json.user;
  }

  // Profile and Preferences Endpoints
  static async updateProfile(data: {
    username?: string;
    bio?: string | null;
    avatarUrl?: string | null;
  }): Promise<User> {
    const res = await fetch(`${this.baseUrl}/users/me`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      credentials: 'include',
      body: JSON.stringify(data),
    });

    const json = await res.json();
    if (!res.ok) {
      const errorMsg = json.errors
        ? Object.values(json.errors).flat().join(', ')
        : json.message || 'Erro ao atualizar perfil.';
      throw new Error(errorMsg);
    }

    return json.user;
  }

  static async getPreferences(): Promise<UserPreference> {
    const res = await fetch(`${this.baseUrl}/users/me/preferences`, {
      headers: this.getHeaders(),
      credentials: 'include',
    });

    if (!res.ok) {
      throw new Error('Erro ao carregar preferências.');
    }

    const json = await res.json();
    return json.preferences;
  }

  static async updatePreferences(data: Partial<UserPreference>): Promise<UserPreference> {
    const res = await fetch(`${this.baseUrl}/users/me/preferences`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      credentials: 'include',
      body: JSON.stringify(data),
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || 'Erro ao salvar preferências.');
    }

    return json.preferences;
  }

  // Personal Game Library Endpoints
  static async getLibrary(params: {
    status?: LibraryStatus;
    genre?: string;
    platform?: string;
    search?: string;
    sort?: LibrarySortOption;
    page?: number;
    limit?: number;
  } = {}): Promise<{ data: LibraryEntry[]; pagination: LibraryPagination }> {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.genre) query.set('genre', params.genre);
    if (params.platform) query.set('platform', params.platform);
    if (params.search) query.set('search', params.search);
    if (params.sort) query.set('sort', params.sort);
    if (params.page) query.set('page', params.page.toString());
    if (params.limit) query.set('limit', params.limit.toString());

    const qs = query.toString();
    const res = await fetch(`${this.baseUrl}/library${qs ? `?${qs}` : ''}`, {
      headers: this.getHeaders(),
      credentials: 'include',
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err: any = new Error(json.message || 'Erro ao carregar biblioteca pessoal.');
      err.status = res.status;
      err.code = json.code;
      throw err;
    }

    return {
      data: json.data || [],
      pagination: json.pagination,
    };
  }

  static async getLibraryStats(): Promise<LibraryStats> {
    const res = await fetch(`${this.baseUrl}/library/stats`, {
      headers: this.getHeaders(),
      credentials: 'include',
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err: any = new Error(json.message || 'Erro ao carregar estatísticas da biblioteca.');
      err.status = res.status;
      err.code = json.code;
      throw err;
    }

    return json.data;
  }

  static async addToLibrary(payload: {
    gameId: string;
    status?: LibraryStatus;
    rating?: number | null;
    hoursPlayed?: number;
    notes?: string | null;
  }): Promise<LibraryEntry> {
    const res = await fetch(`${this.baseUrl}/library`, {
      method: 'POST',
      headers: this.getHeaders(),
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err: any = new Error(json.message || 'Erro ao adicionar jogo à biblioteca.');
      err.status = res.status;
      err.code = json.code;
      err.existingEntryId = json.existingEntryId;
      throw err;
    }

    return json.data;
  }

  static async getLibraryEntry(id: string): Promise<LibraryEntry> {
    const res = await fetch(`${this.baseUrl}/library/${id}`, {
      headers: this.getHeaders(),
      credentials: 'include',
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err: any = new Error(json.message || 'Erro ao carregar detalhes do jogo na biblioteca.');
      err.status = res.status;
      err.code = json.code;
      throw err;
    }

    return json.data;
  }

  static async updateLibraryEntry(
    id: string,
    payload: {
      status?: LibraryStatus;
      rating?: number | null;
      hoursPlayed?: number;
      notes?: string | null;
    }
  ): Promise<LibraryEntry> {
    const res = await fetch(`${this.baseUrl}/library/${id}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errMsg = json.errors
        ? Object.values(json.errors).flat().join(', ')
        : json.message || 'Erro ao atualizar jogo na biblioteca.';
      const err: any = new Error(errMsg);
      err.status = res.status;
      err.code = json.code;
      throw err;
    }

    return json.data;
  }

  static async removeFromLibrary(id: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/library/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
      credentials: 'include',
    });

    if (!res.ok && res.status !== 204) {
      const json = await res.json().catch(() => ({}));
      const err: any = new Error(json.message || 'Erro ao remover jogo da biblioteca.');
      err.status = res.status;
      err.code = json.code;
      throw err;
    }
  }

  // Gameplay Journeys Endpoints
  static async getJourneys(params: {
    userGameId?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
  } = {}): Promise<{ data: GameplayJourney[]; pagination: LibraryPagination }> {
    const query = new URLSearchParams();
    if (params.userGameId) query.set('userGameId', params.userGameId);
    if (params.isActive !== undefined) query.set('isActive', String(params.isActive));
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));

    const qs = query.toString();
    const res = await fetch(`${this.baseUrl}/journeys${qs ? `?${qs}` : ''}`, {
      headers: this.getHeaders(),
      credentials: 'include',
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err: any = new Error(json.message || 'Erro ao carregar jornadas.');
      err.status = res.status;
      err.code = json.code;
      throw err;
    }

    return {
      data: json.data || [],
      pagination: json.pagination,
    };
  }

  static async createJourney(payload: {
    userGameId: string;
    name: string;
    characterName?: string | null;
    characterClass?: string | null;
    currentLevel?: number | null;
    currentArea?: string | null;
    currentObjective?: string | null;
    playtimeHours?: number;
    isCompleted?: boolean;
    isActive?: boolean;
    notes?: string | null;
  }): Promise<GameplayJourney> {
    const res = await fetch(`${this.baseUrl}/journeys`, {
      method: 'POST',
      headers: this.getHeaders(),
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errMsg = json.errors
        ? Object.values(json.errors).flat().join(', ')
        : json.message || 'Erro ao criar jornada.';
      const err: any = new Error(errMsg);
      err.status = res.status;
      err.code = json.code;
      throw err;
    }

    return json.data;
  }

  static async updateJourney(
    id: string,
    payload: {
      name?: string;
      characterName?: string | null;
      characterClass?: string | null;
      currentLevel?: number | null;
      currentArea?: string | null;
      currentObjective?: string | null;
      playtimeHours?: number;
      isCompleted?: boolean;
      status?: JourneyStatus;
      notes?: string | null;
    }
  ): Promise<GameplayJourney> {
    const res = await fetch(`${this.baseUrl}/journeys/${id}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errMsg = json.errors
        ? Object.values(json.errors).flat().join(', ')
        : json.message || 'Erro ao atualizar jornada.';
      const err: any = new Error(errMsg);
      err.status = res.status;
      err.code = json.code;
      throw err;
    }

    return json.data;
  }

  static async activateJourney(id: string): Promise<GameplayJourney> {
    const res = await fetch(`${this.baseUrl}/journeys/${id}/activate`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      credentials: 'include',
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err: any = new Error(json.message || 'Erro ao ativar jornada.');
      err.status = res.status;
      err.code = json.code;
      throw err;
    }

    return json.data;
  }

  static async deleteJourney(id: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/journeys/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
      credentials: 'include',
    });

    if (!res.ok && res.status !== 204) {
      const json = await res.json().catch(() => ({}));
      const err: any = new Error(json.message || 'Erro ao excluir jornada.');
      err.status = res.status;
      err.code = json.code;
      throw err;
    }
  }

  // Progress Logs Endpoints
  static async getJourneyProgress(journeyId: string): Promise<ProgressLogItem[]> {
    const res = await fetch(`${this.baseUrl}/journeys/${journeyId}/progress`, {
      headers: this.getHeaders(),
      credentials: 'include',
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err: any = new Error(json.message || 'Erro ao carregar histórico de progresso.');
      err.status = res.status;
      err.code = json.code;
      throw err;
    }

    return json.data || [];
  }

  static async createProgressLog(
    journeyId: string,
    payload: {
      areaName?: string | null;
      questName?: string | null;
      description: string;
      completionPercent?: number | null;
      hoursPlayedAtPoint?: number;
      playerLevelAtPoint?: number | null;
    }
  ): Promise<ProgressLogItem> {
    const res = await fetch(`${this.baseUrl}/journeys/${journeyId}/progress`, {
      method: 'POST',
      headers: this.getHeaders(),
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errMsg = json.errors
        ? Object.values(json.errors).flat().join(', ')
        : json.message || 'Erro ao registrar progresso.';
      const err: any = new Error(errMsg);
      err.status = res.status;
      err.code = json.code;
      throw err;
    }

    return json.data;
  }

  static async updateProgressLog(
    progressId: string,
    payload: {
      areaName?: string | null;
      questName?: string | null;
      description?: string;
      completionPercent?: number | null;
      hoursPlayedAtPoint?: number;
      playerLevelAtPoint?: number | null;
    }
  ): Promise<ProgressLogItem> {
    const res = await fetch(`${this.baseUrl}/progress/${progressId}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errMsg = json.errors
        ? Object.values(json.errors).flat().join(', ')
        : json.message || 'Erro ao atualizar registro de progresso.';
      const err: any = new Error(errMsg);
      err.status = res.status;
      err.code = json.code;
      throw err;
    }

    return json.data;
  }

  static async deleteProgressLog(progressId: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/progress/${progressId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
      credentials: 'include',
    });

    if (!res.ok && res.status !== 204) {
      const json = await res.json().catch(() => ({}));
      const err: any = new Error(json.message || 'Erro ao excluir registro de progresso.');
      err.status = res.status;
      err.code = json.code;
      throw err;
    }
  }

  // Builds Endpoints
  static async getJourneyBuilds(journeyId: string): Promise<GameBuildItem[]> {
    const res = await fetch(`${this.baseUrl}/journeys/${journeyId}/builds`, {
      headers: this.getHeaders(),
      credentials: 'include',
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err: any = new Error(json.message || 'Erro ao carregar builds da jornada.');
      err.status = res.status;
      err.code = json.code;
      throw err;
    }

    return json.data || [];
  }

  static async createBuild(
    journeyId: string,
    payload: {
      name: string;
      description?: string | null;
      playstyle?: string | null;
      attributes?: Record<string, unknown>;
      equipment?: Record<string, unknown>;
      notes?: string | null;
    }
  ): Promise<GameBuildItem> {
    const res = await fetch(`${this.baseUrl}/journeys/${journeyId}/builds`, {
      method: 'POST',
      headers: this.getHeaders(),
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errMsg = json.errors
        ? Object.values(json.errors).flat().join(', ')
        : json.message || 'Erro ao criar build.';
      const err: any = new Error(errMsg);
      err.status = res.status;
      err.code = json.code;
      throw err;
    }

    return json.data;
  }

  static async updateBuild(
    buildId: string,
    payload: {
      name?: string;
      description?: string | null;
      playstyle?: string | null;
      attributes?: Record<string, unknown>;
      equipment?: Record<string, unknown>;
      notes?: string | null;
    }
  ): Promise<GameBuildItem> {
    const res = await fetch(`${this.baseUrl}/builds/${buildId}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errMsg = json.errors
        ? Object.values(json.errors).flat().join(', ')
        : json.message || 'Erro ao atualizar build.';
      const err: any = new Error(errMsg);
      err.status = res.status;
      err.code = json.code;
      throw err;
    }

    return json.data;
  }

  static async deleteBuild(buildId: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/builds/${buildId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
      credentials: 'include',
    });

    if (!res.ok && res.status !== 204) {
      const json = await res.json().catch(() => ({}));
      const err: any = new Error(json.message || 'Erro ao excluir build.');
      err.status = res.status;
      err.code = json.code;
      throw err;
    }
  }
}
