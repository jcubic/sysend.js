[![npm](https://img.shields.io/badge/npm-1.2.0-blue.svg)](https://www.npmjs.com/package/sysend)
![bower](https://img.shields.io/badge/bower-1.2.0-yellow.svg)

## sysend.js

sysend.js is small library that allow to send message between pages that are
open in the same browser. They need to be in same domain. The library don't use
any dependencies and use HTML5 LocalStorage API or BroadcastChannel API.
If your browser don't support BroadcastChannel (see [Can I Use](https://caniuse.com/#feat=broadcastchannel))
then you can send any object that can be serialized to JSON with BroadcastChannel you can send any object
(it will not be serialized to string). You can also send empty notification.


Tested on:

GNU/Linux: in Chromium 34, FireFox 29, Opera 12.16 (64bit)<br/>
Windows 10 64bit: in IE11 and Edge 38, Chrome 56, Firefox 51<br/>
MacOS X El Captain: Safari 9, Chrome 56, Firefox 51

## Instalation

Include `sysend.js` file in your html, you can grab the file from npm:

```
npm install sysend
```

or bower


```
bower install sysend
```

you can also get it from [unpkg.com CDN](https://unpkg.com/sysend)


## Usage

```javascript

window.onload = function() {
    sysend.on('foo', function(message) {
        console.log(message);
    });
    var input = document.getElementsByTagName('input')[0];
    document.getElementsByTagName('button')[0].onclick = function() {
        sysend.broadcast('foo', {message: input.value});
    };
};
```

## Demo

Open this [demo page](http://jcubic.pl/sysend.php) in two tabs/windows

The demo also use iframe proxy to send message to different domain (on firefox you need to add CORS for the iframe see [Cross-Domain LocalStorage](https://jcubic.wordpress.com/2014/06/20/cross-domain-localstorage/))

## API

sysend object:

* on(name, callback)  - callback(object, name) - add event of specified name
* off(name [, callback]) - remove callback
* broadcast(name [, object]) - send object and fire all events with specified name (in different pages that register callback using on). You can also just send notification without object

## License

Copyright (C) 2014-2017 [Jakub Jankiewicz](http://jcubic.pl)<br/>
Released under the [MIT license](https://opensource.org/licenses/MIT)

This is free software; you are free to change and redistribute it.<br/>
There is NO WARRANTY, to the extent permitted by law.
