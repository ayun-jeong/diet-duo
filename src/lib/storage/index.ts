import { LocalStorageAdapter } from "./LocalStorageAdapter";
import type { StorageAdapter } from "./StorageAdapter";

let _current: StorageAdapter = new LocalStorageAdapter();

/** 로그인/로그아웃 시 어댑터 교체 */
export function setStorage(adapter: StorageAdapter): void {
  _current = adapter;
}

export function getStorage(): StorageAdapter {
  return _current;
}

/**
 * 항상 현재 어댑터로 위임하는 프록시.
 * 호출부는 `storage.getDayLog(...)` 처럼 쓰고, 교체 시점을 신경 쓰지 않는다.
 */
export const storage = new Proxy({} as StorageAdapter, {
  get(_, prop: string) {
    return (...args: unknown[]) =>
      (_current as unknown as Record<string, (...a: unknown[]) => unknown>)[prop](
        ...args,
      );
  },
});

export type { StorageAdapter, BootstrapData } from "./StorageAdapter";
export { ApiAdapter, DbUnavailableError } from "./ApiAdapter";
export { LocalStorageAdapter };
