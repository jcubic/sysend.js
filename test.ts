// this is test file for TypeScript types

import sysend from '.';

sysend.on("foo", function(message: string) {
    console.log(message.toUpperCase());
});

sysend.broadcast("foo", "hello");

type payload = {
    message: string
};

sysend.on("bar", function(data: payload) {
    console.log(data.message.toUpperCase());
});

const data: payload = { message: "something" };

sysend.broadcast("bar", data);

sysend.proxy("https://example.com");

sysend.serializer(function(data) {
    return JSON.stringify(data);
}, function(string) {
    return JSON.parse(string);
});
