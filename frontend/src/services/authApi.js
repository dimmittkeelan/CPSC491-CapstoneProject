const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

function resolveUrl(path) {
  if (!API_BASE_URL) return path;
  return `${API_BASE_URL}${path}`;
}

async function postJson(path, payload) {
  const response = await fetch(resolveUrl(path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok || !data?.ok) {
    throw new Error(data?.error || "Request failed");
  }

  return data;
}

async function patchJson(path, payload) {
  const response = await fetch(resolveUrl(path), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok || !data?.ok) {
    throw new Error(data?.error || "Request failed");
  }

  return data;
}

export async function getCurrentUser() {
  const response = await fetch(resolveUrl("/auth/me"), {
    method: "GET",
    credentials: "include",
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (response.status === 401) {
    return null;
  }

  if (!response.ok || !data?.ok) {
    throw new Error(data?.error || "Unable to load current user");
  }

  return data.user;
}

export function register(email, password, options = {}) {
  const { marketingOptIn = false } = options;
  return postJson("/auth/register", { email, password, marketingOptIn });
}

export function login(email, password) {
  return postJson("/auth/login", { email, password });
}

export async function logout() {
  const response = await fetch(resolveUrl("/auth/logout"), {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) throw new Error("Logout failed");
}

export async function updateEmail(currentPassword, newEmail) {
  return patchJson("/auth/account/email", { currentPassword, newEmail });
}

export async function updatePassword(currentPassword, newPassword) {
  return patchJson("/auth/account/password", { currentPassword, newPassword });
}

export async function deleteAccount(currentPassword) {
  const response = await fetch(resolveUrl("/auth/account"), {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ currentPassword, confirmDelete: true }),
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok || !data?.ok) {
    throw new Error(data?.error || "Unable to delete account");
  }

  return data;
}