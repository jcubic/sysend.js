/**@license
 *  sysend.js - send messages between browser windows/tabs version 1.11.1
 *
 *  Copyright (C) 2014-2022 Jakub T. Jankiewicz <https://jcubic.pl/me>
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
})(typeof window !== "undefined" ? window : this, function() {
    var collecting_timeout = 400;
    // we use prefix so `foo' event don't collide with `foo' locaStorage value
    var uniq_prefix = '___sysend___';
    var prefix_re = new RegExp(uniq_prefix);
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
    // we use id because storage event is not executed if message was not
    // changed, and we want it if user send same object twice (before it will
    // be removed)
    var id = 0;
    // identifier for making each call to list unique
    var list_id = 0;

    // id of the window/tab
    var target_id = generate_uuid();
    var target_count = 1;
    var domains;

    var handlers = {
        primary: [],
        close: [],
        open: [],
        secondary: [],
        message: [],
        visbility: [],
        ready: []
    };
    var events = Object.keys(handlers);
    // -------------------------------------------------------------------------
    var serialize = make_process(serializer, 'to');
    var unserialize = make_process(serializer, 'from');
    // -------------------------------------------------------------------------
    var sysend = {
        id: target_id,
        broadcast: function(event, data) {
            if (channel) {
                channel.postMessage({name: event, data: serialize(data)});
            } else {
                set(event, to_json(data));
                // clean up localstorage
                setTimeout(function() {
                    remove(event);
                }, 0);
            }
            send_to_iframes(event, data);
        },
        emit: function(event, data) {
            sysend.broadcast(event, data);
            invoke(event, data);
        },
        serializer: function(to, from) {
            if (typeof to !== 'function' || typeof from !== 'function') {
                throw new Error('sysend::serializer: Invalid argument, expecting' +
                                ' function');
            }
            serializer.to = to;
            serializer.from = from;
        },
        proxy: function() {
            [].slice.call(arguments).forEach(function(url) {
                if (typeof url === 'string' && host(url) !== window.location.host) {
                    domains = domains || [];
                    domains.push(origin(url));
                    var iframe = document.createElement('iframe');
                    iframe.style.width = iframe.style.height = 0;
                    iframe.style.border = 'none';
                    var proxy_url = url;
                    if (!url.match(/\.html$/)) {
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
        },
        on: function(event, fn) {
            if (!callbacks[event]) {
                callbacks[event] = [];
            }
            callbacks[event].push(fn);
        },
        off: function(event, fn) {
            if (callbacks[event]) {
                if (fn) {
                    for (var i = callbacks[event].length; i--;) {
                        if (callbacks[event][i] == fn) {
                            callbacks[event].splice(i, 1);
                        }
                    }
                } else {
                    callbacks[event] = [];
                }
            }
        },
        track: function(event, fn) {
            if (events.includes(event)) {
                handlers[event].push(fn);
            }
        },
        untrack: function(event, fn) {
            if (events.includes(event) && handlers[event].length) {
                if (fn === undefined) {
                    handlers[event] = [];
                } else {
                    handlers[event] = handlers[event].filter(function(handler) {
                        return handler !== fn;
                    });
                }
            }
        },
        post: function(target, data) {
            sysend.broadcast('__message__', {
                target: target,
                data: data,
                origin: target_id
            });
        },
        list: function() {
            var id = list_id++;
            var marker = { target: target_id, id: id };
            var timer = delay(sysend.timeout);
            return new Promise(function(resolve) {
                var ids = [];
                sysend.on('__window_ack__', function(data) {
                    if (data.origin.target === target_id && data.origin.id === id) {
                        ids.push({
                            id: data.id,
                            primary: data.primary
                        });
                    }
                });
                sysend.broadcast('__window__', { id: marker });
                timer().then(function() {
                    resolve(ids);
                });
            });
        },
        channel: function() {
            domains = [].slice.apply(arguments).map(origin);
        },
        isPrimary: function() {
            return primary;
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
                url = new URL(url);
                return url.host;
            };
        }
        var a = document.createElement('a');
        return function(url) {
            a.href = url;
            return a.host;
        };
    })();
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
        var a = document.createElement('a');
        return function origin(url) {
            a.href = url;
            return a.origin;
        };
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
    function iframe_loaded() {
        var iframes = Array.from(document.querySelectorAll('iframe'));
        return Promise.all(iframes.filter(function(iframe) {
            return iframe.src;
        }).map(function(iframe) {
            return new Promise(function(resolve, reject) {
                iframe.addEventListener('load', () => {
                    resolve();
                }, true);
                iframe.addEventListener('error', reject, true);
            });
        })).then(delay(sysend.timeout));
        // delay is required, something with browser, it's not intialized
        // properly. The number was picked by experimentation
    }
    // -------------------------------------------------------------------------
    // :: valid sysend message
    // -------------------------------------------------------------------------
    function is_sysend_post_message(e) {
        return typeof e.data === 'string' && e.data.match(prefix_re);
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
    function trigger(arr) {
        var args = [].slice.call(arguments, 1);
        arr.forEach(function(fn) {
            fn.apply(null, args);
        });
    }
    // -------------------------------------------------------------------------
    function get(key) {
        return localStorage.getItem(uniq_prefix + key);
    }
    // -------------------------------------------------------------------------
    function set(key, value) {
        // storage event is not fired when value is set first time
        if (id == 0) {
            localStorage.setItem(uniq_prefix + key, random_value);
        }
        localStorage.setItem(uniq_prefix + key, value);
    }
    // -------------------------------------------------------------------------
    function remove(key) {
        localStorage.removeItem(uniq_prefix + key);
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
                iframe.window.postMessage(JSON.stringify(payload), "*");
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
    function is_private_mode() {
        try {
            localStorage.setItem(uniq_prefix, 1);
            localStorage.removeItem(uniq_prefix);
            return false;
        } catch (e) {
            return true;
        }
    }
    // -------------------------------------------------------------------------
    function init_visiblity() {
        // ref: https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API
        var hidden, visibilityChange;
        if (typeof document.hidden !== "undefined") { // Opera 12.10 and Firefox 18 and later support
            hidden = "hidden";
            visibilityChange = "visibilitychange";
        } else if (typeof document.msHidden !== "undefined") {
            hidden = "msHidden";
            visibilityChange = "msvisibilitychange";
        } else if (typeof document.webkitHidden !== "undefined") {
            hidden = "webkitHidden";
            visibilityChange = "webkitvisibilitychange";
        }
        if (typeof document.addEventListener === 'function' && hidden) {
            document.addEventListener(visibilityChange, function() {
                trigger(handlers.visbility, !document[hidden]);
            }, false);
        }
    }
    // -------------------------------------------------------------------------
    function become_primary() {
        primary = true;
        trigger(handlers.primary);
        sysend.emit('__primary__');
    }
    // -------------------------------------------------------------------------
    window.addEventListener('load', function() {
        setTimeout(init, 0);
    });
    // -------------------------------------------------------------------------
    function init() {
        if (typeof window.BroadcastChannel === 'function') {
            channel = new window.BroadcastChannel(uniq_prefix);
            channel.addEventListener('message', function(event) {
                if (event.target.name === uniq_prefix) {
                    if (is_proxy_iframe()) {
                        var payload = {
                          name: uniq_prefix,
                          data: event.data,
                          iframe_id: target_id
                        };
                        if (is_valid_origin(origin(document.referrer))) {
                            window.parent.postMessage(JSON.stringify(payload), "*");
                        }
                    } else {
                        var key = event.data && event.data.name;
                        if (callbacks[key]) {
                            invoke(key, unserialize(event.data.data));
                        }
                    }
                }
            });
        } else if (is_private_mode()) {
            warn('Your browser don\'t support localStorgage. ' +
                 'In Safari this is most of the time because ' +
                 'of "Private Browsing Mode"');
        } else {
            // we need to clean up localStorage if broadcast called on unload
            // because setTimeout will never fire, even setTimeout 0
            var re = new RegExp('^' + uniq_prefix);
            for(var key in localStorage) {
                if (key.match(re)) {
                    localStorage.removeItem(key);
                }
            }
            window.addEventListener('storage', function(e) {
                // prevent event to be executed on remove in IE
                if (e.key.match(re) && index++ % 2 === 0) {
                    var key = e.key.replace(re, '');
                    if (callbacks[key]) {
                        var value = e.newValue || get(key);
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

        if (is_proxy_iframe()) {
            window.addEventListener('message', function(e) {
                if (is_sysend_post_message(e) && is_valid_origin(e.origin)) {
                    try {
                        var payload = JSON.parse(e.data);
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
            });

            sysend.on('__primary__', function() {
                has_primary = true;
            });

            sysend.on('__open__', function(data) {
                var id = data.id;
                target_count++;
                if (primary) {
                    sysend.broadcast('__ack__');
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

            sysend.on('__ack__', function() {
                if (!primary) {
                    trigger(handlers.secondary);
                }
            });

            sysend.on('__close__', function(data) {
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

            sysend.on('__window__', function(data) {
                sysend.broadcast('__window_ack__', {
                    id: target_id,
                    origin: data.id,
                    primary: primary
                });
            });

            sysend.on('__message__', function(data) {
                if (data.target === target_id) {
                    trigger(handlers.message, data);
                }
            });

            addEventListener('beforeunload', function() {
                sysend.emit('__close__', { id: target_id, wasPrimary: primary });
            }, { capture: true });

            iframe_loaded().then(function() {
                sysend.list().then(function(list) {
                    target_count = list.length;
                    primary = list.length === 0;
                    var found = list.find(function(item) {
                        return item.primary;
                    });
                    if (found || primary) {
                        has_primary = true;
                    }
                    sysend.emit('__open__', {
                        id: target_id,
                        primary: primary
                    });
                    if (primary) {
                        trigger(handlers.primary);
                    }
                });
            });
        }
    }
    return sysend;
});
