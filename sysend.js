/**@license
 *  sysend.js - send messages between browser windows/tabs
 *  Copyright (C) 2014 Jakub Jankiewicz <http://jcubic.pl>
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 *  The idea for this implementation came from this StackOverflow question:
 *  http://stackoverflow.com/q/24182409/387194
 */
var sysend = (function() {
    // we use prefix so `foo' event don't collide with `foo' locaStorage value
    var uniq_prefix = '___sysend___';
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
        localStorage.setItem(uniq_prefix + key, value);
    }
    function remove(key) {
        localStorage.removeItem(uniq_prefix + key);
    }
    function to_json(input) {
        var obj = [id++];
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
        // get user key
        var key = e.key.replace(new RegExp('^' + uniq_prefix), '');
        if (callbacks[key]) {
            var obj = JSON.parse(get(key));
            if (obj) {
                // don't call on remove
                callbacks[key].forEach(function(fn) {
                    fn(obj[1], key);
                });
            }
        }
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
})();
