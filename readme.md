# Vue3 响应式
## 什么是响应式
通俗的来说，就是数据变化的同时，依赖这些数据的视图同时更新，这就叫响应式，这种数据我们称为响应式数据。
```
let obj={text:'text'};
effect(){
  document.body.innerHtml=obj.text;
}
effect()
obj.text='content';
```
以上面的代码为例，当执行effect函数时，页面body的内容为text。当我们对obj.text重新赋值时，如果我们希望让body的内容变为content，很简单我们只需要再次执行effect函数就可以了。那我们有没有办法使的当text属性变化时自动执行effect函数呢？如果能实现这一功能，那我们就简单实现了数据的响应式。
## Vue3 与 Vue2 在实现数据响应式上的差异
Vue2 是通过Object.defineProperty 来拦截外部对数据属性的操作，具有很大的局限性。
*  对象数据类型
    * 删除对象数据时无法拦截
    * 新增对象数据时无法拦截
* 数组数据类型
    * 直接通过length创建数组时无法拦截
    * 通过length改变数组长度无法拦截
    * 数组的操作无法拦截，vue2中实际时通过拦截数组原型链上的方法对数组变化实现拦截

Vue3 是通过Proxy实现，Proxy顾名思义，代理就意味着我们所有对数据的访问及操作都必须经过这层代理，才能实现。如果把数据比作一个房子，Proxy是在门外做了一系列拦截，通过了才能进入房间内；而defineProperty是在门内做了特定的拦截，这些拦截之外的操作实际上是监控不到的。哪种拦截方式更好就不言而喻了。

## Vue3响应式实现方案简述
[ ECMAScript 6 入门教程 ](https://es6.ruanyifeng.com/)
阅读源码前，建议先阅读ECMAScript 6 入门教程
*  Proxy
*  Reflect
*  Set和Map 数据结构
*  Iterator 和 for...of 循环
上述章节，需要对Proxy Reflect Set Map WeakMap Iterator 等知识有一定的认识。

对于常见的数据类型，我们需要做的拦截操作主要有
* **object**
    * *in 操作符*  判断当前对象上是否有某个属性
    * *for...in*   遍历一个对象数据的key
    * *取值、赋值*
    * *delete*   删除对象的一个键值对
* **Array**
    *  *length*
    *  *includes indexOf lastIndexOf*
    *  *push pop shift unshift splice*
    *  *通过下标取值*
    *  *for...in*
    *  *for...of*
    *  *forEach*
* **Set/Map**
    *   *size*
    *   *add(Set)/set(Map)*
    *   *clear*
    *   *delete*
    *   *has*
    *   *get(Map)*
    *   *keys/values/entries*
    *   *forEach*
* **Number/String/Boolean**
    基本数据类型我们通过转成object实现响应式