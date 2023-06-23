/**@license
 *  sysend.js - send messages between browser windows/tabs version 1.16.3
 *
 *  Copyright (C) 2014-2023 Jakub T. Jankiewicz <https://jcubic.pl/me>
 *  Released under the MIT license
 *
 */
type callback<T> = (message: T, event: string) => void;

interface Sysend {
    id: string;
    broadcast<T>(event: string, data?: T): void;
    emit(event: string, data?: unknown): void;
    on<T>(event: string, callback: callback<T>): void;
    off<T>(event: string, callback?: callback<T>): void;
    proxy(...args: string[]): void;
    serializer<T>(to: (data: T) => string, from: (data: string) => T): void;
    track(event: 'open', callback: (data: {id: string, count: number, primary: boolean}) => void): void;
    track(event: 'close', callback: (data: {id: string, count: number, primary: boolean, self: boolean}) => void): void;
    track(event: 'primary', callback: () => void): void;
    track<T>(event: 'message', callback: (payload: {data: T, origin: string}) => void): void;
    track(event: 'secondary', callback: () => void): void;
    track(event: 'update', callback: (payload: Array<{ id: string, primary: boolean }>) => void): void;
    untrack(event: 'open' | 'close' | 'primary' | 'secondary' | 'message' | 'update', fn?: (input?: unknown) => void): void;
    list(): Promise<Array<{ id: string, primary: boolean }>>;
    post<T>(target: string, data?: T): void;
    channel(...domains: string[]): void;
    isPrimary(): boolean;
    rpc<T extends Array<unknown>, U>(object: Record<string, (...args: T) => U>): Promise<Record<string, (id: string, ...args: T) => Promise<U>>>
}

//Promise<Record<string, (id: string, ...args: T) => Promise<U>>;

//type RPC<args extend Array


declare const sysend: Sysend;

export default sysend;
