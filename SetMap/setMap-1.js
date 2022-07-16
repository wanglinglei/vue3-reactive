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

// 重写数组的操作方法
const arrayMethods = {};
let shouldTrack = true;
// 取值操作先取代理对象 再取原始对象
["includes", "indexOf", "lastIndexOf"].forEach((method) => {
  // 从原型中取出对应操作方法
  const originalMethod = Array.prototype[method];
  arrayMethods[method] = function (...args) {
    // 先从代理对象找 如果元素不是引用类型 这一层可以直击返回true
    let res = originalMethod.apply(this, args);
    if (res === false) {
      // 再从原始对象找
      res = originalMethod.apply(this.raw, args);
    }
    return res;
  };
});
// 这些方法会改变数组的length属性 需要禁止依赖收集 否则会触发到length相关的副作用函数 形成死循环
["pop", "push", "shift", "unshift", "splice"].forEach((method) => {
  const originalMethod = Array.prototype[method];
  arrayMethods[method] = function (...args) {
    shouldTrack = false;
    let res = originalMethod.apply(this, args);
    shouldTrack = true;
    return res;
  };
});

// 重写Set/Map的对应
function iteratorMethod() {
  // 获取原始迭代器方法
  const target = this.raw;
  const itr = target[Symbol.iterator]();
  const wrap = (val) => {
    typeof val === "object" ? reactive(val) : val;
  };
  track(target, ITERATE_KEY);
  // 返回自定义的迭代器
  return {
    next() {
      const { value, done } = itr.next();
      // 如果value不为undefined 需要转化
      return {
        value: value ? [wrap(value[0]), wrap(value[1])] : value,
        done,
      };
    },
    [Symbol.iterator]() {
      return this;
    },
  };
}
// values 方法
function valuesMethod() {
  // 获取原始迭代器方法
  const target = this.raw;
  const itr = target.values();
  const wrap = (val) => {
    typeof val === "object" ? reactive(val) : val;
  };
  track(target, ITERATE_KEY);
  // 返回自定义的迭代器
  return {
    next() {
      const { value, done } = itr.next();
      // 如果value不为undefined 需要转化
      return {
        value: wrap(value),
        done,
      };
    },
    [Symbol.iterator]() {
      return this;
    },
  };
}
// keys 方法 只关心Map类型数据key的变化，不关心value的变化 不需要触发到key相关的副作用函数 需要与ITERATE_KEY 隔离
const MAP_ITERATE_KEY = Symbol();
function keysMethod() {
  // 获取原始迭代器方法
  const target = this.raw;
  const itr = target.keys();
  const wrap = (val) => {
    typeof val === "object" ? reactive(val) : val;
  };
  track(target, MAP_ITERATE_KEY);
  // 返回自定义的迭代器
  return {
    next() {
      const { value, done } = itr.next();
      // 如果value不为undefined 需要转化
      return {
        value: wrap(value),
        done,
      };
    },
    [Symbol.iterator]() {
      return this;
    },
  };
}
const setMapMethods = {
  add(key) {
    const target = this.raw;
    const hasKey = target.has(key);
    const res = target.add(eky);
    if (!hasKey) {
      trigger(target, key, "ADD");
    }
    return res;
  },
  delete(key) {
    const target = this.raw;
    const hasKey = target.has(key);
    const res = target.delete(key);
    if (hasKey) {
      trigger(target, key, "DELETE");
    }
    return res;
  },
  set(key, value) {
    const target = this.raw;
    const hasKey = target[key];
    const oldValue = target[key];
    // 这里需要取原始数据 如果value是响应式数据 把响应式数据赋值给原始数据会在成原始数据被污染
    const rawValue = value.raw || value;
    // 存在是重新赋值  不存在是新增
    if (!hasKey) {
      trigger(target, key, "ADD");
    } else if (
      oldValue !== value ||
      (oldValue === oldValue && value === value)
    ) {
      trigger(target, key, "SET");
    }
  },
  forEach(cb, thisArg) {
    const target = this.raw;
    const wrap = (val) => {
      typeof val === "object" ? reactive(val) : val;
    };
    track(target, ITERATE_KEY);
    target.forEach((v, k) => {
      cb.call(thisArg, wrap(v), wrap(k), this);
    });
  },
  [Symbol.iterator]: iteratorMethod,
  entries: iteratorMethod,
  values: valuesMethod,
  keys: keysMethod,
};

