<p align="center">
  <img src="https://github.com/jcubic/sysend.js/blob/master/assets/logo.svg?raw=true" alt="Sysend.js logo"/>
</p>

[![npm](https://img.shields.io/badge/npm-1.16.3-blue.svg)](https://www.npmjs.com/package/sysend)
![bower](https://img.shields.io/badge/bower-1.16.3-yellow.svg)
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
communication, don't work on Safari.

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

jsDelivr will minify the file. From my testing it's faster than unpkg.com.

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

### Windows/tabs tracking

Tracking is high level API build on top of `on()` and `broadcast()`, that allows to manage windows/tabs. You can sent message directly to other windows/tabs:

```javascript
sysend.track('message', ({data, origin}) => {
    console.log(`${origin} send message "${data}"`);
});
sysend.post('<ID>', 'Hello other window/tab');
```

and listen to events like:

```javascript
sysend.track('open', (data) => {
    console.log(`${data.id} window/tab just opened`);
});
```

Other tracking events includes: close/primary/secondary executed when window/tab is closed or become primary or secondary. Track method was added in version 1.6.0. Another required event is `ready` (added in 1.10.0) that should be used when you want to get list of windows/tabs:

```javascript
sysend.track('ready', () => {
    sysend.list().then(tabs => {
        console.log(tabs);
    });
});
```

with `list()` method and `open`/`close` events you can implement dynamic list of windows/tab. That will change when new window/tab is open or close.

```javascript
let list = [];

sysend.track('open', data => {
    if (data.id !== sysend.id) {
        list.push(data);
        populate_list(list);
    }
});

sysend.track('close', data => {
    list = list.filter(tab => data.id !== tab.id);
    populate_list(list);
});

sysend.track('ready', () => {
    sysend.list().then(tabs => {
        list = tabs;
        populate_list(list);
    });
});

function populate_list() {
    select.innerHTML = '';
    list.forEach(tab => {
        const option = document.createElement('option');
        option.value = tab.id;
        option.innerText = tab.id;
        select.appendChild(option);
    });
}
```

In version 1.16.0 this code was abstracted into:

```javascript
sysend.track('update', (list) => {
   populate_list(list);
});
```

This can be simplified with point free style:

```javascript
sysend.track('update', populate_list);
```

### RPC mechanism

In version 1.15.0 new API was added called `rpc()` (build on top of tracking mechanism) that allow to use RPC (Remote Procedure Call) between open windows/tabs.

```javascript
const rpc = sysend.rpc({
    get_message() {
        return document.querySelector('input').value;
    }
});

button.addEventListener('click', () => {
    rpc.get_message('<ID>').then(message => {
        console.log(`Message from other tab is "${message}"`);
    }).catch(e => {
        console.log(`get_message (ERROR) ${e.message}`);
    });
});
```

### Cross-Domain communication

If you want to add support for Cross-Domain communication, you need to call proxy method with url on target domain
that have [proxy.html file](https://github.com/jcubic/sysend.js/blob/master/proxy.html).

```javascript
sysend.proxy('https://jcubic.pl');
sysend.proxy('https://terminal.jcubic.pl');
```

on Firefox you need to add **CORS** for the proxy.html that will be loaded into iframe (see [Cross-Domain LocalStorage](https://jcubic.wordpress.com/2014/06/20/cross-domain-localstorage/)).

### Serialization

if you want to send custom data you can use serializer (new in 1.4.0) this API
was created for localStorage that needs serialization.

Example serializer can be [json-dry](https://github.com/11ways/json-dry):

```javascript
sysend.serializer(function(data) {
    return Dry.stringify(data);
}, function(string) {
    return Dry.parse(string);
});
````

or [JSON5](https://json5.org/):

```javascript
sysend.serializer(function(data) {
    return JSON5.stringify(string);
}, function(string) {
    return JSON5.parse(string);
});
````

### Security protection

Since version 1.10.0 as a security mesure Cross-Domain communication has been limited to only those domains that are allowed.
To allow domain to listen to sysend communication you need to specify channel inside iframe. You need add your origins to the
`sysend.channel()` function (origin is combination of protocol domain and optional port).


## Demos

* [Simple demo using iframes](https://jcubic.pl/sysend-demo/).
* [All feature demo](http://jcubic.pl/sysend.php) (this one require open in two tabs/windows, there is also link to other domain).
* [ReactJS shopping cart synchronization](https://codepen.io/jcubic/pen/QWgmBmE).
* [multiple window tracking demo](https://jcubic.pl/windows.html). Open the link in multiple windows (not tabs). First window will track position and size for all windows.
* [Multiple windows with interactive Canvas demo](https://codepen.io/jcubic/pen/ZEjXBVg), this demo draws circle on the Canvas that follow the mouse. Open the page in multiple windows (not tabs). The best effect is when the circle is between two windows.

![Screen capture of Operating System Windows dragging and moving around animation](https://github.com/jcubic/sysend.js/blob/master/assets/windows-demo.gif?raw=true)

![Screen capture of multiple browser windows and interactive circle that follow the mouse](https://github.com/jcubic/sysend.js/blob/master/assets/canvas-demo.gif?raw=true)

## API

sysend object:

| function | description | arguments | Version |
|---|---|---|---|
| `on(name, callback)` | add event handler for specified name | name - `string` - The name of the event<br>callback - function `(object, name) => void` | 1.0.0 |
| `off(name [, callback])` | remove event handler for given name, if callback is not specified it will remove all callbacks for given name | name - `string` - The name of the event<br>callback - optional function `(object, name) => void` | 1.0.0 |
| `broadcast(name [, object])` | send any object and fire all events with specified name (in different pages that register callback using on). You can also just send notification without an object | name - string - The name of the event<br>object - optional any data | 1.0.0 |
| `proxy(<urls>)` | create iframe proxy for different domain, the target domain/URL should have [proxy.html](https://github.com/jcubic/sysend.js/blob/master/proxy.html)<br> file. If url domain is the same as page domain, it's ignored. So you can put both proxy calls on both | url - string | 1.3.0 |
| `serializer(to_string, from_string)` | add serializer and deserializer functions | both arguments are functions (data: any) => string | 1.4.0 |
| `emit(name, [, object])` | same as `broadcast()` but also invoke the even on same page | name - string - The name of the event<br>object - optional any data | 1.5.0 |
| `post(<window_id>, [, object])` | send any data to other window | window_id - string of the target window (use `'primary'` to send to primary window)<br>object - any data | 1.6.0 / `'primary'` target 1.14.0 |
| `list()` | returns a Promise of objects `{id:<UUID>, primary}` for other windows, you can use those to send a message with `post()` | NA | 1.6.0 |
| `track(event, callback)` | track inter window communication events  | event - any of the strings: `"open"`, `"close"`, `"primary"`, <br>`"secondary"`, `"message"`, `"update"`<br>callback - different function depend on the event:<br>* `"message"` - `{data, origin}` - where data is anything the `post()` sends, and origin is `id` of the sender.<br>* `"open"` - `{count, primary, id}` when new window/tab is opened<br>* `"close"` - `{count, primary, id, self}` when window/tab is closed<br>* `"primary"` and `"secondary"` function has no arguments and is called when window/tab become secondary or primary.<br>* `"ready"` - event when tracking is ready. | 1.6.0 except `ready` - 1.10.0 and `update` - 1.16.0 |
| `untrack(event [,callback])` | remove single event listener all listeners for a given event | event - any of the strings `'open'`, `'close'`, `'primary'`, `'secondary'`, `'message'`, or `'update'`. | 1.6.0 |
| `isPrimary()` | function returns true if window is primary (first open or last that remain) | NA  | 1.6.0 |
| `channel()` | function restrict cross domain communication to only allowed domains. You need to call this function on proxy iframe to limit number of domains (origins) that can listen and send events.  | any number of origins (e.g. 'http://localhost:8080' or 'https://jcubic.github.io') you can also use valid URL. | 1.10.0 |
| `useLocalStorage([toggle])` | Function set or toggle localStorage mode. | argument is optional and can be `true` or `false`. | 1.14.0 |
| `rpc(object): Promise<fn(id, ...args): Promise>` | Function create RPC async functions which accept first additional argument that is ID of window/tab that it should sent request to. The other window/tab call the function and return value resolve original promise. | The function accept an object with methods and return a Promise that resolve to object with same methods but async. | 1.15.0 |

To see details of using the API, see [demo.html source code](https://github.com/jcubic/sysend.js/blob/master/demo.html) or [TypeScript definition file](https://github.com/jcubic/sysend.js/blob/master/sysend.d.ts).

## Story

The story of this library came from my question on StackOverflow from 2014: [Sending notifications between instances of the page in the same browser](https://stackoverflow.com/q/24182409/387194), with hint from user called **Niet the Dark Absol**, I was able to create a PoC of the solution using localStorage. I quickly created a library from my solution. I've also explained how to have [Cross-Domain LocalStorage](https://jcubic.wordpress.com/2014/06/20/cross-domain-localstorage/). The blog post have steady number of visitors (actually it's most viewed post on that blog).

And the name of the library is just random word "sy" and "send" suffix. But it can be an backronym for **Synchronizing Send** as in synchronizing application between browser tabs.

## Articles
* [CSRF Protection Problem and How to Fix it](https://www.freecodecamp.org/news/csrf-protection-problem-and-how-to-fix-it/)
* [Synchronizacja stanu aplikacji www między zakładkami](https://bulldogjob.pl/news/1804-synchronizacja-stanu-aplikacji-www-miedzy-zakladkami)

## Press
The library was featured in:
* [Web Tools Weekly](https://webtoolsweekly.com/archives/issue-378/)
* [JavaScript Weekly](https://javascriptweekly.com/issues/581)
* [Impressive Webs](https://www.impressivewebs.com/most-interesting-front-end-developer-tools-2021/)
* [Front-end Architecture](https://frontend-architecture.com/2022/03/30/messaging-between-browser-tabs/)
* [Frontend Planet](https://www.frontendplanet.com/news-for-front-end-developers-13/)

## License

Copyright (C) 2014-2023 [Jakub T. Jankiewicz](https://jcubic.pl/me)<br/>
Released under the [MIT license](https://opensource.org/licenses/MIT)

This is free software; you are free to change and redistribute it.<br/>
There is NO WARRANTY, to the extent permitted by law.
