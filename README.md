# message-socket
> A TCP client socket with customizable message parsing, automatic restoration of lost connections, outgoing message queueing, and more

[![NPM Version][npm-image]][npm-url]
[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE.md)

message-socket is a Node.js library that makes writing raw TCP clients much easier.  Two features are primarily responsible for this ease of use: customizable incoming message parsing, and queueing of outgoing messages during lost connections.

But those aren't the `MessageSocket`'s only tricks! Just like plain `net.Socket` objects, `MessageSocket`s can act as as duplex streams, but they can also be easily converted to `Observable`s of incoming messages.

## Getting Started

message-socket is distributed through NPM:

```sh
npm install message-socket

# or, if you prefer:
yarn add message-socket
```

## Examples

For these examples, assume that `echo.example.com` is an [echo server](https://en.wikipedia.org/wiki/Echo_Protocol).  If you need one to test with, try this:

```sh
sudo socat PIPE TCP-LISTEN:7,fork
```

By default, `MessageSocket` will treat the entire incoming buffer as a single message encoded in utf8. However, this behavior can be easily customized by providing either a `RegExp` or a parsing function.  The encoding can also be changed, or removed entirely if you need a binary `Buffer`.

```javascript
import MessageSocket from 'message-socket';

const sock = new MessageSocket('echo.example.com', 7);
sock.on('data', function(message) {
  console.dir(message)
});

sock.send("My message");
sock.close();

// 'My message' is printed to the console
```

In this example, the 'data' event is fired twice because the `RegExp` matches twice on the given buffer.
```javascript
import MessageSocket from 'message-socket';

let sock = new MessageSocket('echo.example.com', 7, /([^:]+):/g);
sock.on('data', function(message) {
  console.dir(message) # prints 'My message'
});

sock.send("My:message:");
sock.close();

// 'My' is printed to the console
// 'message' is printed to the console.
```

The final constructor argument is an optional encoding to be used instead of `utf8`; passing `null` will cause the socket to return binary `Buffer` objects instead of strings.

If a simple `RegExp` isn't enough to parse your messages, you an provide a parsing function:
```javascript
function parseMessage(buffer) {
    // Do the actual parsing work
    // ...

    // for the below, assume:
    //  - messages is an array of parsed messages
    //  - leftovers is whatever data was left at the end of the buffer that does not represent an entire message

    return [ messages, leftovers ];
}
```

Another helpful feature of the `MessageSocket` is that it can help you weather temporary connection losses without losing messages.  If the underlying network connection should happen to get closed, outgoing messages will start going into a queue.  Each attempt to send another message will trigger an attempt to reconnect.  Upon successful reconnection, pending messages will be sent.  As of now, this behavior is not configurable, but future enhancements could include controlling the size and lifetime of the queue, or disabling it entirely.

A `MessageSocket` can also be easily converted to an `Observable` of messages:
```javascript
import MessageSocket from 'message-socket';

const sock = new MessageSocket('echo.example.com', 7);

sock
  .asObservable()
  .subscribe(
      msg => console.dir(msg)
  )

sock.send("My message");
sock.close();

// 'My message' is printed to the console
```

Or with a more feature-rich Observable library:

```javascript
import MessageSocket from 'message-socket';
import { Observable } from 'rxjs';

const sock = new MessageSocket('echo.example.com', 7);

Observable
  .from(
      sock
  )
  .map(x => x.toUpperCase()
  .subscribe(
      msg => console.dir(msg)
  )

sock.send("My message");
sock.close();

// 'MY MESSAGE' is printed to the console
```

## Compatibility

`message-socket` is built to support Node.js version 6.0 or higher.

## Contributing

Contributions are of course always welcome.  If you find problems, please report them in the [Issue Tracker](http://www.github.com/forty2/message-socket/issues/).  If you've made an improvement, open a [pull request](http://www.github.com/forty2/message-socket/pulls).

Getting set up for development is very easy:
```sh
git clone <your fork>
cd message-socket
yarn
```

And the development workflow is likewise straightforward:
```sh
# make a change to the src/ file, then...
yarn build
node dist/index.js

# or if you want to clean up all the leftover build products:
yarn run clean
```

## Release History
* 1.0.4
    * Minor debugging updates

* 1.0.0
    * The first release.

## Meta

Zach Bean – zb@forty2.com

Distributed under the MIT license. See [LICENSE](LICENSE.md) for more detail.

[npm-image]: https://img.shields.io/npm/v/message-socket.svg?style=flat
[npm-url]: https://npmjs.org/package/message-socket
