declare namespace envLoader {
  interface Config {
    defaults: any
    [other: string]: any
  }
}

declare function envLoader(
  config: envLoader.Config | string, nodeEnv?: string
): any

export = envLoader
export as namespace envLoader
