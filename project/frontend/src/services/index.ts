import apiClient from "./api";

// ===== Auth =====
export const authApi = {
  register: (data: { username: string; email: string; password: string }) =>
    apiClient.post("/auth/register", data),
  login: (data: { email: string; password: string }) =>
    apiClient.post("/auth/login", data),
  getProfile: () => apiClient.get("/auth/profile"),
  updateProfile: (data: { username?: string; avatar_url?: string }) =>
    apiClient.put("/auth/profile", data),
};

// ===== Platforms =====
export const platformApi = {
  getAccounts: () => apiClient.get("/platforms"),
  getAuthUrl: (platform: string) => apiClient.get("/platforms/auth-url/" + platform),
  deleteAccount: (id: number) => apiClient.delete("/platforms/" + id),
  checkConfig: (platform: string) => apiClient.get("/platforms/check-config/" + platform),
  bindBilibili: (data: { sessdata: string; bili_jct: string; dedeuserid?: string }) =>
    apiClient.post("/platforms/bind-bilibili", data),
  bindDouyin: (data: { cookie: string }) =>
    apiClient.post("/platforms/bind-douyin", data),
  bindDouyinFull: (data: { cookie: string; tokens?: { privateKey: string; webProtect: string }; nickname?: string; uid?: string }) =>
    apiClient.post("/platforms/bind-douyin-full", data),
  douyinQrLogin: () =>
    apiClient.post("/platforms/douyin-login", {}, { timeout: 300000 }),
  bindKuaishou: (data: { cookie: string; did: string }) =>
    apiClient.post("/platforms/bind-kuaishou", data),
};

// ===== Publish =====
export const publishApi = {
  createTask: (data: any) => apiClient.post("/publish", data),
  getTasks: (params?: { page?: number; limit?: number; status?: string }) =>
    apiClient.get("/publish", { params }),
  getTaskById: (id: number) => apiClient.get("/publish/" + id),
  getTaskStats: (id: number) => apiClient.get("/publish/" + id + "/stats"),
  deleteTask: (id: number) => apiClient.delete("/publish/" + id),
  retryTask: (id: number) => apiClient.post("/publish/" + id + "/retry"),
};

// ===== Traffic =====
export const trafficApi = {
  getDashboard: () => apiClient.get("/traffic/dashboard"),
  getHotTopics: (params?: { platform?: string; limit?: number }) =>
    apiClient.get("/traffic/hot-topics", { params }),
  refreshHotTopics: () => apiClient.post("/traffic/hot-topics/refresh"),
  getBestTime: (params?: { platform?: string }) =>
    apiClient.get("/traffic/best-time", { params }),
  getSuggestions: (params?: { type?: string }) =>
    apiClient.get("/traffic/suggestions", { params }),
};

// ===== AI =====
export const aiApi = {
  generateScript: (data: { topic: string; style: string; duration?: number; platform?: string; model?: string }) =>
    apiClient.post("/ai/generate-script", data),
  generateTitles: (data: { topic: string; style?: string; count?: number; platform?: string; model?: string }) =>
    apiClient.post("/ai/generate-titles", data),
  generateTags: (data: { title: string; description?: string; platform?: string; model?: string }) =>
    apiClient.post("/ai/generate-tags", data),
  generateDescription: (data: { topic: string; platform?: string; model?: string }) =>
    apiClient.post("/ai/generate-description", data),
  generateCoverPrompt: (data: { topic: string; style?: string; model?: string }) =>
    apiClient.post("/ai/generate-cover-prompt", data),
    optimizeTopic: (data: { keywords: string; platform?: string; model?: string }) =>
    apiClient.post("/ai/optimize-topic", data),
getHistory: (params?: { type?: string }) =>
    apiClient.get("/ai/history", { params }),
};

// ===== Settings =====
export const settingsApi = {
  get: () => apiClient.get("/settings"),
  update: (data: { ai_api_url?: string; ai_api_key?: string; ai_model?: string; ai_available_models?: string[] }) =>
    apiClient.put("/settings", data),
  testAi: (data: { ai_api_url: string; ai_api_key: string }) =>
    apiClient.post("/settings/test-ai", data),
  fetchModels: (data: { ai_api_url: string; ai_api_key: string }) =>
    apiClient.post("/settings/fetch-models", data),
};

// ===== Upload =====
export const uploadApi = {
  upload: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// ===== Calendar =====
export const calendarApi = {
  getEvents: (startDate: string, endDate: string) =>
    apiClient.get("/calendar", { params: { start_date: startDate, end_date: endDate } }),
  createEvent: (data: any) => apiClient.post("/calendar", data),
  updateEvent: (id: number, data: any) => apiClient.put("/calendar/" + id, data),
  deleteEvent: (id: number) => apiClient.delete("/calendar/" + id),
};
