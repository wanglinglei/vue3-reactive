// 前面几节我们实现了object array  Set/Map 的响应式 那我们怎么实现基本数据类型的响应式呢
// 创建Proxy对象的参数必须是非基本类型，所以我们不能直接对基本类型数据做拦截
// 为了解决这个问题 我们可以创建一个对象去包裹这个基本类型数据

function ref(val) {
  const wrap = {
    value: val,
  };
  // 通过这个变量判断数据是基本数据类型响应式 还是引用类型响应数据
  Object.defineProperty(wrap, "isRef", {
    value: true,
  });
  return reactive(wrap);
}

const numberValue = ref(1);
// 这样我们基本实现了基本数据类型的响应式

//@tag 响应丢失问题
const obj = reactive({ foo: "a", bar: "b" });
// const newObj = { ...obj };
// 在这里 obj 是一个Proxy的代理对象 通过展开运算符...生成的newObj是一个普通对象，不具有响应式，当我们修改obj的属性时不会触发到newObj的副作用函数、
// 为了解决这一问题 我们需要建立newObj与obj之间的关联
/**
 * 
newObj={
  foo:{
    get value(){
      return obj.foo
    },
    set value(val){
      obj.foo=val
    }
  },
  bar:{
    get value(){
      return obj.bar
    },
    set value(val){
      obj.bar=val
    }
  },
}
 */
// 上面这种结构 当我们访问展开对象的属性值时 我们将其指向代理对象 这样就会被代理对象依赖收集
function toRef(obj, key) {
  const wrap = {
    get value() {
      return obj[key];
    },
    set value(val) {
      obj[key] = val;
    },
  };
  Object.defineProperty(wrap, "isRef", {
    value: true,
  });
  return wrap;
}

function torefs(obj) {
  const ret = {};
  for (const key in obj) {
    ret[key] = toRef(obj, key);
  }
  return ret;
}

// 我们通过上面两个方法建立了代理对象与展开对象之间的响应式关联
// 但是带来了新的问题 在代理对象中我们如果要访问foo属性 只需要obj.foo即可
// 但在展开对象newObj中 由于包了一层wrap foo值实际上是一个对象 需要通过newObj.foo.value来访问实际的属性值
function proxyRefs(obj) {
  return new Proxy(obj, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver);
      // 判断isRef属性 为true 说明是ref数据 取其value值返回
      return value.isRef ? value.value : value;
    },
    set(target, key, newValue, receiver) {
      const oldValue = target[key];
      if (oldValue.isRef) {
        oldValue.value = newValue;
        return true;
      }
      return Reflect.set(target, key, newValue, receiver);
    },
  });
}

// 当我们创建展开对象是也为其创建一个代理对象 判断isRef属性 如果为true 就操作其对应key的value值
const newObj = proxyRefs({ ...obj });
