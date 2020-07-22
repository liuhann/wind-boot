const Koa = require('koa'),
    http = require('http'),
    https = require('https'),
    fs = require('fs');
const debug = require('debug')('wind:boot');

class BootStrap {
    constructor(config) {
        this.config = Object.assign({
            port: 8080, // REST服务端口
            httpsPort: 8091,
            public: './public', // 静态资源托管
            api: '/api',
            packages: [] // 模块列表，按序启动
        }, config);
    }

    async start() {
        const app = new Koa();

        // 设置booter到app
        app.booter = this;

        app.config = this.config;

        app.services = app.context.services = {};
        if (this.config.packages) {
            app.packages = app.context.packages = this.config.packages.filter(packageModule => !packageModule.disabled);
            delete this.config.packages;
        }

        debug('config %O', this.config);
        // 加载所有模块、初始化服务实例、调用模块created方法

        this.app = app;
        await this.packagesCreated();

        // 服务依赖的自动注入 使用_service方式
        await this.initPackageService();

        // 调用模块的ready方法
        await this.packagesReady();

        // 启动收尾，供系统级应用做最后的绑定
        await this.bootComplete();

        const bootFailed = app.packages.filter(p => p.err);

        if (bootFailed.length) {
            debug('以下模块启动失败');
            for (const packageModule of bootFailed) {
                debug(`${packageModule.description || ''}[${packageModule.name}]`);
            }
        }
        // active http
        // this.httpserver = this.app.listen(this.config.port);

        this.httpServer = http.createServer(app.callback()).listen(this.config.port);

        debug('√ http listening port: ' + this.config.port);
        if (this.config.httpsPort && this.config.httpsKey && this.config.httpsCert) {
            https.createServer({
                key: fs.readFileSync(this.config.httpsKey),
                cert: fs.readFileSync(this.config.httpsCert)
            }, app.callback()).listen(this.config.httpsPort);
            debug('√ https listening port: ' + this.config.httpsPort);
        }
        debug('√ boot complete');
    }

    async stop() {
        debug('stopping server');
        this.httpServer.close();
        debug('listing port stop sended');
    }

    async restart() {
        debug('stoppin server');
        this.httpServer.close(async err => {
            debug('listing port stopped');
            if (err) {
                debug('error:');
                debug(err);
            }
            debug('restarting .....');
            await this.start();
        });
    }

    /**
     * 模块进行依次加载并依次调用模块的created方法，
     * created方法主要是工作是系统类模块进行koa插件注册、业务模块进行对外服务初始化并挂载到app上
     * @return {Promise<void>}
     **/
    async packagesCreated() {
        for (let i = 0; i < this.app.packages.length; i++) {
            const packageModule = this.app.packages[i];

            delete packageModule.err;
            debug(`preparing module ${packageModule.description || ''}[${packageModule.name}]..`);
            if (packageModule.created) {
                try {
                    await packageModule.created(this.app);
                } catch (e) {
                    debug(`module created fail: ${packageModule.name}`);
                    debug('error %O', e);
                    packageModule.err = e;
                    continue;
                }
            }
        }
    }

    /**
     * 进行服务的自动发现、注册
     * 规则就是按名称进行匹配 _不进行注入
     * @return {Promise<void>}
     */
    async initPackageService() {
        // fulfill service dependencies
        const services = this.app.services;

        for (const serviceName in services) {
            // service list
            const constructorDefinedRefs = Object.getOwnPropertyNames(services[serviceName]);

            debug('service ' + serviceName + ':' + (typeof constructorDefinedRefs));
            // iterate fields of service
            for (const refName of constructorDefinedRefs) {
                // inject service by name
                if (!refName.startsWith('_') && // field start with underline is considered not to be service
          services[serviceName][refName] == null) {
                    services[serviceName][refName] = services[refName];
                }
            }
        }
    }

    /**
     * 模块初始化相关处理
     * @return {Promise<void>}
     */
    async packagesReady() {
        for (const packageModule of this.app.packages) {
            // 前面出错的模块不再继续执行
            if (packageModule.err) {
                continue;
            }
            try {
                if (packageModule.ready) {
                    await packageModule.ready(this.app);
                } else if (typeof packageModule === 'function') {
                    await packageModule(this.app);
                }
            } catch (err) {
                // ignore failed module
                debug(`module ${packageModule.name} ready failed:`, err);
                packageModule.err = err;
            }
        }
    }

    /**
     * 模块启动完成回调
     * @return {Promise<void>}
     */
    async bootComplete() {
        for (let i = this.app.packages.length - 1; i >= 0; i--) {
            const packageModule = this.app.packages[i];

            if (packageModule.err) {
                continue;
            }
            try {
                packageModule.bootComplete && await packageModule.bootComplete(this.app);
            } catch (err) {
                // ignore failed module
                debug(`module ${packageModule.name} complete failed:`, err);
                packageModule.err = err;
            }
        }
    }

    async loadPackage(packageModule) {
        try {
            if (packageModule.created) {
                await packageModule.created(this.app);
            }
            if (packageModule.ready) {
                packageModule.ready(this.app);
            } else if (typeof packageModule === 'function') {
                packageModule(this.app);
            }
            return 'success';
        } catch (err) {
            // 模块加载失败
            debug(err);
            packageModule.err = err;
            return err;
        }
    }
}
module.exports = BootStrap;