// 新增两个参数 isDeep 是否是深响应 默认为true isReadOnly 是否为只读数据 默认false
function reactive(obj, isDeep = true, isReadOnly = false) {
  return new Proxy(obj, {
    // 判断对象上有无key
    has(target, key) {
      track(target, key);
      return Reflect.has(target, key);
    },
    // object 的for...in 遍历实际上调用的是ownKeys 方法 因此我们可以拦截此方法来对for...in做依赖收集
    // array  的for...in 实际上调用的也是ownKeys 对于数组我们需要与数组的length做关联
    ownKeys(target) {
      track(target, Array.isArray(target) ? "length" : ITERATE_KEY);
      return Reflect.ownKeys(target);
    },
    get(target, key, receiver) {
      // 添加raw属性 以便于我们通过代理对象的raw属性 访问原始对象target
      if (key === "raw") {
        return target;
      }
      // Set/Map size 是Set/Map结构的属性 在我们的代理对象上没有此属性 当我们能访问到该属性时需要访问原始对象
      if (key === "size") {
        //@??? 为什么不用size 做key？
        track(target, ITERATE_KEY);
        return Reflect.get(target, key, target);
      }
      // 如果是数组 并且调用的方法存在与arrayMethods中 从中取出调用
      if (Array.isArray(target) && arrayMethods.hasOwnProperty(key)) {
        return Reflect.get(arrayMethods, key, receiver);
      }
      // 非只读数据做依赖收集
      // 数组的for...of 及values 方法隐式调用Symbol.iterator 只需要同for...of values做关联 不需要与Symbol.iterator做关联
      if (!isReadOnly && typeof key !== "symbol") {
        track(target, key);
      }
      const res = Reflect.get(target, key, receiver);
      // 如果是浅响应 直接返回结果
      if (!isDeep) {
        return res;
      }
      // 如果是深响应 当前key的属性值为引用类型且不为null 递归创建属性值得响应式
      if (typeof res === "object" && res !== null) {
        return reactive(res);
      }
      return target[key].bind(target);
    },
    set(target, key, newValue, receiver) {
      // 只读数据不允许修改
      if (isReadOnly) {
        console.warn(`属性${key}只读`);
        return;
      }
      // 判断当前的操作类型 如果原对象上有当前key为赋值 没有则是新增
      // 赋值对对象长度没有影响 不应该触发 for...in 相关的副作用函数
      // 新增对数组的判断  通过数组下标设置数组的值时 如果当前下标大于当前数组的length 则为新增元素 否则为修改元素值
      let type = "";
      if (Array.isArray(target)) {
        type = Number(key) >= target.length ? "ADD" : "SET";
      } else {
        type = Object.prototype.hasOwnProperty.call(target, key)
          ? "SET"
          : "ADD";
      }

      const oldValue = target[key];
      const res = Reflect.set(target, key, newValue, receiver);
      // 新值旧值不相等 且不为NAN　时才调用副作用函数
      // target === receiver.raw 只有修改原始对象数据是才调用副作用函数  修改继承的属性以及原型的属性不触发
      if (target === receiver.raw) {
        if (
          oldValue !== newValue &&
          (oldValue === oldValue || newValue === newValue)
        ) {
          trigger(target, key, type, newValue);
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
        trigger(target, key, "DELETE", undefined);
      }
      return res;
    },
  });
}

// 这里我们称为依赖收集函数
function track(target, key) {
  // 没有激活的副作用函数 或者不需要依赖收集
  if (!activeEffect || !shouldTrack) {
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
  activeEffect && activeEffect.deps && activeEffect.deps.push(effects);
}

// 调度当前key关联的副作用函数
function trigger(target, key, type, newValue) {
  // 从副作用函数存储桶里取出当前key关联的副作用函数集合
  let deps = bucket.get(target);
  if (!deps) {
    return;
  }
  // 与key相关联的副作用集合
  const effects = deps.get(key);

  // 待执行的副作用函数集合
  let effectsToRun = new Set();
  effects &&
    effects.forEach((effectFn) => {
      effectsToRun.add(effectFn);
    });
  //新增属性 删除属性 触发 for...in 相关的副作用函数
  //forEach 既可以访问键也可以访问值 如果是Map类型 Set操作也需要触发相关的副作用函数
  if (
    type === "ADD" ||
    type === "DELETE" ||
    (type === "SET" &&
      Object.prototype.toString.call(target) === "[object Map]")
  ) {
    // for...in遍历相关联的副作用函数集合
    const iterateEffects = deps.get(ITERATE_KEY);
    iterateEffects &&
      iterateEffects.forEach((effectFn) => {
        effectsToRun.add(effectFn);
      });
  }
  //如果是Map 当新增和删除元素时 取出keys相关的副作用函数执行
  if (
    (type === "ADD" || type === "DELETE") &&
    Object.prototype.toString.call(target) === "[object Map]"
  ) {
    const keysEffects = deps.get(MAP_ITERATE_KEY);
    keysEffects &&
      keysEffects.forEach((effectFn) => {
        effectsToRun.add(effectFn);
      });
  }
  // 如果是数组 并且是新增元素 需要调用和length相关的副作用函数
  if ((type === "ADD" || type === "DELETE") && Array.isArray(target)) {
    const lengthEffects = deps.get("length");
    lengthEffects &&
      lengthEffects.forEach((effectFn) => {
        effectsToRun.add(effectFn);
      });
  }
  // 如果是数组 并且修改了数组的length属性
  // 对于索引大于或等于新的length时需要把所有相关的副作用函数取出执行
  //  eg: arr=[1,2,3,4]; arr.length=2;=> arr=[1,2] 这时 属性3,4 被删除 需要执行他们相关联的副作用函数
  if (Array.isArray(target) && key === "length") {
    deps.forEach((effects, key) => {
      if (key >= newValue) {
        effects.forEach((effectFn) => {
          effectsToRun.add(effectFn);
        });
      }
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
