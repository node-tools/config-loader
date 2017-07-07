declare namespace envLoader {
  interface Config {
    defaults: any
    [other: string]: any
  }
}

declare function envLoader(config: envLoader.Config, nodeEnv?: string): any

export = envLoader
export as namespace envLoader
