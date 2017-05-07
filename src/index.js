import { Socket }   from 'net';
import { Duplex }   from 'stream';
import { nextTick } from 'process';

import util from 'util';

import $$observable from 'symbol-observable';

const debug = require('debug')('message-socket');

const $private = Symbol();

function NOOP() { }
function getObserver(observerOrOnNext, error = NOOP, complete = NOOP) {
    if (typeof observerOrOnNext === 'function') {
        return {
            next: observerOrOnNext,
            error,
            complete
        };
    }
    else return observerOrOnNext;
}

class Subject {
    constructor() {
        this._observers = [];
    }

    next() {
        if (!this._observers || !this._observers.length) return;

        debug('there are %d observers', this._observers.length);

        this
            ._observers
            .forEach(
                (x, i) => {
                    debug(`delivering to ${i+1}`);
                    if (x != null) {
                        x.next(...arguments)
                    }
                }
            );

        this._observers = this._observers.filter(x => x != null);
    }

    error() {
        this._observers.forEach(x => x && x.error(...arguments));
        this._observers = [];
    }

    complete() {
        this._observers.forEach(x => x && x.complete(...arguments));
        this._observers = [];
    }

    asObservable() {
        const self = this;
        return {
            [$$observable]() {
                return this;
            },

            subscribe() {
                return self.subscribe(...arguments);
            }
        }
    }

    [$$observable]() {
        return this.asObservable();
    }

    subscribe() {
        const observer = getObserver(...arguments);
        const self = this;
        self._observers.push(observer);
        return {
            unsubscribe() {
                const idx = self._observers.indexOf(observer);
                if (idx >= 0) {
                    self._observers[idx] = null;
                }
            }
        };
    }
}

function setUpConnection() {
    let socket =
        new Socket({
            readable: true,
            writable: true
        });

    if (this[$private].encoding) {
        debug('setting encoding');
        socket.setEncoding(this[$private].encoding);
    }
    else {
        socket._readableState.decoder;
    }

    this[$private].socket = socket;
    this[$private].subject = new Subject();

    let handleClose = () => {
        this[$private].socket    = undefined;
        this[$private].connected = undefined;
    }

    let emptyBuffer = () => {
        return this[$private].encoding
            ? ''
            : new Buffer([])
    }

    function concat(...others) {
        return typeof this === 'string'
            ? this.concat(...others)
            : Buffer.concat([this, ...others]);
    }

    let handleConnect = () => {
        debug("socket connected; let's do some work");

        this[$private].connected = true;
        socket.on('readable', () => {
            const raw = socket.read();
            let buffer = this[$private].buffer::concat(raw == null ? emptyBuffer() : raw);
            debug('buffer: ' + util.inspect(buffer));

            let m, splitter = this[$private].bufferSplitter;

            let [ messages, leftover ] = splitter(buffer)

            debug('leftover: ' + leftover);

            this[$private].buffer = leftover || emptyBuffer();

            messages
                .forEach(
                    msg => {
                        if (this[$private].isReading) {
                            this.push(msg);
                        }
                        else {
                            this[$private].incomingQueue.push(msg);
                        }

                        this[$private].subject.next(msg);
                    }
                );
        });

        nextTick(() => {
            this::processQueue()
        });
    };

    socket
        .on('connect', handleConnect)
        .on('close',   handleClose)
        ;

    socket.connect(this._port, this._ip);
}

function processQueue() {
    const {
        outgoingQueue = [],
        alreadyWorking,
        connected,
        socket
    } = this[$private];

    // if there's nothing to do, get out.
    if (!outgoingQueue.length) {
        debug('nothing to do!');
        return;
    }

    // if we're already doing something, get out.
    if (alreadyWorking) {
        debug('already working!');
        return;
    }

    // if a connection is pending, wait.
    if (connected === false) {
        debug('connection pending');
        return;
    }

    // if there's no network connection, make one and get out.
    if (connected === undefined) {
        this[$private].connected = false;
        debug("no connection; let's make one.");
        this::setUpConnection();
        return;
    }

    debug('Getting down to business');

    // this is probably not really needed.
    this[$private].alreadyWorking = true;

    // if there is something to do and there's a connection, process
    // the first item in the queue
    let cmd = outgoingQueue.shift();
    if (typeof cmd === 'string') {
        debug("sent: " + cmd);
    } else {
        debug("sent: " + cmd.toString('hex'));
    }
    socket.write(cmd);
    nextTick(() => {
        this::processQueue();
    });
    this[$private].alreadyWorking = false;
}

class MessageSocket extends Duplex {
    static regexSplitter(regex) {
        let re = regex;

        if (!re.flags.includes('g')) {
            re = new RegExp(re.source, re.flags + 'g');
        }

        return function (buffer) {
            let m, messages = [], leftover;

            // TODO: this can probably be re-written in terms of //y
            // for that matter, why is it different from str.split()?
            // is it the leftovers?
            do {
                let lastIdx = re.lastIndex;

                m = re.exec(buffer);
                if (m) {
                    messages.push(m[1] || m[0]);
                }
                else {
                    leftover = buffer.substr(lastIdx);
                }
            } while (m);

            return [ messages, leftover ];
        }

    }

    constructor(ip, port, splitter, encoding = 'utf8') {
        super();

        this._ip   = ip;
        this._port = port;

        let bufferSplitter =
            typeof splitter === 'function'
                ? splitter
                : splitter && splitter.constructor === RegExp
                    ? MessageSocket.regexSplitter(splitter)
                    : MessageSocket.regexSplitter(/.*/g)

        this[$private] = {
            outgoingQueue: [],
            incomingQueue: [],
            connected:     false,
            buffer:        encoding ? '' : new Buffer([]),
            bufferSplitter,
            encoding
        }

        debug("no connection; let's make one.");
        this::setUpConnection();
    }

    _read(size) {
        let priv = this[$private];

        priv.isReading = true;

        // first empty the queue if there is one
        while (priv.isReading && priv.incomingQueue.length) {
            let msg = priv.incomingQueue.shift();
            priv.isReading = this.push(msg);
        }
    }

    get connected() {
        return this[$private].connected;
    }

    _write(chunk, encoding, callback) {
        this.send(chunk.toString());
        callback();
    }

    send(data) {
        this[$private].outgoingQueue.push(data);
        nextTick(() => this::processQueue())
    }

    close() {
        const { socket } = this[$private];
        this[$private].outgoingQueue = [];
        socket && socket.end();
    }

    asObservable() {
        return this[$private].subject.asObservable();
    }

    [$$observable]() {
        return this.asObservable();
    }
}

export {
    MessageSocket as default
}
