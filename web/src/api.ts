async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    headers: options.body && typeof options.body === 'string' ? { 'Content-Type': 'application/json' } : undefined,
    credentials: 'same-origin',
    ...options,
  });
  if (!res.ok) {
    let message = `Lỗi ${res.status}`;
    try {
      const data = await res.json();
      message = data.error || message;
    } catch { /* giữ message mặc định */ }
    const err = new Error(message) as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export const api = {
  get: <T>(url: string) => request<T>(url),
  post: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(url: string) => request<T>(url, { method: 'DELETE' }),

  /** Upload multipart với callback tiến trình gửi file lên server. */
  uploadBatch(files: File[], payload: unknown, onProgress: (pct: number) => void): Promise<{ ok: boolean; batchId: number; jobCount: number }> {
    return new Promise((resolve, reject) => {
      const form = new FormData();
      for (const f of files) form.append('files', f);
      form.append('payload', JSON.stringify(payload));
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/uploads');
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) resolve(data);
          else reject(new Error(data.error || `Lỗi ${xhr.status}`));
        } catch {
          reject(new Error(`Lỗi ${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error('Mất kết nối tới server'));
      xhr.send(form);
    });
  },
};
