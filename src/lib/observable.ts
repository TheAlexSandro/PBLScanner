import { useSyncExternalStore } from "react";

export class Observable<T> {
  private listeners = new Set<() => void>();
  private _value: T;

  constructor(initial: T) {
    this._value = initial;
  }

  get value(): T {
    return this._value;
  }

  set value(next: T) {
    if (Object.is(next, this._value)) return;
    this._value = next;
    this.listeners.forEach((l) => l());
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): T => this._value;
}

export function useObservable<T>(o: Observable<T>): T {
  return useSyncExternalStore(o.subscribe, o.getSnapshot);
}
