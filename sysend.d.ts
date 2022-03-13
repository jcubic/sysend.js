/**@license
 *  sysend.js - send messages between browser windows/tabs version 1.10.0
 *
 *  Copyright (C) 2014-2022 Jakub T. Jankiewicz <https://jcubic.pl/me>
 *  Released under the MIT license
 *
 */
type callback = (message: any, event: string) => void;

interface Sysend {
    id: string;
    broadcast(event: string, data?: any): void;
    emit(event: string, data?: any): void;
    on(event: string, callback: callback): void;
    off(event: string, callback?: callback): void;
    proxy(url: string): void;
    serializer(to: (data: any) => string, from: (data: string) => any): void;
    track(event: 'open', callback: (data: {id: string, count: number, primary: boolean}) => void): void;
    track(event: 'close', callback: (data: {id: string, count: number, primary: boolean, self: boolean}) => void): void;
    track(event: 'primary', callback: () => void): void;
    track(event: 'message', callback: (payload: {data: any, origin: string}) => void): void;
    track(event: 'secondary', callback: () => void): void;
    untrack(event: 'open' | 'close' | 'primary' | 'secondary' | 'message', fn?: (input?: any) => void): void;
    list(): Promise<Array<{ id: string, primary: boolean }>>;
    post(target: string, data?: any): void;
    channel(...domains: string[]): void;
    isPrimary(): boolean;
}

declare const sysend: Sysend;

export default sysend;
