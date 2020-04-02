/* @flow */

import { noop, extend } from 'shared/util'
// 其中 baseWarn 是来自于 core/util/debug.js 文件中 warn 的别名
import { warn as baseWarn, tip } from 'core/util/debug'
import { generateCodeFrame } from './codeframe'

type CompiledFunctionResult = {
  render: Function;
  staticRenderFns: Array<Function>;
};

function createFunction (code, errors) {
  try {
    return new Function(code)
  } catch (err) {
    errors.push({ err, code })
    return noop
  }
}

export function createCompileToFunctionFn (compile: Function): Function {
  const cache = Object.create(null)
  // 创建了一个闭包

  return function compileToFunctions (
    template: string,
    options?: CompilerOptions,
    vm?: Component
  ): CompiledFunctionResult {
    // 使用 extend 函数将 options 的属性混合到新的对象中并重新赋值 options
    options = extend({}, options)
    // 检查选项参数中是否包含 warn，如果没有则使用 baseWarn
    const warn = options.warn || baseWarn
    // 将 options.warn 属性删除
    delete options.warn

    /* istanbul ignore if */
    // 检测 new Function() 是否可用
    if (process.env.NODE_ENV !== 'production') {
      // detect possible CSP restriction
      try {
        new Function('return 1')
      } catch (e) {
        if (e.toString().match(/unsafe-eval|CSP/)) {
          warn(
            'It seems you are using the standalone build of Vue.js in an ' +
            'environment with Content Security Policy that prohibits unsafe-eval. ' +
            'The template compiler cannot work in this environment. Consider ' +
            'relaxing the policy to allow unsafe-eval or pre-compiling your ' +
            'templates into render functions.'
          )
        }
      }
    }

    // check cache
    // options.delimiters 是一个数组
    // 如果存在，则使用 String 方法将其转换成字符串并与 template 拼接作为 key 的值，否则直接使用 template 字符串作为 key 的值
    const key = options.delimiters
      ? String(options.delimiters) + template
      : template
    // 缓存字符串模板的编译结果，防止重复编译  最后一行会缓存
    if (cache[key]) {
      return cache[key]
    }

    // compile  src/compiler/create-compiler.js
    // 通过闭包引用了来自 createCompileToFunctionFn 函数的形参，所以这里的 compile 就是调用 createCompileToFunctionFn 函数时传递过来的函数
    const compiled = compile(template, options)
    // 返回结果 compiled 是一个对象且这个对象可能包含两个属性 errors 和 tips。通过这两个属性的名字可知，这两个属性分别包含了编译过程中的错误和提示信息

    // check compilation errors/tips  打印错误和提示信息
    if (process.env.NODE_ENV !== 'production') {
      if (compiled.errors && compiled.errors.length) {
        if (options.outputSourceRange) {
          compiled.errors.forEach(e => {
            warn(
              `Error compiling template:\n\n${e.msg}\n\n` +
              generateCodeFrame(template, e.start, e.end),
              vm
            )
          })
        } else {
          warn(
            `Error compiling template:\n\n${template}\n\n` +
            compiled.errors.map(e => `- ${e}`).join('\n') + '\n',
            vm
          )
        }
      }
      if (compiled.tips && compiled.tips.length) {
        if (options.outputSourceRange) {
          compiled.tips.forEach(e => tip(e.msg, vm))
        } else {
          compiled.tips.forEach(msg => tip(msg, vm))
        }
      }
    }

    // turn code into functions
    // 创建一个空对象且它就是最终的返回值
    const res = {}
    // 创建函数发生错误时用来收集错误的
    const fnGenErrors = []
    // 在 res 对象上添加一个 render 属性，实际上就是最终生成的渲染函数，它的值是通过 createFunction 创建出来的
    res.render = createFunction(compiled.render, fnGenErrors)
    // 字符串数组 staticRenderFns，这个字符串数组最终也通过 createFunction 转为函数
    res.staticRenderFns = compiled.staticRenderFns.map(code => {
      return createFunction(code, fnGenErrors)
    })

    // check function generation errors.主要是用于开发 codegen 功能时使用，一般是编译器本身的错误
    // this should only happen if there is a bug in the compiler itself.
    // mostly for codegen development use
    /* istanbul ignore if */
    // 这段代码主要的作用是用来打印在生成渲染函数过程中的错误，也就是上面定义的常量 fnGenErrors 中所收集的错误
    if (process.env.NODE_ENV !== 'production') {
      if ((!compiled.errors || !compiled.errors.length) && fnGenErrors.length) {
        warn(
          `Failed to generate render function:\n\n` +
          fnGenErrors.map(({ err, code }) => `${err.toString()} in\n\n${code}\n`).join('\n'),
          vm
        )
      }
    }

    return (cache[key] = res)
  }
}
