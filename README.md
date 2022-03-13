<p align="center">
  <img src="https://github.com/jcubic/sysend.js/blob/master/assets/logo.svg?raw=true" alt="Sysend.js logo"/>
</p>

[![npm](https://img.shields.io/badge/npm-1.10.0-blue.svg)](https://www.npmjs.com/package/sysend)
![bower](https://img.shields.io/badge/bower-1.10.0-yellow.svg)
![downloads](https://img.shields.io/npm/dt/sysend.svg)
[![jsdelivr](https://img.shields.io/jsdelivr/npm/hm/sysend)](https://www.jsdelivr.com/package/npm/sysend)

# [Web application synchronization between different tabs](https://github.com/jcubic/sysend.js/)

sysend.js is a small library that allows to send messages between pages that are open in the same
browser. It also supports Cross-Domain communication (Cross-Origin). The library doesn't have any
dependencies and uses the HTML5 LocalStorage API or BroadcastChannel API.  If your browser don't
support BroadcastChannel (see [Can I Use](https://caniuse.com/#feat=broadcastchannel)) then you can
send any object that can be serialized to JSON. With BroadcastChannel you can send any object (it
will not be serialized to string but the values are limited to the ones that can be copied by the
[structured cloning algorithm](https://html.spec.whatwg.org/multipage/structured-data.html#structured-clone)).
You can also send empty notifications.

Tested on:

GNU/Linux: in Chromium 34, FireFox 29, Opera 12.16 (64bit)<br/>
Windows 10 64bit: in IE11 and Edge 38, Chrome 56, Firefox 51<br/>
MacOS X El Captain: Safari 9, Chrome 56, Firefox 51

## Note about Safari 7+ and Cross-Domain communication

All cross-domain communication is disabled by default with Safari 7+.  Because of a feature that
block 3rd party tracking for iframe, and any iframe used for cross-domain communication runs in
sandboxed environment.  That's why this library like any other solution for cross-domain
comunication, don't work on Safari.

## Installation

Include `sysend.js` file in your html, you can grab the file from npm:

```
npm install sysend
```

or bower


```
bower install sysend
```

you can also get it from unpkg.com CDN:

```
https://unpkg.com/sysend
```

or jsDelivr:

```
https://cdn.jsdelivr.net/npm/sysend
```

jsDelivr will minify the file. From my testing it's faster then unpkg.com.

## Usage

```javascript
window.onload = function() {
    sysend.on('foo', function(data) {
        console.log(data.message);
    });
    var input = document.getElementsByTagName('input')[0];
    document.getElementsByTagName('button')[0].onclick = function() {
        sysend.broadcast('foo', { message: input.value });
    };
};
```

If you want to add support for Cross-Domain communication, you need to call proxy method with url on target domain
that have [proxy.html file](https://github.com/jcubic/sysend.js/blob/master/proxy.html).

```javascript
sysend.proxy('https://jcubic.pl');
sysend.proxy('https://terminal.jcubic.pl');
```

on Firefox you need to add **CORS** for the proxy.html that will be loaded into iframe (see [Cross-Domain LocalStorage](https://jcubic.wordpress.com/2014/06/20/cross-domain-localstorage/))

if you want to send custom data you can use serializer (new in 1.4.0).
Example serializer can be [json-dry](https://github.com/11ways/json-dry).

```javascript
sysend.serializer(function(data) {
    return Dry.stringify(data);
}, function(string) {
    return Dry.parse(string);
});
````

## Demo

Open this [demo page](http://jcubic.pl/sysend.php) in two tabs/windows (there is also link to other domain).

Here is another example that shows [ReactJS shopping cart synchronization](https://codepen.io/jcubic/pen/QWgmBmE).

And here is [multiple window tracking demo](https://jcubic.pl/windows.html). Open the link in multiple windows (not tabs). First window will track position and size for all windows.

![Screen capture of Operating System Windows dragging and moving around animation](https://github.com/jcubic/sysend.js/blob/master/assets/windows-demo.gif?raw=true)

## API

sysend object:

| function | description | arguments | Version |
|---|---|---|---|
| `on(name, callback)` | add event handler for specified name | name - `string` - The name of the event<br>callback - function `(object, name) => void` | 1.0.0 |
| `off(name [, callback])` | remove event handler for given name, if callback is not specified it will remove all callbacks for given name | name - `string` - The name of the event<br>callback - optional function `(object, name) => void` | 1.0.0 |
| `broadcast(name [, object])` | send any object and fire all events with specified name (in different pages that register callback using on). You can also just send notification without an object | name - string - The name of the event<br>object - optional any data | 1.0.0 |
| `proxy(url)` | create iframe proxy for different domain, the target domain/URL should have [proxy.html](https://github.com/jcubic/sysend.js/blob/master/proxy.html)<br> file. If url domain is the same as page domain, it's ignored. So you can put both proxy calls on both | url - string | 1.3.0 |
| `serializer(to_string, from_string)` | add serializer and deserializer functions | both arguments are functions (data: any) => string | 1.4.0 |
| `emit(name, [, object])` | same as `broadcast()` but also invoke the even on same page | name - string - The name of the event<br>object - optional any data | 1.5.0 |
| `post(<window_id>, [, object])` | send any data to other window | window_id - string of the target window<br>object - any data | 1.6.0 |
| `list()` | returns a Promise of objects `{id:<UUID>, primary}` for other windows, you can use those to send a message with `post()` | NA | 1.6.0 |
| `track(event, callback)` | track inter window communication events  | event - any of the strings: `"open"`, `"close"`, `"primary"`, <br>`"secondary"`, `"message"`<br>callback - different function depend on the event:<br>* `"message"` - `{data, origin}` - where data is anything the `post()` sends, and origin is `id` of the sender.<br>* `"open"` - `{count, primary, id}` when new window/tab is opened<br>* `"close"` - `{count, primary, id, self}` when window/tab is closed<br>* `"primary"` and `"secondary"` function has no arguments and is called when window/tab become secondary or primary.<br>* `"ready"` - event when tracking is ready. | 1.6.0 except `ready` - 1.10.0 |
| `untrack(event [,callback])` | remove sigle event listener all all listeners for a given event | event - any of the strings `'open'`, `'close'`, `'primary'`, `'secondary'`, or `'message'`. | 1.6.0 |
| `isPrimary()` | function returns true if window is primary (first open or last that remain) | NA  | 1.6.0 |
| `channel()` | function restrict cross domain communication to only allowed domains. You need to call this function on proxy iframe to limit number of domains (origins) that can listen and send events.  | any number of origins (e.g. 'http://localhost:8080' or 'https://jcubic.github.io') you can also use valid URL. | 1.10.0 |


To see details of using the API, see [demo.html source code](https://github.com/jcubic/sysend.js/blob/master/demo.html) or [TypeScript definition file](https://github.com/jcubic/sysend.js/blob/master/sysend.d.ts).

## License

Copyright (C) 2014-2022 [Jakub T. Jankiewicz](https://jcubic.pl/me)<br/>
Released under the [MIT license](https://opensource.org/licenses/MIT)

This is free software; you are free to change and redistribute it.<br/>
There is NO WARRANTY, to the extent permitted by law.
