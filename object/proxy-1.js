// 回到readme文件最初的例子
/**
const obj = { text: "text" };
function effect() {
  document.body.innerHTML = obj.text;
}
effect();
obj.text='content'
 */

// 我们怎么让obj.text属性变化时自动执行effect函数？
// 我们是不是可以利用Proxy，当effect访问obj.text 属性时把effect函数找一个容器存起来，当obj.text变化时再从容器中取出effect函数调用

// 定义一个存储容器
let bucket = new Set();
let obj = {
  name: "张三",
  age: "18",
};
const proxy_1 = new Proxy(obj, {
  get(target, key, receiver) {
    bucket.add(effect);
    return Reflect.get(target, key, receiver);
  },
  set(target, key, newValue, receiver) {
    const res = Reflect.set(target, key, newValue, receiver);
    bucket.forEach((effectFn) => {
      effectFn();
    });
    return res;
  },
});
function effect() {
  console.log("effect", proxy_1.name);
}
effect();
proxy_1.name = "李四";

// effect 张三
// effect 李四
// 看出effect 函数被再次调用 到这里我们基本上就实现了一个最基本的响应式数据了
// 但是还有很多不足 很明显 我们只是对单一对象的数据的单一key实现了 数据的响应式
// 如果有多个数据呢 每个数据又有多个key呢？
// 我们就需要建立一种新的数据结构 以满足多个数据 多个key的场景
// 一对多 我们很容易就联想到键值对
// 这里我们选用WeakMap来做的最外层容器
// 之所以选用WeakMap是因为其键值之间是一种弱引用的关系 当引用发生变化或移除时会自动触发垃圾回收机制 减少内存占用
