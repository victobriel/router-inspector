export class StorageService {
	public static async save(key: string, value: unknown): Promise<void> {
		await chrome.storage.local.set({ [key]: value });
	}
	
	public static async get<T>(key: string): Promise<T | null> {
		const result = await chrome.storage.local.get(key);
		const value = result[key] as T | undefined;
		return value ?? null;
	}

	public static async remove(key: string): Promise<void> {
		await chrome.storage.local.remove(key);
	}

	public static async clear(): Promise<void> {
		await chrome.storage.local.clear();
	}
}
