/**@license
 *  sysend.js - send messages between browser windows/tabs version 1.4.0
 *
 *  Copyright (C) 2014-2021 Jakub T. Jankiewicz <https://jcubic.pl/me>
 *  Released under the MIT license
 *
 */
export type Message = string | Record<string, unknown> | number;

type callback = (message: Message, event: string) => void;

interface Sysend {
    broadcast(event: string, message?: Message): void;
    on(event: string, callback: callback): void;
    off(event: string, callback?: callback): void;
    proxy(url: string): void;
    serializer(to: (data: any) => string, from: (data: string) => any): void;
}

declare const sysend: Sysend;

export default sysend;
