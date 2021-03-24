/**@license
 *  sysend.js - send messages between browser windows/tabs version 1.3.5
 *
 *  Copyright (C) 2014-2021 Jakub T. Jankiewicz <https://jcubic.pl/me>
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
    // we use prefix so `foo' event don't collide with `foo' locaStorage value
    var uniq_prefix = '___sysend___';
    var prefix_re = new RegExp(uniq_prefix);
    var random_value = Math.random();
    var serializer = {}, serialize, deserialize;
    // object with user events as keys and values arrays of callback functions
    var callbacks = {};
    var iframes = [];
    var index = 0;
    var channel;
    // we use id because storage event is not executed if message was not
    // changed, and we want it if user send same object twice (before it will
    // be removed)
    var id = 0;
    // -------------------------------------------------------------------------
    init();
    // -------------------------------------------------------------------------
    var serialize = make_process(serializer, 'to');
    var unserialize = make_process(serializer, 'from');
    // -------------------------------------------------------------------------
    var sysend = {
        broadcast: function(event, message) {
            if (channel) {
                channel.postMessage({name: event, data: serialize(message)});
            } else {
                set(event, to_json(message));
                // clean up localstorage
                setTimeout(function() {
                    remove(event);
                }, 0);
            }
            send_to_iframes(event, message);
        },
        serializer: function(to, from) {
            if (typeof to !== 'function' || typeof from !== 'function') {
                throw new Error('sysend::serializer: Invalid argument, expecting' +
                                ' function');
            }
            serializer.to = to;
            serializer.from = from;
        },
        proxy: function(url) {
            if (typeof url === 'string' && host(url) !== window.location.host) {
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
                    for (var i=callbacks[event].length; i--;) {
                        if (callbacks[event][i] == fn) {
                            callbacks[event].splice(i, 1);
                        }
                    }
                } else {
                    callbacks[event] = [];
                }
            }
        }
    };
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
                console.warn(prefix_message + e.message);
            }
        };
    }
    // -------------------------------------------------------------------------
    // ref: https://stackoverflow.com/a/326076/387194
    // -------------------------------------------------------------------------
    function is_iframe() {
        try {
            return window.self !== window.top;
        } catch (e) {
            return true;
        }
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
            iframe.window.postMessage(JSON.stringify(payload), "*");
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
    function invoke(key, data) {
        callbacks[key].forEach(function(fn) {
            fn(data, key);
        });
    }
    // -------------------------------------------------------------------------
    function init() {
        // we need to clean up localStorage if broadcast called on unload
        // because setTimeout will never fire, even setTimeout 0
        var re = new RegExp('^' + uniq_prefix);
        for(var key in localStorage) {
            if (key.match(re)) {
                localStorage.removeItem(key);
            }
        }
        if (typeof window.BroadcastChannel === 'function') {
            channel = new window.BroadcastChannel(uniq_prefix);
            channel.addEventListener('message', function(event) {
                if (event.target.name === uniq_prefix) {
                    var key = event.data && event.data.name;
                    if (callbacks[key]) {
                        invoke(key, unserialize(event.data.data));
                    }
                }
            });
        } else {
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
        if (is_iframe()) {
          window.addEventListener('message', function(e) {
              if (typeof e.data === 'string' && e.data.match(prefix_re)) {
                  try {
                      var payload = JSON.parse(e.data);
                      if (payload && payload.name === uniq_prefix) {
                          sysend.broadcast(payload.key, unserialize(payload.data));
                      }
                  } catch(e) {
                      // ignore wrong JSON, the message don't came from Sysend
                      // even that the string have unix_prefix, this is just in case
                  }
              }
          });
        }
    }
    return sysend;
});
