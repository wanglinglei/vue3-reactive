// 简单的了解一下Proxy 我们能用来做什么
let obj = {
  name: "zhangsan",
  age: "18",
};

const proxy = new Proxy(obj, {
  get(target, key) {
    console.log("proxy-get", target, key);
    return target[key];
  },
  set(target, key, newValue) {
    console.log("proxy-set", target, key, newValue);
    target[key] = newValue;
  },
});
console.log(proxy.name);
// proxy-get { name: 'zhangsan', age: '18' } name
// zhangsan
// 我们可以看出当我们访问代理对象数据时 我们会先进入get 方法
proxy.age = "19";
// proxy-set { name: 'zhangsan', age: '18' } age 19
// 当我们设置代理对象属性时 会先经过set方法
