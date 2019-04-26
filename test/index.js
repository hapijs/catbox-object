'use strict';

const Adapter = require('..');
const Catbox = require('@hapi/catbox');
const Code = require('@hapi/code');
const Hoek = require('@hapi/hoek');
const Lab = require('@hapi/lab');


const internals = {};


const { describe, it } = exports.lab = Lab.script();
const expect = Code.expect;


describe('Adapter', () => {

    it('creates a new connection', async () => {

        const client = new Catbox.Client(Adapter);
        await client.start();
        expect(client.isReady()).to.equal(true);
    });

    it('closes the connection', async () => {

        const client = new Catbox.Client(Adapter);
        await client.start();
        expect(client.isReady()).to.equal(true);
        await client.stop();
        expect(client.isReady()).to.equal(false);
    });

    it('gets an item after setting it', async () => {

        const client = new Catbox.Client(Adapter);
        await client.start();
        const key = { id: 'x', segment: 'test' };
        await client.set(key, '123', 500);
        const result = await client.get(key);
        expect(result.item).to.equal('123');
    });

    it('gets a buffer', async () => {

        const buffer = Buffer.from('string value');
        const client = new Catbox.Client(new Adapter());

        await client.start();
        const key = { id: 'x', segment: 'test' };
        await client.set(key, buffer, 500);
        const result = await client.get(key);
        expect(result.item instanceof Buffer).to.equal(true);
        expect(result.item).to.shallow.equal(buffer);
    });

    it('gets an item after setting it (no memory limit)', async () => {

        const client = new Catbox.Client(new Adapter({ maxSize: 0 }));

        await client.start();
        const key = { id: 'x', segment: 'test' };
        await client.set(key, '123', 500);
        const result = await client.get(key);
        expect(result.item).to.equal('123');
        await client.set(key, '345', 500);
        const data = await client.get(key);
        expect(data.item).to.equal('345');
    });

    it('ignored starting a connection twice chained', async () => {

        const client = new Catbox.Client(Adapter);
        await client.start();
        expect(client.isReady()).to.equal(true);
        await client.start();
        expect(client.isReady()).to.equal(true);
    });

    it('returns not found on get when using null key', async () => {

        const client = new Catbox.Client(Adapter);
        await client.start();
        const result = await client.get(null);
        expect(result).to.equal(null);
    });

    it('returns not found on get when item expired', async () => {

        const client = new Catbox.Client(Adapter);
        await client.start();
        const key = { id: 'x', segment: 'test' };
        await client.set(key, 'x', 1);
        await Hoek.wait(2);
        const result = await client.get(key);
        expect(result).to.equal(null);
    });

    it('errors on set when using null key', async () => {

        const client = new Catbox.Client(Adapter);
        await client.start();
        await expect(client.set(null, {}, 1000)).to.reject();
    });

    it('errors on get when using invalid key', async () => {

        const client = new Catbox.Client(Adapter);
        await client.start();
        await expect(client.get({})).to.reject();
    });

    it('errors on set when using invalid key', async () => {

        const client = new Catbox.Client(Adapter);
        await client.start();
        await expect(client.set({}, {}, 1000)).to.reject();
    });

    it('ignores set when using non-positive ttl value', async () => {

        const client = new Catbox.Client(Adapter);
        await client.start();
        const key = { id: 'x', segment: 'test' };
        await expect(client.set(key, 'y', 0)).to.not.reject();
    });

    it('errors on get when stopped', async () => {

        const client = new Catbox.Client(Adapter);
        await client.stop();
        const key = { id: 'x', segment: 'test' };
        expect(() => client.connection.get(key)).to.throw();
    });

    it('errors on set when stopped', async () => {

        const client = new Catbox.Client(Adapter);
        await client.stop();
        const key = { id: 'x', segment: 'test' };
        expect(() => client.connection.set(key, 'y', 1)).to.throw();
    });

    it('errors on missing segment name', () => {

        const config = {
            expiresIn: 50000
        };

        const fn = () => {

            const client = new Catbox.Client(Adapter);
            const cache = new Catbox.Policy(config, client, '');    // eslint-disable-line no-unused-vars
        };

        expect(fn).to.throw(Error);
    });

    it('errors on bad segment name', () => {

        const config = {
            expiresIn: 50000
        };

        const fn = () => {

            const client = new Catbox.Client(Adapter);
            const cache = new Catbox.Policy(config, client, 'a\u0000b');    // eslint-disable-line no-unused-vars
        };

        expect(fn).to.throw(Error);
    });

    describe('start()', () => {

        it('creates an empty cache object', async () => {

            const memory = new Adapter();
            expect(memory.cache).to.not.exist();
            await memory.start();
            expect(memory.cache).to.exist();
            await memory.stop();
        });
    });

    describe('stop()', () => {

        it('sets the cache object to null', async () => {

            const memory = new Adapter();
            expect(memory.cache).to.not.exist();
            await memory.start();
            expect(memory.cache).to.exist();
            memory.stop();
            expect(memory.cache).to.not.exist();
            expect(memory._timer).to.not.exist();
        });
    });

    describe('get()', () => {

        it('returns not found on missing item', async () => {

            const memory = new Adapter();
            await memory.start();
            await memory.set({ segment: 'test', id: 'test1' }, 'test', 1000);
            const result = await memory.get({ segment: 'test', id: 'test2' });
            expect(result).to.be.null();

            await memory.stop();
        });

        it('returns not found on missing segment', async () => {

            const key = {
                segment: 'test',
                id: 'test'
            };

            const memory = new Adapter();
            expect(memory.cache).to.not.exist();

            await memory.start();
            expect(memory.cache).to.exist();
            const result = await memory.get(key);
            expect(result).to.be.null();

            await memory.stop();
        });
    });

    describe('set()', () => {

        it('adds an item to the cache object', async () => {

            const key = {
                segment: 'test',
                id: 'test'
            };

            const memory = new Adapter();
            expect(memory.cache).to.not.exist();

            await memory.start();
            expect(memory.cache).to.exist();

            const value = { a: 1 };
            await memory.set(key, value, 10);
            expect(memory.cache.get(key.segment).get(key.id).item).to.shallow.equal(value);

            await memory.stop();
        });

        it('removes an item from the cache when it expires', async () => {

            const key1 = {
                segment: 'test',
                id: 'test1'
            };

            const key2 = {
                segment: 'test',
                id: 'test2'
            };

            const memory = new Adapter({ minCleanupIntervalMsec: 200 });
            expect(memory.cache).to.not.exist();

            await memory.start();

            expect(memory.cache).to.exist();
            await memory.set(key1, 'myvalue1', 80);
            await memory.set(key2, 'myvalue2', 400);

            expect(memory.cache.get(key1.segment).get(key1.id).item).to.equal('myvalue1');
            expect(memory.get(key1).item).to.equal('myvalue1');
            await Hoek.wait(240);
            expect(memory.cache.get(key1.segment).get(key1.id)).to.not.exist();
            expect(memory.cache.get(key2.segment).get(key2.id)).to.exist();

            await memory.stop();
        });

        it('removes multiple items from the cache when they expire', async () => {

            const key1 = {
                segment: 'test',
                id: 'test1'
            };

            const key2 = {
                segment: 'test',
                id: 'test2'
            };

            const memory = new Adapter({ minCleanupIntervalMsec: 100 });
            expect(memory.cache).to.not.exist();

            await memory.start();

            expect(memory.cache).to.exist();
            await memory.set(key1, 'myvalue1', 110);
            await memory.set(key2, 'myvalue2', 110);

            expect(memory.get(key1).item).to.equal('myvalue1');
            expect(memory.get(key2).item).to.equal('myvalue2');
            await Hoek.wait(140);
            expect(memory.cache.get(key1.segment).get(key1.id)).to.not.exist();
            expect(memory.cache.get(key2.segment).get(key2.id)).to.not.exist();

            expect(memory._timer).to.not.exist();
            await memory.stop();
        });

        it('removes an item from the cache when it expires on get', async () => {

            const key = {
                segment: 'test',
                id: 'test'
            };

            const memory = new Adapter({ cleanupIntervalMsec: 50 });
            expect(memory.cache).to.not.exist();

            await memory.start();

            expect(memory.cache).to.exist();
            await memory.set(key, 'myvalue', 10);

            expect(memory.cache.get(key.segment).get(key.id).item).to.equal('myvalue');
            expect(memory.get(key).item).to.equal('myvalue');
            await Hoek.wait(15);
            expect(memory.get(key)).to.not.exist();
            expect(memory.cache.get(key.segment).get(key.id)).to.not.exist();

            await memory.stop();
        });

        it('errors when the maxSize has been reached', async () => {

            const memory = new Adapter({ maxSize: 1 });
            expect(memory.cache).to.not.exist();

            await memory.start();

            expect(memory.cache).to.exist();
            memory.set({ segment: 'test', id: 'test1' }, 'test');
            expect(() => memory.set({ segment: 'test', id: 'test2' }, 'myvalue', 10)).to.throw();

            await memory.stop();
        });
    });

    describe('drop()', () => {

        it('drops an existing item', async () => {

            const client = new Catbox.Client(Adapter);
            await client.start();
            const key = { id: 'x', segment: 'test' };
            await client.set(key, '123', 500);
            const result = await client.get(key);
            expect(result.item).to.equal('123');
            await client.drop(key);
        });

        it('drops an item from a missing segment', async () => {

            const client = new Catbox.Client(Adapter);
            await client.start();
            const key = { id: 'x', segment: 'test' };
            await client.drop(key);
        });

        it('drops a missing item', async () => {

            const client = new Catbox.Client(Adapter);
            await client.start();
            const key = { id: 'x', segment: 'test' };
            await client.set(key, '123', 500);
            const result = await client.get(key);
            expect(result.item).to.equal('123');
            await client.drop({ id: 'y', segment: 'test' });
        });

        it('errors on drop when using invalid key', async () => {

            const client = new Catbox.Client(Adapter);
            await client.start();
            await expect(client.drop({})).to.reject();
        });

        it('errors on drop when using null key', async () => {

            const client = new Catbox.Client(Adapter);
            await client.start();
            await expect(client.drop(null)).to.reject();
        });

        it('errors on drop when stopped', async () => {

            const client = new Catbox.Client(Adapter);
            await client.stop();
            const key = { id: 'x', segment: 'test' };
            await expect(() => client.connection.drop(key)).to.throw();
        });

        it('errors when cache item dropped while stopped', async () => {

            const client = new Catbox.Client(Adapter);
            await client.stop();
            await expect(client.drop('a')).to.reject();
        });
    });

    describe('validateSegmentName()', () => {

        it('errors when the name is empty', () => {

            const memory = new Adapter();
            expect(() => memory.validateSegmentName('')).to.throw('Empty string');
        });

        it('errors when the name has a null character', () => {

            const memory = new Adapter();
            expect(() => memory.validateSegmentName('\u0000test')).to.throw();
        });

        it('returns null when there are no errors', () => {

            const memory = new Adapter();
            expect(() => memory.validateSegmentName('valid')).to.not.throw();
        });
    });
});
