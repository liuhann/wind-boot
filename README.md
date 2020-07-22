# wind-boot

基于koa web框架的模块化应用加载器

## 基本用法

在服务端应用中，一个应用会包含多个模块，包括底层模块、通用功能模块、通用业务模块、业务模块等。
从开发和验证角度，各种模块应该能被独立开发、测试、验证及替换（功能），从业务整合角度，这些模块又需要能被自由组合、包装成一个个具体应用。
要满足以上要求需要一个最小化的服务加载框架，基于koa的洋葱圈开发模型将各个模块组合到一起

加载框架的职责就是加载、初始化每个模块。而各个模块都是独立的，排除一些公共依赖可以进行独立部署。

基本模块化挂载

```javascript
const module1 = {
    created (app) {
      app.created = true
    },
    ready (app) {
      app.ready = true
    },
    bootComplete (app) {
      app.bootfin = true
    }
  }
  const config = {
    debug: 'wind:boot',
    packages: [module1]
  }
  const boot = new BootStrap(config)
  await boot.start()

  expect(boot.app.created).toBe(true)
  expect(boot.app.ready).toBe(true)
  expect(boot.app.bootfin).toBe(true)

  await boot.stop()
```

## 加载器流程

1. created： 
模块进行依次加载并依次调用模块的created方法，主要是工作是系统类模块进行koa插件注册、业务模块进行对外服务初始化并挂载到app上
2. auto-wire:
框架基于上一步骤对业务模块的对外服务进行自动注入（基于字段名称和服务类名的匹配）
3. ready：
业务模块初始化路由、controller、服务手动注入（不依赖auto-wire）
4. completed：
路由插件注册、koa其他内层插件注册、服务初始化（数据建表、索引、建缓存等）


## 模块规约

模块下要求有一个index.js文件，用于定义模块的服务及依赖、初始化等工作，按照上述流程，其模式如下

```javascript
module.exports = {
  name: 'moduleName',
  description: '模块名称',
  
  // 模块初始化动作，对于核心模块可以进行koa相关插件注册
  // 业务模块可以进行服务创建
  async created (app) {
    // 例如 app.context.moduleService = new ModuleService()
  },
  
  // 模块路由注册，对外提供API可在此写api相关地址
  async ready (app) {
    // 示例  
    // const router = app.context.router
    // router.get('/flaticon/search', async (ctx, next) => {
    //    ctx.moduleService.hello()
    // })
  },
  
  // 启动收尾工作，可以在此执行建库、建索引等一些全局的具体业务操作
  async bootComplete (app) {
    
  }
}

```




