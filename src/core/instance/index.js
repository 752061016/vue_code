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
initMixin(Vue)
stateMixin(Vue)
eventsMixin(Vue)
lifecycleMixin(Vue)
renderMixin(Vue)

export default Vue
