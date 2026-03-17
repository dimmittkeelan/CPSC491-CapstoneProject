const STORAGE_KEY = "pc-builder:saved-builds:v1";

function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return parsed;
  } catch {
    return {};
  }
}

function writeStore(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function getUserStorageKey(user) {
  if (!user) return null;
  if (user.id !== undefined && user.id !== null) return `user:${user.id}`;
  if (typeof user.email === "string" && user.email.trim()) {
    return `email:${user.email.toLowerCase()}`;
  }
  return null;
}

export function getSavedBuildsForUser(user) {
  const key = getUserStorageKey(user);
  if (!key) return [];

  const store = readStore();
  const builds = store[key];

  if (!Array.isArray(builds)) {
    return [];
  }

  return builds;
}

export function saveBuildForUser(user, build) {
  const key = getUserStorageKey(user);
  if (!key) throw new Error("Cannot save build without a user identifier");

  const nextBuild = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...build,
  };

  const store = readStore();
  const current = Array.isArray(store[key]) ? store[key] : [];
  store[key] = [nextBuild, ...current];
  writeStore(store);

  return nextBuild;
}

export function removeSavedBuildForUser(user, buildId) {
  const key = getUserStorageKey(user);
  if (!key) return;

  const store = readStore();
  const current = Array.isArray(store[key]) ? store[key] : [];
  store[key] = current.filter((build) => build.id !== buildId);
  writeStore(store);
}
