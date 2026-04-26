const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

function resolveUrl(path) {
  if (!API_BASE_URL) return path;
  return `${API_BASE_URL}${path}`;
}

async function requestJson(path, options = {}) {
  const response = await fetch(resolveUrl(path), {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
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

export async function fetchSavedBuilds() {
  const data = await requestJson("/builds/mine", { method: "GET" });
  return data.builds ?? [];
}

export async function createSavedBuild(build) {
  const data = await requestJson("/builds", {
    method: "POST",
    body: JSON.stringify(build),
  });

  return data.build;
}

export async function deleteSavedBuild(buildId) {
  const data = await requestJson(`/builds/${buildId}`, {
    method: "DELETE",
  });

  return data;
}

export async function fetchParts() {
  const data = await requestJson("/api/parts", { method: "GET"});
  return data.parts ?? {};
}

export async function fetchRecommendation(budget) {
  const data = await requestJson("/api/recommend", {
    method: "POST",
    body: JSON.stringify({ budget }),
  });
  return data;
}

