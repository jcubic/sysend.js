/**@license
 *  sysend.js - send messages between browser windows/tabs version 1.16.0
 *
 *  Copyright (C) 2014-2023 Jakub T. Jankiewicz <https://jcubic.pl/me>
 *  Released under the MIT license
 *
 */
type callback = (message: unknown, event: string) => void;

interface Sysend {
    id: string;
    broadcast(event: string, data?: unknown): void;
    emit(event: string, data?: unknown): void;
    on(event: string, callback: callback): void;
    off(event: string, callback?: callback): void;
    proxy(...args: string[]): void;
    serializer(to: (data: unknown) => string, from: (data: string) => unknown): void;
    track(event: 'open', callback: (data: {id: string, count: number, primary: boolean}) => void): void;
    track(event: 'close', callback: (data: {id: string, count: number, primary: boolean, self: boolean}) => void): void;
    track(event: 'primary', callback: () => void): void;
    track(event: 'message', callback: (payload: {data: unknown, origin: string}) => void): void;
    track(event: 'secondary', callback: () => void): void;
    track(event: 'update', callback: (payload: Array<{ id: string, primary: boolean }>) => void): void;
    untrack(event: 'open' | 'close' | 'primary' | 'secondary' | 'message' | 'update', fn?: (input?: unknown) => void): void;
    list(): Promise<Array<{ id: string, primary: boolean }>>;
    post(target: string, data?: unknown): void;
    channel(...domains: string[]): void;
    isPrimary(): boolean;
    rpc<T extends Array<unknown>, U>(object: Record<string, (...args: T) => U>): Promise<Record<string, (id: string, ...args: T) => Promise<U>>>
}

//Promise<Record<string, (id: string, ...args: T) => Promise<U>>;

//type RPC<args extend Array


declare const sysend: Sysend;

export default sysend;
