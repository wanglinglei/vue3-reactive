// 我们根据上一节代码做进一步的优化

// 副作用函数存储桶
let bucket = new WeakMap();
// bucket WeakMap
//        - obj1 ---- Map
//               -key1  ----Set
//               -key2  ----Set
//        - obj2 ---- Map
//               -key1  ----Set
//               -key2  ----Set
// 当前激活的副作用函数
let activeEffect;

// 封装解耦

function reactive(obj) {
  return new Proxy(obj, {
    get(target, key, receiver) {
      track(target, key);
      return Reflect.get(target, key, receiver);
    },
    set(target, key, newValue, receiver) {
      const oldValue = target[key];
      const res = Reflect.set(target, key, newValue, receiver);
      // 新值旧值不相等 且不为NAN　时才调用副作用函数
      if (
        oldValue !== newValue &&
        (oldValue !== oldValue || newValue !== newValue)
      ) {
        trigger(target, key);
      }
    },
  });
}

// 这里我们称为依赖收集函数
function track(target, key) {
  // 没有激活的副作用函数
  if (!activeEffect) {
    return;
  }
  // 从桶里取出target对应的Map;没有就创建
  let deps = bucket.get(target);
  if (!deps) {
    bucket.set(target, (deps = new Map()));
  }
  // 从Map里取出当前key对应的副作用函数Set 没有就创建当前key关联的副作用函数集合
  let effects = deps.get(key);
  if (!effects) {
    deps.set(key, (effects = new Set()));
  }
  effects.add(activeEffect);
  // 将与当前副作用函存在关联的的依赖集合 添加到activeEffect.deps 数组中 以便于清除遗留的副作用函数
  activeEffect.deps.push(deps);
}

// 调度当前key关联的副作用函数
function trigger(target, key) {
  // 从副作用函数存储桶里取出当前key关联的副作用函数集合
  let deps = bucket.get(target);
  if (!deps) {
    return;
  }
  const effects = deps.get(key);
  // 待执行的副作用函数集合
  let effectsToRun = new Set();
  effects &&
    effects.forEach((effectFn) => {
      effectsToRun.add(effectFn);
    });
  effectsToRun.forEach((effectFn) => {
    effectFn();
  });
}

// 每次执行副作用函数时 在集合中清除当前副作用函数
function effect(fn) {
  const effectFn = (fn) => {
    cleanUp(effectFn);
    activeEffect = effectFn;
    fn();
  };
  effectFn.deps();
  effectFn();
}

function cleanUp(effectFn) {
  // 遍历 effectFn.deps 数组 清除所有副作用函数
  for (let index = 0; index < effectFn.deps.length; index++) {
    const deps = effectFn.deps[index];
    deps.delete(effectFn);
  }
  effectFn.deps.length = 0;
}

// @tag 思考一下下面场景
// 在初次调用getAge函数时 访问了obj的name及age 属性 因此name 和age 都会绑定绑定getAge 副作用函数
// 当我们把name置为空时 我们不会再访问age 属性 这时我们再修改它的值 理论上不应该调用副作用函数 但实际上hi再次调用
// @todo 每次执行副作用函数时 对其关联的key从依赖集合中删除  清除遗留副作用函数
const obj = reactive({
  name: "wang",
  age: "18",
});

function effect(fn) {
  fn();
}

function getAge() {
  const age = obj.name ? obj.age : "default";
}
effect(getAge);
obj.name = "";
obj.age = "19";

// @note 本节我们建立了一种新的数据结构WeakMap来作为副作用函数存储桶
// 对依赖收集函数 及副作用调度函数做了封装解耦 并解决了分支切换的问题
