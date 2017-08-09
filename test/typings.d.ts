/// <reference types="mocha" />
/// <reference types="chai" />

declare var expect: Chai.ExpectStatic

declare module NodeJS {
  interface Global {
    expect?: Chai.ExpectStatic
  }
}

type Config = { [key: string]: any }

interface Configs extends envLoader.Config {
  defaults: Config
  test: Config
  development: Config
  production: Config
}
