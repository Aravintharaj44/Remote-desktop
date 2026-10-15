const API_URL = import.meta.env.VITE_API_URL;

export async function registerUser(details) {
    return request("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(details),
    });
}

export async function loginUser(details) {
    return request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(details),
    });
}
/*  */
export const listDevices = (token) => request("/api/devices", { headers: { Authorization: `Bearer ${token}` } });
export const createDevice = (token, d) => request("/api/devices", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(d) });
async function request(path, options = {}) {
    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...options.headers,
        },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.message || "Request failed");
    }

    return data;
}