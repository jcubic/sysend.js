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
 */
var sysend = (function() {
    var id = 0;
    function get(key) {
        return localStorage.getItem(key);
    }
    function set(key, value) {
        localStorage.setItem(key, value);
    }
    function to_json(message) {
        return JSON.stringify([id++, message]);
    }
    function from_json(json) {
        return JSON.parse(json)[1];
    }
    var callbacks = {};
    window.addEventListener('storage', function(e) {
        if (callbacks[e.key]) {
            var message = from_json(get(e.key));
            callbacks[e.key].forEach(function(fn) {
                fn(message, e.key);
            });
        }
    }, false);
    return {
        broadcast: function(event, message) {
            set(event, to_json(message));
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
                    for (var i=callbacks[event].length; i--;) {
                        callbacks[event].splice(i, 1);
                    }
                }
            }
        }
    };
})();
