process.env.DEBUG = 'wind:*';
const test = require('ava'),
    getPort = require('get-port'),
    BootStrap = require('../src/bootstrap');

test('Base boot and stop', async t => {
    const config = {
            debug: 'wind:boot',
            port: await getPort()
        },
        boot = new BootStrap(config);

    await boot.start();
    t.is(3, 3);
    await boot.stop();
});

async function sleep(t) {
    return new Promise(resolve => {
        setTimeout(resolve, t);
    });
}

test('Test module hook to be invoked', async t => {
    const module1 = {
            created(app) {
                app.created = true;
            },
            ready(app) {
                app.ready = true;
            },
            bootComplete(app) {
                app.bootfin = true;
            }
        },
        // 异步模块 .2秒后抛出异常
        moduleError = async function(app) {
            await sleep(200);
            app.notExistedFunctionCall();
            app.module4 = true;
        },
        // 同步模块 直接抛出异常
        moduleError2 = function(app) {
            app.notExistedFunctionCall2();
        },
        // 同步执行后抛出异常
        module2 = function(app) {
            app.module2 = true;
            throw Error('error');
        },
        // 异步模块 执行需要.5s
        module3 = async function(app) {
            await sleep(500);
            app.module3 = true;
        },
        config = {
            port: await getPort(),
            debug: 'wind:boot',
            packages: [module1, moduleError, moduleError2, module2, module3]
        },
        boot = new BootStrap(config);

    await boot.start();

    // test of hooks
    t.is(boot.app.created, true);
    t.is(boot.app.ready, true);
    t.is(boot.app.bootfin, true);
    t.is(boot.app.module2, true);
    t.is(boot.app.module3, true);
    t.is(boot.app.module4, undefined);
    await boot.stop();
});

class Service {
    constructor(props) {
        this.service2 = null;
    }
}

test('Test of service autowire', async t => {
    const module1 = {
            created(app) {
                app.services.service1 = new Service();
                app.services.service2 = new Service();
            },
            async ready(app) {
                //  t.is(app.services.service1.service2, app.services.service2);
            }
        },
        config = {
            debug: 'wind:boot',
            packages: [module1],
            port: await getPort()
        },
        boot = new BootStrap(config);

    await boot.start();
    const app = boot.app;

    t.is(app.services.service1.service2, app.services.service2);
    await boot.stop();
});

test('Test of load module', async t => {
    const module1 = () => {},
        config = {
            debug: 'wind:boot',
            packages: [module1],
            port: await getPort()
        },
        boot = new BootStrap(config);

    await boot.start();

    const module2 = async(app) => {
        app.module2Loaded = true;
    };

    await boot.loadPackage(module2);

    t.is(true, boot.app.module2Loaded);
    await boot.stop();
});
