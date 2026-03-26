export const api = {
  async get(url: string, token?: string) {
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
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
      throw new Error(errorMsg);
    }
    return res.json();
  },

  async post(url: string, body: any, token?: string) {
    const res = await fetch(url, {
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
      throw new Error(errorMsg);
    }
    return res.json();
  },

  async delete(url: string, token: string) {
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
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
      throw new Error(errorMsg);
    }
    return res.json();
  }
};
