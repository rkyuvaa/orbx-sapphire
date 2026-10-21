const API_BASE = '/api/v1';

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('orbx_token');
  const activeCompanyId = localStorage.getItem('orbx_active_company_id');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (activeCompanyId) {
    headers['X-Company-ID'] = activeCompanyId;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 204) {
    return {} as T;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('orbx_token');
      if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/activate')) {
        window.location.href = '/login';
      }
    }
    const message = data?.detail || 'An unexpected error occurred';
    throw new ApiError(response.status, message, data);
  }

  return data as T;
}
