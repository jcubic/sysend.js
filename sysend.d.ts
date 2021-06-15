/**@license
 *  sysend.js - send messages between browser windows/tabs version 1.5.0
 *
 *  Copyright (C) 2014-2021 Jakub T. Jankiewicz <https://jakub.jankiewicz.org>
 *  Released under the MIT license
 *
 */
type callback = (message: any, event: string) => void;

interface Sysend {
    broadcast(event: string, message?: any): void;
    emit(event: string, message?: any): void;
    on(event: string, callback: callback): void;
    off(event: string, callback?: callback): void;
    proxy(url: string): void;
    serializer(to: (data: any) => string, from: (data: string) => any): void;
}

declare const sysend: Sysend;

export default sysend;
