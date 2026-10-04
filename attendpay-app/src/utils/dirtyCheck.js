/**
 * Zero-Bleed Dirty State Validator
 * Compares current form/state against the original baseline object.
 * Prevents redundant database UPDATE/UPSERT network requests when no actual changes exist.
 */

export function isDeepEqual(objA, objB) {
  if (objA === objB) return true;
  if (objA == null || objB == null) return false;
  if (typeof objA !== 'object' || typeof objB !== 'object') return false;

  // Handle Dates
  if (objA instanceof Date && objB instanceof Date) {
    return objA.getTime() === objB.getTime();
  }

  // Handle Arrays
  if (Array.isArray(objA) && Array.isArray(objB)) {
    if (objA.length !== objB.length) return false;
    for (let i = 0; i < objA.length; i++) {
      if (!isDeepEqual(objA[i], objB[i])) return false;
    }
    return true;
  }
  if (Array.isArray(objA) || Array.isArray(objB)) return false;

  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(objB, key)) return false;
    if (!isDeepEqual(objA[key], objB[key])) return false;
  }

  return true;
}

/**
 * Returns an object containing ONLY modified properties, or null if identical.
 * @param {Record<string, any>} original - Baseline database state
 * @param {Record<string, any>} current - Modified client state
 * @param {string[]} [ignoredKeys] - Keys to skip during comparison (e.g. ['updated_at'])
 * @returns {Record<string, any> | null}
 */
export function getDirtyDiff(original, current, ignoredKeys = ['updated_at']) {
  if (!original || typeof original !== 'object') return current;
  if (!current || typeof current !== 'object') return null;

  const diff = {};
  let hasDiff = false;

  for (const [key, val] of Object.entries(current)) {
    if (ignoredKeys.includes(key)) continue;

    const originalVal = original[key];
    if (!isDeepEqual(originalVal, val)) {
      diff[key] = val;
      hasDiff = true;
    }
  }

  return hasDiff ? diff : null;
}
