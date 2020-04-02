/* @flow */

import { hasOwn } from 'shared/util'
import { warn, hasSymbol } from '../util/index'
import { defineReactive, toggleObserving } from '../observer/index'

export function initProvide (vm: Component) {
  const provide = vm.$options.provide
  // provide 选项可以是对象，也可以是一个返回对象的函数
  if (provide) {
    // vm._provided是个对象
    vm._provided = typeof provide === 'function'
      ? provide.call(vm)
      : provide
  }
}

export function initInjections (vm: Component) {
  // result 就是当前子组件所取得的所有的数据
  const result = resolveInject(vm.$options.inject, vm)
  if (result) {
    // 关闭响应式定义的开关
    toggleObserving(false)
    Object.keys(result).forEach(key => {
      /* istanbul ignore else */
      if (process.env.NODE_ENV !== 'production') {
        defineReactive(vm, key, result[key], () => {
          warn(
            `Avoid mutating an injected value directly since the changes will be ` +
            `overwritten whenever the provided component re-renders. ` +
            `injection being mutated: "${key}"`,
            vm
          )
        })
      } else {
        // 调用 defineReactive 函数在当前组件实例对象 vm 上定义与注入名称相同的变量，并赋予取得的值
        defineReactive(vm, key, result[key])
      }
    })
    toggleObserving(true)
  }
}

// 作用就是根据当前组件的 inject 选项去父代组件中寻找注入的数据，并将最终的数据返回
export function resolveInject (inject: any, vm: Component): ?Object {
  // 当前实例存在inject对象
  if (inject) {
    // inject is :any because flow is not smart enough to figure out cached
    // 最终寻找到的注入的数据 inject已在初始化的时候转换成全是对象的类型
    // ['data1', 'data2'] ==>
    // {
    //   'data1': { from: 'data1' },
    //   'data2': { from: 'data2' }
    // }
    // 或
    // {
    //   // 第一种写法
    //   data1: 'd1',
    //   // 第二种写法
    //   data2: {
    //     someProperty: 'someValue'
    //   }
    // }==>
    // {
    //   'data1': { from: 'd1' },
    //   'data2': { from: 'data2', someProperty: 'someValue' }
    // }
    const result = Object.create(null)
    // hasSymbol 为真，则说明可用Reflect.ownKeys 获取 inject 对象中所有可枚举的键名
    const keys = hasSymbol
      ? Reflect.ownKeys(inject)
      : Object.keys(inject)

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      // #6574 in case the inject object is observed...
      if (key === '__ob__') continue
      const provideKey = inject[key].from
      let source = vm
      while (source) {
        // 当前实例是否有_provided对象属性且_provided是否有provideKey的键值
        if (source._provided && hasOwn(source._provided, provideKey)) {
          result[key] = source._provided[provideKey]
          break
        }
        // 若未找到则往父组件查找
        source = source.$parent
      }
      //此时执行说明已到达根组件  且还未找到需要的值
      if (!source) {
        if ('default' in inject[key]) {
          // 若子组件有设置default默认值  则将默认值赋值给result对象  若无则报错
          const provideDefault = inject[key].default
          // 默认值可以是个类型值也能是个函数  函数的返回值为默认值
          result[key] = typeof provideDefault === 'function'
            ? provideDefault.call(vm)
            : provideDefault
        } else if (process.env.NODE_ENV !== 'production') {
          warn(`Injection "${key}" not found`, vm)
        }
      }
    }
    return result
  }
}
