const TTL_PREFIX = "__ttl:";
const VALUE_KEY = "__v";

function isTtlEntry(raw: unknown): raw is { [VALUE_KEY]: unknown; [key: string]: unknown } {
	return (
		typeof raw === "object" &&
		raw !== null &&
		VALUE_KEY in raw &&
		TTL_PREFIX + "expiresAt" in raw
	);
}

export class StorageService {
	/**
	 * @param key - Storage key
	 * @param value - Value to store (must be JSON-serializable)
	 * @param ttlMs - Optional time-to-live in milliseconds; entry is removed after this time
	 */
	public static async save(key: string, value: unknown, ttlMs?: number): Promise<void> {
		if (ttlMs == null || ttlMs <= 0) {
			await chrome.storage.local.set({ [key]: value });
			return;
		}
		const expiresAt = Date.now() + ttlMs;
		await chrome.storage.local.set({
			[key]: { [VALUE_KEY]: value, [TTL_PREFIX + "expiresAt"]: expiresAt },
		});
	}

	public static async get<T>(key: string): Promise<T | null> {
		const result = await chrome.storage.local.get(key);
		const raw = result[key] as unknown;
		if (raw === undefined) return null;

		if (isTtlEntry(raw)) {
			const expiresAt = raw[TTL_PREFIX + "expiresAt"] as number;
			if (Date.now() >= expiresAt) {
				await chrome.storage.local.remove(key);
				return null;
			}
			return raw[VALUE_KEY] as T;
		}

		return raw as T;
	}

	public static async remove(key: string): Promise<void> {
		await chrome.storage.local.remove(key);
	}

	public static async clear(): Promise<void> {
		await chrome.storage.local.clear();
	}
}
