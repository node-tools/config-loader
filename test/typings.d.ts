/// <reference types="mocha" />
/// <reference types="chai" />

declare var expect: Chai.ExpectStatic

declare module NodeJS {
  interface Global {
    expect?: Chai.ExpectStatic
  }
}
