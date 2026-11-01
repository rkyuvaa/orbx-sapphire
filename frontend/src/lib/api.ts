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
    let message = 'An unexpected error occurred';
    if (typeof data?.detail === 'string') {
      message = data.detail;
    } else if (Array.isArray(data?.detail)) {
      const phoneErr = data.detail.find((e: any) =>
        e.loc?.includes('phone_number') ||
        e.loc?.includes('phone') ||
        /phone|mobile/i.test(e.msg || '')
      );
      if (phoneErr) {
        message = 'Please check the Mobile number';
      } else {
        const msgs = data.detail.map((e: any) => {
          if (typeof e === 'string') return e;
          if (e.msg) {
            return String(e.msg).replace(/^Value error,\s*/i, '');
          }
          return typeof e === 'object' ? JSON.stringify(e) : String(e);
        });
        message = msgs.join(', ');
      }
    } else if (typeof data?.message === 'string') {
      message = data.message;
    }
    throw new ApiError(response.status, message, data);
  }

  return data as T;
}
