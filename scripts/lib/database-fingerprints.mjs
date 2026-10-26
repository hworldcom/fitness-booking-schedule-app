// Reject unusable preservation evidence before comparing snapshots. In
// particular, equal sets of NULL hashes do not establish unchanged data.
export function verifiedDatabaseFingerprints(snapshot) {
  let hashes;
  try {
    hashes = JSON.parse(snapshot);
  } catch {
    throw Error("Database fingerprints are invalid.");
  }
  if (
    !hashes ||
    typeof hashes !== "object" ||
    Array.isArray(hashes) ||
    Object.keys(hashes).length === 0 ||
    Object.entries(hashes).some(
      ([table, hash]) =>
        !/^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$/.test(table) ||
        typeof hash !== "string" ||
        !/^[a-f0-9]{32}$/.test(hash),
    )
  )
    throw Error("Database fingerprints are invalid.");
  return snapshot;
}
