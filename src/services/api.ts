// Determine the API base URL based on environment
const getApiBase = () => {
  // In development, use relative URLs (Vite proxy handles it)
  if (!window.location.hostname.includes('onrender.com') && !window.location.hostname.includes('vercel.app')) {
    return '';
  }
  // In production on Render/Vercel, use current origin
  return window.location.origin;
};

const API_BASE = getApiBase();

const buildUrl = (path: string): string => {
  return `${API_BASE}${path}`;
};

export const api = {
  async get(url: string, token?: string) {
    const fullUrl = buildUrl(url);
    console.log('[API GET]', fullUrl);
    
    const res = await fetch(fullUrl, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
    
    if (!res.ok) {
      const text = await res.text();
      let errorMsg = "Request failed";
      try {
        const data = JSON.parse(text);
        errorMsg = data.error || data.message || errorMsg;
      } catch (e) {
        errorMsg = text || errorMsg;
      }
      console.error('[API ERROR]', fullUrl, res.status, errorMsg);
      throw new Error(errorMsg);
    }
    return res.json();
  },

  async post(url: string, body: any, token?: string) {
    const fullUrl = buildUrl(url);
    console.log('[API POST]', fullUrl);
    
    const res = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(body)
    });
    
    if (!res.ok) {
      const text = await res.text();
      let errorMsg = "Request failed";
      try {
        const data = JSON.parse(text);
        errorMsg = data.error || data.message || errorMsg;
      } catch (e) {
        errorMsg = text || errorMsg;
      }
      console.error('[API ERROR]', fullUrl, res.status, errorMsg);
      throw new Error(errorMsg);
    }
    return res.json();
  },

    if (!res.ok) {
      const text = await res.text();
      let errorMsg = "Request failed";
      try {
        const data = JSON.parse(text);
        errorMsg = data.error || data.message || errorMsg;
      } catch (e) {
        errorMsg = text || errorMsg;
      }
      console.error('[API ERROR]', fullUrl, res.status, errorMsg);
      throw new Error(errorMsg);
    }
    return res.json();
  }
};
