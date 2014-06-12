## sysend.js

sysend.js is small library that allow to send message between page that are
open in same browser. They need to be in same domain.

The library don't use any dependencies and use HTML5 LocalStorage API.
You can send any object that can be serialized to JSON.

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



## API

sysend:

* on(name, callback)  - callback(message, name) - add event
* off(name [, callback]) - remove event
* broadcast(name, object) - send message and fire all events with specified name

## License

Copyright (C) 2014 Jakub Jankiewicz <http://jcubic.pl>
License GPLv3+: GNU GPL version 3 or later <http://gnu.org/licenses/gpl.html>

This is free software; you are free to change and redistribute it.
There is NO WARRANTY, to the extent permitted by law.
