export function autoBind<T extends { new (...args: any[]): {} }>(constructor: T) {
  return class extends constructor {
    constructor(...args: any[]) {
      super(...args);
      const prototype = Object.getPrototypeOf(this);
      const propertyNames = Object.getOwnPropertyNames(prototype);
      
      propertyNames.forEach(name => {
        if (name !== 'constructor' && typeof (this as any)[name] === 'function') {
          const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
          if (descriptor && !descriptor.get) {
            (this as any)[name] = (this as any)[name].bind(this);
          }
        }
      });
    }
  };
}