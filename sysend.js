/**@license
 *  sysend.js - send messages between browser windows/tabs version 1.17.2
 *
 *  Copyright (C) 2014-2023 Jakub T. Jankiewicz <https://jcubic.pl/me>
 *  Released under the MIT license
 *
 *  The idea for localStorage implementation came from this StackOverflow question:
 *  http://stackoverflow.com/q/24182409/387194
 *
 */
/* global define, module, exports, localStorage, setTimeout */
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['sysend'], factory);
    } else if (typeof exports === 'object') {
        module.exports = factory();
    } else {
        root.sysend = factory();
    }
})(typeof window !== 'undefined' ? window : this, function() {
    var DEBUG = false;
    var collecting_timeout = 400;
    // we use prefix so `foo' event don't collide with `foo' locaStorage value
    var uniq_prefix = '___sysend___';
    var prefix_re = new RegExp(uniq_prefix, 'g');
    var random_value = Math.random();
    var serializer = {};
    // object with user events as keys and values arrays of callback functions
    var callbacks = {};
    var has_primary;
    var iframes = [];
    var index = 0;
    var proxy_mode = false;
    var channel;
    var primary = true;
    var force_ls = false;
    // we use id because storage event is not executed if message was not
    // changed, and we want it if user send same object twice (before it will
    // be removed)
    var id = 0;
    // identifier for making each call to list unique
    var list_id = 0;
    // Storage Access API handler
    var sa_handle;

    // id of the window/tabAnd two-way communication is tracked in
    var target_id = generate_uuid();
    var target_count = 1;
    var rpc_count = 0;
    var domains;

    var handlers = {
        primary: [],
        close: [],
        open: [],
        secondary: [],
        message: [],
        visbility: [],
        ready: [],
        update: []
    };
    var events = Object.keys(handlers);
    // -------------------------------------------------------------------------
    var serialize = make_process(serializer, 'to');
    var unserialize = make_process(serializer, 'from');
    // -------------------------------------------------------------------------
    var sysend = {
        id: target_id,
        broadcast: function(event, data) {
            if (channel && !force_ls) {
                log('broadcast', { event, data });
                channel.postMessage({name: event, data: serialize(data)});
            } else {
                set(event, to_json(data));
                // clean up localstorage
                setTimeout(function() {
                    remove(event);
                }, 0);
            }
            send_to_iframes(event, data);
            return sysend;
        },
        emit: function(event, data) {
            log('emit', { event, data });
            sysend.broadcast(event, data);
            invoke(event, data);
            return sysend;
        },
        serializer: function(to, from) {
            if (!(is_function(to) && is_function(from))) {
                throw new Error('sysend::serializer: Invalid argument, expecting' +
                                ' function');
            }
            serializer.to = to;
            serializer.from = from;
            return sysend;
        },
        proxy: function(...args) {
            args.forEach(function(url) {
                if (is_string(url) && host(url) !== window.location.host) {
                    domains = domains || [];
                    var orig = origin(url);
                    if (domains.includes(orig)) {
                        var selector = 'iframe[src="' + url + '"]';
                        if (document.querySelector(selector)) {
                            warn('You already called proxy on ' + url +
                                 ' you only need to call this function once');
                            return;
                        }
                    }
                    domains.push(orig);
                    var iframe = document.createElement('iframe');
                    iframe.style.width = iframe.style.height = 0;
                    iframe.style.position = 'absolute';
                    iframe.style.top = iframe.style.left = '-9999px';
                    iframe.style.border = 'none';
                    var proxy_url = url;
                    if (!url.match(/\.html|\.php|\?/)) {
                        proxy_url = url.replace(/\/$/, '') + '/proxy.html';
                    }
                    iframe.addEventListener('error', function handler() {
                        setTimeout(function() {
                            throw new Error('html proxy file not found on "' + url +
                                            '" url');
                        }, 0);
                        iframe.removeEventListener('error', handler);
                    });
                    iframe.addEventListener('load', function handler() {
                        var win;
                        // fix for Safari
                        // https://stackoverflow.com/q/42632188/387194
                        try {
                            win = iframe.contentWindow;
                        } catch(e) {
                            win = iframe.contentWindow;
                        }
                        iframes.push({window: win, node: iframe});
                        iframe.removeEventListener('load', handler);
                    });
                    document.body.appendChild(iframe);
                    iframe.src = proxy_url;
                }
            });
            if (!arguments.length && is_iframe) {
                proxy_mode = true;
            }
            return sysend;
        },
        on: function(event, fn) {
            if (!callbacks[event]) {
                callbacks[event] = [];
            }
            callbacks[event].push(fn);
            return sysend;
        },
        off: function(event, fn, internal = false) {
            if (callbacks[event]) {
                if (fn) {
                    for (var i = callbacks[event].length; i--;) {
                        if (callbacks[event][i] == fn) {
                            callbacks[event].splice(i, 1);
                        }
                    }
                } else if (internal && is_internal(event) || !internal) {
                    callbacks[event] = [];
                }
            }
            return sysend;
        },
        track: function(event, fn, internal = false) {
            if (internal) {
                fn[Symbol.for(uniq_prefix)] = true;
            }
            if (events.includes(event)) {
                handlers[event].push(fn);
            }
            return sysend;
        },
        untrack: function(event, fn, internal = false) {
            if (events.includes(event) && handlers[event].length) {
                if (fn === undefined) {
                    if (internal) {
                        handlers[event] = [];
                    } else {
                        handlers[event] = handlers[event].filter(function(fn) {
                            return !fn[Symbol.for(uniq_prefix)];
                        });
                    }
                } else {
                    handlers[event] = handlers[event].filter(function(handler) {
                        return handler !== fn;
                    });
                }
            }
            return sysend;
        },
        post: function(target, data) {
            return sysend.broadcast(make_internal('__message__'), {
                target: target,
                data: data,
                origin: target_id
            });
        },
        list: function() {
            var id = list_id++;
            var marker = { target: target_id, id: id, origin: self.origin };
            var timer = delay(sysend.timeout);
            return new Promise(function(resolve) {
                var ids = [];
                function handler(data) {
                    log('__window_ack__', { data, marker });
                    if (data.origin.target === target_id && data.origin.id === id) {
                        ids.push({
                            id: data.id,
                            primary: data.primary
                        });
                    }
                }
                sysend.on(make_internal('__window_ack__'), handler);
                sysend.broadcast(make_internal('__window__'), { id: marker });
                timer().then(function() {
                    log('timeout', { ids });
                    sysend.off(make_internal('__window_ack__'), handler);
                    resolve(ids);
                });
            });
        },
        channel: function(...args) {
            domains = args.map(origin);
            return sysend;
        },
        isPrimary: function() {
            return primary;
        },
        useLocalStorage: function(toggle) {
            if (typeof toggle === 'boolean') {
                force_ls = toggle;
            } else {
                force_ls = true;
            }
        },
        rpc: function(object) {
            var prefix = ++rpc_count;
            var req = `__${prefix}_rpc_request__`;
            var res = `__${prefix}_rpc_response__`;
            var request_index = 0;
            var timeout = 1000;
            function request(id, method, args = []) {
                var req_id = ++request_index;
                return new Promise(function(resolve, reject) {
                    sysend.track('message', function handler({data, origin}) {
                        if (data.type === res) {
                            var { result, error, id: res_id } = data;
                            if (origin === id && req_id === res_id) {
                                if (error) {
                                    reject(error);
                                } else {
                                    resolve(result);
                                }
                                clearTimeout(timer);
                                sysend.untrack('message', handler);
                            }
                        }
                    }, true);
                    sysend.post(id, { method, id: req_id, type: req, args });
                    var timer = setTimeout(function() {
                        reject(new Error('Timeout error'));
                    }, timeout);
                });
            }

            sysend.track('message', async function handler({ data, origin }) {
                if (data.type == req) {
                    var { method, args, id } = data;
                    var type = res;
                    if (Object.hasOwn(object, method)) {
                        try {
                            unpromise(object[method](...args), function(result) {
                                sysend.post(origin, { result, id, type });
                            }, function(error) {
                                sysend.post(origin, { error: error.message, id, type });
                            });
                        } catch(e) {
                            sysend.post(origin, { error: e.message, id, type });
                        }
                    } else {
                        sysend.post(origin, { error: 'Method not found', id, type });

                    }
                }
            }, true);
            var error_msg = 'You need to specify the target window/tab';
            return Object.fromEntries(Object.keys(object).map(function(name) {
                return [name, function(id, ...args) {
                    if (!id) {
                        return Promise.reject(new Error(error_msg));
                    }
                    return request(id, name, args);
                }];
            }));
        }
    };
    // -------------------------------------------------------------------------
    Object.defineProperty(sysend, 'timeout', {
        enumerable: true,
        get: function() {
            return collecting_timeout;
        },
        set: function(value) {
            if (typeof value === 'number' && !isNaN(value)) {
                collecting_timeout = value;
            }
        }
    });
    // -------------------------------------------------------------------------
    var host = (function() {
        if (typeof URL !== 'undefined') {
            return function(url) {
                if (!url) {
                    return url;
                }
                url = new URL(url);
                return url.host;
            };
        }
        var a = document.createElement('a');
        return function(url) {
            if (!url) {
                return url;
            }
            a.href = url;
            return a.host;
        };
    })();
    // -------------------------------------------------------------------------
    function unpromise(obj, callback, error = null) {
        if (is_promise(obj)) {
            var ret = obj.then(callback);
            if (error === null) {
                return ret;
            } else {
                return ret.catch(error);
            }
        } else {
            return callback(obj);
        }
    }
    // -------------------------------------------------------------------------
    function delay(time) {
        return function() {
            return new Promise(function(resolve) {
                setTimeout(resolve, time);
            });
        };
    }
    // -------------------------------------------------------------------------
    var origin = (function() {
        function tc(f) {
            return function origin(url) {
                try {
                    return f(url);
                } catch(e) {
                    return url;
                }
            };
        }
        if (window.URL) {
            return tc(function origin(url) {
                return new URL(url).origin;
            });
        }
        var a = document.createElement('a');
        return tc(function origin(url) {
            a.href = url;
            return a.origin;
        });
    })();
    // -------------------------------------------------------------------------
    // :: show only single message of this kind
    // -------------------------------------------------------------------------
    var warn_messages = [];
    function warn(message) {
        if (!warn_messages.includes(message)) {
            warn_messages.push(message);
            if (console && console.warn) {
                console.warn(message);
            } else {
                setTimeout(function() {
                    throw new Error(message);
                }, 0);
            }
        }
    }
    // -------------------------------------------------------------------------
    function log() {
        if (DEBUG) {
            console.log.apply(null, [self.origin].concat(Array.from(arguments)));
        }
    }
    // -------------------------------------------------------------------------
    function iframe_loaded() {
        var iframes = Array.from(document.querySelectorAll('iframe'));
        return Promise.all(iframes.filter(function(iframe) {
            return iframe.src;
        }).map(function(iframe) {
            return new Promise(function(resolve, reject) {
                iframe.addEventListener('load', resolve, true);
                iframe.addEventListener('error', reject, true);
            });
        })).then(delay(sysend.timeout));
        // delay is required, something with browser, it's not intialized
        // properly. The number was picked by experimentation
    }
    // -------------------------------------------------------------------------
    function make_internal(name) {
        return uniq_prefix + name;
    }
    // -------------------------------------------------------------------------
    function is_promise(obj) {
        return obj && typeof object == 'object' && is_function(object.then);
    }
    // -------------------------------------------------------------------------
    function is_function(o) {
        return typeof o === 'function';
    }
    // -------------------------------------------------------------------------
    function is_string(o) {
        return typeof o === 'string';
    }
    // -------------------------------------------------------------------------
    function is_internal(name) {
        return name.match(prefix_re);
    }
    // -------------------------------------------------------------------------
    // :: valid sysend message
    // -------------------------------------------------------------------------
    function is_sysend_post_message(e) {
        return is_string(e.data) && is_internal(e.data);
    }
    // -------------------------------------------------------------------------
    function is_secured_iframe() {
        return is_proxy_iframe() && window.isSecureContext;
    }
    // -------------------------------------------------------------------------
    function is_valid_origin(origin) {
        if (!domains) {
            warn('Call sysend.channel() on iframe to restrict domains that can '+
                 'use sysend channel');
            return true;
        }
        var valid = domains.includes(origin);
        if (!valid) {
            warn(origin + ' domain is not on the list of allowed '+
                 'domains use sysend.channel() on iframe to allow'+
                 ' access to this domain');
        }
        return valid;
    }
    // -------------------------------------------------------------------------
    // :: ref: https://stackoverflow.com/a/8809472/387194
    // :: license: Public Domain/MIT
    // -------------------------------------------------------------------------
    function generate_uuid() {
        var d = new Date().getTime();
        //Time in microseconds since page-load or 0 if unsupported
        var d2 = (performance && performance.now && (performance.now() * 1000)) || 0;
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16;
            if (d > 0) { // Use timestamp until depleted
                r = (d + r)%16 | 0;
                d = Math.floor(d/16);
            } else { // Use microseconds since page-load if supported
                r = (d2 + r)%16 | 0;
                d2 = Math.floor(d2/16);
            }
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
    }
    // -------------------------------------------------------------------------
    function trigger(arr, ...args) {
        arr.forEach(function(fn) {
            fn.apply(null, args);
        });
    }
    // -------------------------------------------------------------------------
    function ls() {
        if (sa_handle) {
            return sa_handle.localStorage;
        } else {
            return localStorage;
        }
    }
    // -------------------------------------------------------------------------
    function get(key) {
        log({get: key});
        return ls().getItem(make_internal(key));
    }
    // -------------------------------------------------------------------------
    function set(key, value) {
        // storage event is not fired when value is set first time
        log({set: key, value});
        if (id == 0) {
            ls().setItem(make_internal(key), random_value);
        }
        ls().setItem(make_internal(key), value);
    }
    // -------------------------------------------------------------------------
    function remove(key) {
        log({remove: key});
        ls().removeItem(make_internal(key));
    }
    // -------------------------------------------------------------------------
    function make_process(object, prop) {
        var labels = {
            from: 'Unserialize',
            to: 'Serialize'
        };
        var prefix_message = labels[prop] + ' Error: ';
        return function(data) {
            var fn = object[prop];
            try {
                if (fn) {
                    return fn(data);
                }
                return data;
            } catch (e) {
                warn(prefix_message + e.message);
            }
        };
    }
    // -------------------------------------------------------------------------
    // ref: https://stackoverflow.com/a/326076/387194
    // -------------------------------------------------------------------------
    var is_iframe = (function is_iframe() {
        try {
            return window.self !== window.top;
        } catch (e) {
            return true;
        }
    })();
    // -------------------------------------------------------------------------
    var is_private_mode = (function is_private_mode() {
        try {
            ls().setItem(uniq_prefix, 1);
            ls().removeItem(uniq_prefix);
            return false;
        } catch (e) {
            return true;
        }
    })();
    // -------------------------------------------------------------------------
    function is_proxy_iframe() {
        return is_iframe && proxy_mode;
    }
    // -------------------------------------------------------------------------
    function send_to_iframes(key, data) {
        // propagate events to iframes
        iframes.forEach(function(iframe) {
            var payload = {
              name: uniq_prefix,
              key: key,
              data: data
            };
            if (is_valid_origin(origin(iframe.node.src))) {
                iframe.window.postMessage(JSON.stringify(payload), '*');
            }
        });
    }
    // -------------------------------------------------------------------------
    function to_json(input) {
        // save random_value in storage to fix issue in IE that storage event
        // is fired on same page where setItem was called
        var obj = [id++, random_value];
        // undefined in array get stringified as null
        if (typeof input != 'undefined') {
            obj.push(input);
        }
        var data = serialize(obj);
        if (data === obj) {
            return JSON.stringify(obj);
        }
        return data;
    }
    // -------------------------------------------------------------------------
    function from_json(json) {
        var result = unserialize(json);
        if (result === json) {
            return JSON.parse(json);
        }
        return result;
    }
    // -------------------------------------------------------------------------
    function invoke(key, data) {
        callbacks[key].forEach(function(fn) {
            fn(data, key);
        });
    }
    // -------------------------------------------------------------------------
    function init_visiblity() {
        // ref: https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API
        var hidden, visibilityChange;
        if (typeof document.hidden !== 'undefined') { // Opera 12.10 and Firefox 18 and later support
            hidden = 'hidden';
            visibilityChange = 'visibilitychange';
        } else if (typeof document.msHidden !== 'undefined') {
            hidden = 'msHidden';
            visibilityChange = 'msvisibilitychange';
        } else if (typeof document.webkitHidden !== 'undefined') {
            hidden = 'webkitHidden';
            visibilityChange = 'webkitvisibilitychange';
        }
        if (is_function(document.addEventListener) && hidden) {
            document.addEventListener(visibilityChange, function() {
                trigger(handlers.visbility, !document[hidden]);
            }, false);
        }
    }
    // -------------------------------------------------------------------------
    function become_primary() {
        primary = true;
        trigger(handlers.primary);
        sysend.emit(make_internal('__primary__'));
    }
    // -------------------------------------------------------------------------
    function document_ready() {
        return ['interactive', 'complete'].indexOf(document.readyState) !== -1;
    }
    // -------------------------------------------------------------------------
    if (document_ready()) {
        init();
    } else {
        window.addEventListener('load', function() {
            setTimeout(init, 0);
        });
    }
    // -------------------------------------------------------------------------
    function setup_ls() {
        log('setup_ls()');
        // we need to clean up localStorage if broadcast called on unload
        // because setTimeout will never fire, even setTimeout 0
        var re = new RegExp('^' + uniq_prefix);
        var localStorage = ls();
        for(var key in localStorage) {
            if (key.match(re)) {
                localStorage.removeItem(key);
            }
        }
        window.addEventListener('storage', function(e) {
            // prevent event to be executed on remove in IE
            if (e.key && e.key.match(re) && index++ % 2 === 0) {
                var key = e.key.replace(re, '');
                log('__key__', e.key + ' ==> ' + key, {
                    callbacks: callbacks[key],
                    again: callbacks[key.replace(re, '')]
                });
                if (callbacks[key]) {
                    var value = e.newValue || get(e.key);
                    if (value && value != random_value) {
                        var obj = from_json(value);
                        // don't call on remove
                        if (obj && obj[1] != random_value) {
                            invoke(key, obj[2]);
                        }
                    }
                }
            }
        }, false);
    }
    // -------------------------------------------------------------------------
    function setup_update_tracking(init_list) {
        var list = init_list || [];

        update();

        function update() {
            trigger(handlers.update, list);
        }

        sysend.track('open', function(data) {
            if (data.id !== sysend.id) {
                list.push(data);
                log({ list, action: 'open' });
                update();
            }
        }, true);

        sysend.track('close', function(data) {
            list = list.filter(function(tab) {
                return data.id !== tab.id;
            });
            log({ list, action: 'close' });
            update();
        }, true);


    }
    // -------------------------------------------------------------------------
    function setup_channel() {
        if (sa_handle) {
            if (sa_handle.hasOwnProperty('BroadcastChannel')) {
                channel = new sa_handle.BroadcastChannel(uniq_prefix);
            }
        } else {
            channel = new window.BroadcastChannel(uniq_prefix);
        }
        if (!channel) {
            return;
        }
        channel.addEventListener('message', function(event) {
            if (event.target.name === uniq_prefix) {
                log('message', { data: event.data, iframe: is_proxy_iframe() });
                if (is_proxy_iframe()) {
                    var payload = {
                        name: uniq_prefix,
                        data: event.data,
                        iframe_id: target_id
                    };
                    if (is_valid_origin(origin(document.referrer))) {
                        window.parent.postMessage(JSON.stringify(payload), '*');
                    }
                } else {
                    var key = event.data && event.data.name;
                    if (callbacks[key]) {
                        invoke(key, unserialize(event.data.data));
                    }
                }
            }
        });
    }
    // -------------------------------------------------------------------------
    function seutp() {
        setup_channel();

        if (!is_private_mode) {
            setup_ls();
        }

        if (is_proxy_iframe()) {
            window.addEventListener('message', function(e) {
                if (is_sysend_post_message(e) && is_valid_origin(e.origin)) {

                    try {
                        var payload = JSON.parse(e.data);
                        log('iframe', payload, payload.name === uniq_prefix);
                        if (payload && payload.name === uniq_prefix) {
                            var data = unserialize(payload.data);
                            sysend.broadcast(payload.key, data);
                        }
                    } catch(e) {
                        // ignore wrong JSON, the message don't came from Sysend
                        // even that the string have unix_prefix, this is just in case
                    }
                }
            });
        } else {
            init_visiblity();

            sysend.track('visbility', function(visible) {
                if (visible && !has_primary) {
                    become_primary();
                }
            }, true);

            sysend.on(make_internal('__primary__'), function() {
                log('__primary__');
                has_primary = true;
            });

            sysend.on(make_internal('__open__'), function(data) {
                log('__open__', data);
                var id = data.id;
                target_count++;
                if (primary) {
                    sysend.broadcast(make_internal('__ack__'));
                }
                trigger(handlers.open, {
                    count: target_count,
                    primary: data.primary,
                    id: data.id
                });
                if (id === target_id) {
                    trigger(handlers.ready);
                }
            });

            sysend.on(make_internal('__ack__'), function() {
                if (!primary) {
                    trigger(handlers.secondary);
                }
            });

            sysend.on(make_internal('__close__'), function(data) {
                log('__close__', data);
                --target_count;
                var last = target_count === 1;
                if (data.wasPrimary && !primary) {
                    has_primary = false;
                }
                var payload = {
                    id: data.id,
                    count: target_count,
                    primary: data.wasPrimary,
                    self: data.id === target_id
                };
                // we need to trigger primary when tab is in different window
                // and is not be hidden
                if (last) {
                    become_primary();
                }
                trigger(handlers.close, payload);
            });

            sysend.on(make_internal('__window__'), function(data) {
                log('__window__', { data })
                sysend.broadcast(make_internal('__window_ack__'), {
                    id: target_id,
                    origin: data.id,
                    from: self.origin,
                    primary: primary
                });
            });

            sysend.on(make_internal('__message__'), function(data) {
                log('__message__', data);
                if (data.target === 'primary' && primary) {
                    trigger(handlers.message, data);
                } else if (data.target === target_id) {
                    trigger(handlers.message, data);
                }
            });

            addEventListener('beforeunload', function() {
                log('beforeunload');
                sysend.emit(make_internal('__close__'), {
                    id: target_id,
                    wasPrimary: primary
                });
            }, { capture: true });

            iframe_loaded().then(function() {
                setTimeout(function() {
                    sysend.list().then(function(list) {
                        log('sysend.list()', list);
                        target_count = list.length;
                        primary = list.length === 0;
                        var found = list.find(function(item) {
                            return item.primary;
                        });
                        if (found || primary) {
                            has_primary = true;
                        }
                        sysend.emit(make_internal('__open__'), {
                            id: target_id,
                            primary: primary
                        });
                        if (primary) {
                            trigger(handlers.primary);
                        }
                        setup_update_tracking(list);
                    });
                }, 0);
            });
        }
    }
    // -------------------------------------------------------------------------
    function init() {
        if (is_function(window.BroadcastChannel)) {
            if (is_secured_iframe() && document.requestStorageAccess) {
                document.requestStorageAccess({
                    all: true
                }).then(function(handle) {
                    sa_handle = handle;
                    log({init: handle});
                    seutp();
                }).catch(seutp);
            } else {
                seutp();
            }
            return sysend;
        } else if (is_private_mode) {
            warn('Your browser don\'t support localStorgage. ' +
                 'In Safari this is most of the time because ' +
                 'of "Private Browsing Mode"');
        }
        seutp();
    }
    return sysend;
});
