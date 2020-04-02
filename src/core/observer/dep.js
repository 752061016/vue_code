/* @flow */

import type Watcher from './watcher'
import { remove } from '../util/index'
import config from '../config'

let uid = 0

/**
 * A dep is an observable that can have multiple
 * directives subscribing to it.
 */
export default class Dep {
  // 该属性不会被实例继承， 而是直接通过类来调用  相当于定义在构造函数上的属性或方法
  static target: ?Watcher;
  id: number;
  subs: Array<Watcher>;

  constructor () {
    this.id = uid++
    this.subs = []
  }

  addSub (sub: Watcher) {
    this.subs.push(sub)
  }

  removeSub (sub: Watcher) {
    remove(this.subs, sub)
  }

  depend () {
    if (Dep.target) {
      Dep.target.addDep(this)
    }
  }

  notify () {
    // stabilize the subscriber list first
    // 当数据状态方式改变时，会通过如上 notify 函数通知变化，从而执行所有观察者的 update 方法
    // 遍历subs，依次触发updata()
    const subs = this.subs.slice()
    // 同步计算属性 && 非生产环境
    if (process.env.NODE_ENV !== 'production' && !config.async) {
      // subs aren't sorted in scheduler if not running async
      // we need to sort them now to make sure they fire in correct
      // order
      // 不会等待所有观察者入队之后再去执行，这就没有办法保证观察者回调的正确更新顺序
      subs.sort((a, b) => a.id - b.id)
    }
    for (let i = 0, l = subs.length; i < l; i++) {
      subs[i].update()
    }
  }
}

// The current target watcher being evaluated.
// This is globally unique because only one watcher
// can be evaluated at a time.
Dep.target = null
const targetStack = []

// pushTarget 函数的作用就是用来为 Dep.target 属性赋值的
// pushTarget 函数会将接收到的参数赋值给 Dep.target 属性
// Dep.target 保存着一个观察者对象
export function pushTarget (target: ?Watcher) {
  targetStack.push(target)
  Dep.target = target
}

export function popTarget () {
  targetStack.pop()
  Dep.target = targetStack[targetStack.length - 1]
}
