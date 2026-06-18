import { LocalStorageAdapter } from "./LocalStorageAdapter";
import { SupabaseAdapter } from "./SupabaseAdapter";
import type { StorageAdapter } from "./StorageAdapter";

let _current: StorageAdapter = new LocalStorageAdapter();

/** 로그인/로그아웃 시 어댑터 교체 */
export function setStorage(adapter: StorageAdapter): void {
  _current = adapter;
}

/** 항상 현재 어댑터로 위임하는 프록시 */
export const storage = new Proxy({} as StorageAdapter, {
  get(_, prop: string) {
    return (...args: unknown[]) =>
      (_current as unknown as Record<string, (...a: unknown[]) => unknown>)[prop](...args);
  },
});

export type { StorageAdapter };
export { SupabaseAdapter, LocalStorageAdapter };
