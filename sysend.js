/**@license
 *  sysend.js - send messages between browser windows/tabs
 *  Copyright (C) 2014 Jakub Jankiewicz <http://jcubic.pl>
 *
 *  Released under the MIT license
 *
 *  The idea for this implementation came from this StackOverflow question:
 *  http://stackoverflow.com/q/24182409/387194
 */
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
    var random_value = Math.random();
    // we use id because storage event is not executed if message was not
    // changed, and we want it if user send same object twice (before it will
    // be removed)
    var id = 0;
    // we need to clean up localStorage if broadcast on unload
    // because setTimeout will never fire, even setTimeout 0
    var re = new RegExp('^' + uniq_prefix);
    for(var key in localStorage) {
        if (key.match(re)) {
            localStorage.removeItem(key);
        }
    }
    function get(key) {
        return localStorage.getItem(uniq_prefix + key);
    }
    function set(key, value) {
        // storage event is not fired when value is set first time
        if (id == 0) {
            localStorage.setItem(uniq_prefix + key, random_value);
        }
        localStorage.setItem(uniq_prefix + key, value);
    }
    function remove(key) {
        localStorage.removeItem(uniq_prefix + key);
    }
    function to_json(input) {
        // save random_value in storage to fix issue in IE that storage event
        // is fired on same page where setItem was called
        var obj = [id++, random_value];
        // undefined in array get stringified as null
        if (typeof input != 'undefined') {
            obj.push(input);
        }
        return JSON.stringify(obj);
    }
    function from_json(json) {
        return JSON.parse(json);
    }
    // object with user events as keys and values arrays of callback functions
    var callbacks = {};
    window.addEventListener('storage', function(e) {
        if (e.key.match(re)) {
            var key = e.key.replace(re, '');
            if (callbacks[key]) {
                var value = e.newValue || get(key);
                if (value != random_value) {
                    var obj = JSON.parse(value);
                    if (obj && obj[1] != random_value) {
                        // don't call on remove
                        callbacks[key].forEach(function(fn) {
                            fn(obj[2], key);
                        });
                    }
                }
            }
        }
        origin_page = false;
    }, false);
    return {
        broadcast: function(event, message) {
            set(event, to_json(message));
            // clean up localstorage
            setTimeout(function() {
                remove(event);
            }, 0);
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
});
