![Sysend.js Logo](https://github.com/jcubic/sysend.js/blob/master/assets/logo.svg?raw=true)

[![npm](https://img.shields.io/badge/npm-1.4.0-blue.svg)](https://www.npmjs.com/package/sysend)
![bower](https://img.shields.io/badge/bower-1.4.0-yellow.svg)
![downloads](https://img.shields.io/npm/dt/sysend.svg)
[![jsdelivr](https://img.shields.io/jsdelivr/npm/hm/sysend)](https://www.jsdelivr.com/package/npm/sysend)

# [Send messages between browser tabs](https://github.com/jcubic/sysend.js/)

sysend.js is a small library that allows to send messages between pages that are
open in the same browser. It also supports Cross-Domain communication. The library doesn't have
any dependencies and uses the HTML5 LocalStorage API or BroadcastChannel API.
If your browser don't support BroadcastChannel (see [Can I Use](https://caniuse.com/#feat=broadcastchannel))
then you can send any object that can be serialized to JSON. With BroadcastChannel you can send any object
(it will not be serialized to string but the values are limited to the ones that can be copied by
the [structured cloning algorithm](https://html.spec.whatwg.org/multipage/structured-data.html#structured-clone)).
You can also send empty notifications.

Tested on:

GNU/Linux: in Chromium 34, FireFox 29, Opera 12.16 (64bit)<br/>
Windows 10 64bit: in IE11 and Edge 38, Chrome 56, Firefox 51<br/>
MacOS X El Captain: Safari 9, Chrome 56, Firefox 51

## Note about Safari 7+ and Cross-Domain communication

All cross-domain communication is disabled by default with Safari 7+.
Because of a feature that block 3rd party tracking for iframe, and any
iframe used for cross-domain communication runs in sandboxed environment.
That's why this library like any other solution for cross-domain comunication,
don't work on Safari.

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

## API

sysend object:

* `on(name, callback)` - `callback(object, name)` - add event handler for specified name.
* `off(name [, callback])` - remove event handler for given name, if callback is not specified it will remove all callbacks for given name.
* `broadcast(name [, object])` - send any object and fire all events with specified name (in different pages that register callback using on). You can also just send notification without an object.
* `proxy(url)` - create iframe proxy for different domain, the target domain/url should have [proxy.html](https://github.com/jcubic/sysend.js/blob/master/proxy.html) file. If url domain is the same as page domain, it's ignored. So you can put both proxy calls on both domains (new in 1.3.0)
* `serializer(to_string, from_string)` - add serializer and deserializer functions (new in 1.4.0)

## License

Copyright (C) 2014-2021 [Jakub T. Jankiewicz](http://jcubic.pl/me)<br/>
Released under the [MIT license](https://opensource.org/licenses/MIT)

This is free software; you are free to change and redistribute it.<br/>
There is NO WARRANTY, to the extent permitted by law.
