// 本节我们针对object属性的 删除 新增 for...in遍历及in操作符 实现响应式

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

// for...in 遍历时无法获取代理对象的key值 我们这里利用symbol的唯一性 作为它的key
const ITERATE_KEY = Symbol();
// 封装解耦
// 新增两个参数 isDeep 是否是深响应 默认为true isReadOnly 是否为只读数据 默认false
function reactive(obj, isDeep = true, isReadOnly = false) {
  return new Proxy(obj, {
    // 判断对象上有无key
    has(target, key) {
      track(target, key);
      return Reflect.has(target, key);
    },
    // obj 的for...in 遍历实际上调用的是ownKeys 方法 因此我们可以拦截此方法来对for...in做依赖收集
    ownKeys(target) {
      track(target, ITERATE_KEY);
      return Reflect.ownKeys(target);
    },
    get(target, key, receiver) {
      // 只读数据不需要做依赖收集
      if (isReadOnly) {
        return;
      }
      // 添加raw属性 以便于我们通过代理对象的raw属性 访问原始对象target
      if (key === "raw") {
        return target;
      }
      const res = Reflect.get(target, key, receiver);
      // 如果是浅响应 直接返回结果
      if (!isDeep) {
        return res;
      }
      track(target, key);
      // 如果是深响应 当前key的属性值为引用类型且不为null 递归创建属性值得响应式
      if (typeof res === "object" && res !== null) {
        return reactive(res);
      }
      return res;
    },
    set(target, key, newValue, receiver) {
      // 只读数据不允许修改
      if (isReadOnly) {
        console.warn(`属性${key}只读`);
        return;
      }
      // 判断当前的操作类型 如果原对象上有当前key为赋值 没有则是新增
      // 赋值对对象长度没有影响 不应该触发 for...in 相关的副作用函数
      const type = Object.prototype.hasOwnProperty.call(target, key)
        ? "SET"
        : "ADD";
      const oldValue = target[key];
      const res = Reflect.set(target, key, newValue, receiver);
      // 新值旧值不相等 且不为NAN　时才调用副作用函数
      // target === receiver.raw 只有修改原始对象数据是才调用副作用函数  修改继承的属性以及原型的属性不触发
      if (target === receiver.raw) {
        if (
          oldValue !== newValue &&
          (oldValue === oldValue || newValue === newValue)
        ) {
          trigger(target, key, type);
        }
      }
      return res;
    },
    deleteProperty(target, key) {
      // 只读数据不允许删除
      if (isReadOnly) {
        console.warn(`属性${key}只读`);
        return;
      }
      const hasKey = Object.prototype.hasOwnProperty.call(target, key);
      const res = Reflect.deleteProperty(target, key);
      // 如果原对象上存在key 并且删除成功时 调用副作用函数
      if (hasKey && res) {
        trigger(target, key, "DELETE");
      }
    },
  });
}

// 这里我们称为依赖收集函数
function track(target, key) {
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
  activeEffect && activeEffect.deps && activeEffect.deps.push(deps);
}

// 调度当前key关联的副作用函数
function trigger(target, key, type) {
  // 从副作用函数存储桶里取出当前key关联的副作用函数集合
  let deps = bucket.get(target);
  if (!deps) {
    return;
  }
  // 与key相关联的副作用集合
  const effects = deps.get(key);
  // for...in遍历相关联的副作用函数集合
  const iterateEffects = deps.get(ITERATE_KEY);
  // 待执行的副作用函数集合
  let effectsToRun = new Set();
  effects &&
    effects.forEach((effectFn) => {
      effectsToRun.add(effectFn);
    });
  //新增属性 删除属性 触发 for...in 相关的副作用函数
  if (type === "ADD" || type === "DELETE") {
    iterateEffects &&
      iterateEffects.forEach((effectFn) => {
        effectsToRun.add(effectFn);
      });
  }

  effectsToRun.forEach((effectFn) => {
    effectFn();
  });
}

// 每次执行副作用函数时 在集合中清除当前副作用函数
function effect(fn) {
  const effectFn = () => {
    cleanUp(effectFn);
    activeEffect = effectFn;
    fn && fn();
  };
  effectFn.deps = [];
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
/**
 * 
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
 */
// @note 本节我们主要对对象的 in操作符 for...in遍历 以及delete 做了响应式  的处理
// @tag 思考一下 如果一个对象的属性的值 是一个引用类型的话
//      由于我们只对当前对象的第一层做了依赖收集 当修改第二层数据时无法调用到副作用函数 我们就需要给第二层的引用数据类型也加上响应式 直接递归 reactive函数
// @tag 除了深浅响应的问题 我们还需要处理一些只读数据的问题 只读数据不允许修改和删除 因此我们不需要做依赖收集 也不需要调用副作用函数 直接拦截掉相关操作就可以了
