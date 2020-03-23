import { initMixin } from './init'
import { stateMixin } from './state'
import { renderMixin } from './render'
import { eventsMixin } from './events'
import { lifecycleMixin } from './lifecycle'
import { warn } from '../util/index' //上面5个方法导入  但不包括当前的warn

function Vue (options) { //定义vue构造函数
  if (process.env.NODE_ENV !== 'production' &&
    !(this instanceof Vue) //必须使用new的方法创建vue实例  否则条件不满足
  ) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  this._init(options)//在initMixin(Vue)时会为vue实例创建一个_init()方法
}
//利用class  vue实例的原型上添加5个方法 每个方法都传入了vue实例
// Vue 构造函数的定义文件，我们一直都叫其 Vue 的出生文件，主要作用是定义 Vue 构造函数，并对其原型添加属性和方法，即实例属性和实例方法
initMixin(Vue)//初始化混合 _init原型方法在此时定义
stateMixin(Vue)//状态混合
eventsMixin(Vue)//事件混合  向vue的原型注册$on $once $off $emit 4个函数
lifecycleMixin(Vue)//生命周期混合  向vue的原型注册_update $forceUpdate $destroy 4个函数
renderMixin(Vue)//渲染混合

export default Vue
