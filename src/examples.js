import StreamingSocket from '.';
import { Readable, Transform }   from 'stream';

/* To send data to the server, just call write(). */
const sock = new StreamingSocket('localhost', 7);
//sock.write('foo');

/* Likewise, to read, you can use read() */
//const sock = new StreamingSocket('localhost', 7);
//sock.write('foo');

sock.setEncoding('utf8');
//sock.on('readable', () => console.log(sock.read())); // prints "foo"

/* or you can listen for the `data` event: */
//const sock = new StreamingSocket('localhost', 7);
//sock.write('foo');

//sock.setEncoding('utf8');
//sock.on('data', x => console.log(x)); // Also prints "foo"

/* Or you can get really fancy and use pipes: */
//const sock = new StreamingSocket('localhost', 7);
//sock.setEncoding('utf8');

class ArrayStream extends Readable {
    constructor(array) {
        super();
        this.array = array;
        this.pos = 0;
        this.length = array.length;
    }
    _read() {
        this.push(this.pos < this.length ? this.array[this.pos++] : null);
    }
}

class PrependCount extends Transform {
    constructor() {
        super();
        this.n = 0;
    }

    _transform(line, encoding, processed) {
        this.push(this.n++ + ': ' + line);
        processed();
    }

    _flush() { }
}

new ArrayStream(['one', 'two', 'three', 'four', 'five'])
    .pipe(sock)
    .pipe(new PrependCount())
    .pipe(process.stdout);



