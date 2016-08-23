## sysend.js

sysend.js is small library that allow to send message between pages that are
open in the same browser. They need to be in same domain. The library don't use
any dependencies and use HTML5 LocalStorage API. You can send any object that
can be serialized to JSON or just send empty notification.

Tested on GNU/Linux in Chromium 34, FireFox 29, Opera 12.16 (64bit)

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

## API

sysend object:

* on(name, callback)  - callback(object, name) - add event of specified name
* off(name [, callback]) - remove callback
* broadcast(name [, object]) - send object and fire all events with specified name (in different pages that register callback using on). You can also just send notification without object

## License

Copyright (C) 2014 Jakub Jankiewicz <http://jcubic.pl><br/>
Released under the MIT license <https://opensource.org/licenses/MIT>

This is free software; you are free to change and redistribute it.<br/>
There is NO WARRANTY, to the extent permitted by law.
