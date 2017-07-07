# EnvLoader

[b2wads]: http://www.b2wadvertising.com/
[iso8601]: https://en.wikipedia.org/wiki/ISO_8601
[license]: https://opensource.org/licenses/BSD-3-Clause

This is a helper to make easier loading enviroment-oriented settings.

## Genesis

This code has been born inside [B2WAds][b2wads] code
base, and make sense to release it as [open source](./COPYING).

## Use

Simply import the module and call it as a function:

```javascript
const envLoader = require("envLoader")
const settings = envLoader(require("config/my-app"))
```

The configuration object must have a `defaults` key at least, and should have a
key for each environment you intent to work with.

### Environments as primitive values

Let’s take the follow JSON settings file:

```json
{
  "defaults": "some default value",
  "test": "test environment",
  "production": "env:MY_VAR"
}
```

EnvLoader will select the environment according to the `NODE_ENV` envvar
content, defaults to `development`.

- If `NODE_ENV` is `test`, EnvLoader returns `"test environment"`;
- If `NODE_ENV` is `production`, EnvLoader returns the content of the `MY_VAR`
  envvar;
- If `NODE_ENV` is something else, EnvLoader returns `"some default value"`.

You also can supply the environment you want as second parameter:

```javascript
envLoader(require("./config"), "sandbox")
```

### Environments as object

The object environment advantage is that the `defaults` value fullfills the
undefined keys.

For example:

```json
{
  "defaults": {
    "x": 3,
    "y": 4
  },
  "development": {
    "z": 5
  }
}
```

Under development environment, EnvLoader returns the following object:

```javascript
{ x: 3, y: 4, z: 5 }
```

### Nested keys

You can use nested keys. For example, the sample above can be written as:

```json
{
  "defaults": {
    "x": 3,
    "y": 4
  },
  "development.z": 5
}
```

With the same result.

Nested keys can be multilevel:

```json
{
  "defaults": {},
  "development": {
    "foo.bar.a": true,
    "foo.bar.b": false,
    "foo.baaz": null
  }
}
```

Leading to:

```javascript
{
  foo: {
    bar: { a: true, b: false },
    baaz: null,
  },
}
```

And can be compound with unnested one:

```json
{
  "defaults": {},
  "development": {
    "foo": { "baaz": null },
    "foo.bar": { "a": true },
    "foo.bar.b": false
  }
}
```

### Data from envvar

Using the `env:` prefix, EnvLoader loads the content from an envvar.

To load objects from envvar, use querystring format:

```json
{
  "defaults": {},
  "production": "env:SETTINGS"
}
```

```sh
env SETTINGS="x=3&y=4&foo[]=bar&foo[]=baaz"
```

Nested objects can be got like:

```sh
env SETTINGS="v[x]=3&v[y]=4"
```

### Other types

If you must load settings from JSON or envvar, EnvLoader supports more types
than those formats, serialised as string.

- Date: use [ISO 8601][iso8601]: `2010-10-10` for October 10, 2010.
- Time: use [ISO 8601][iso8601]: `2010-10-10T12:30:00Z` for October 10, 2010,
  12:30 UTC.
- Duration: use [ISO 8601][iso8601]: `P3Y6M4DT12H30M5S` for 3 year, 6 months,
  four days, 12 hours, 30 minutes, and 5 seconds.
- Regular expressions: write the regex inside a string. For example:
  `"/\\w(cde)?/i"` means `/\w(cde)?/i`.

Extras only in querystring:

- `null` string resolves to `null`
- `true` string resolves to `true`
- `false` string resolves to `false`

To force string, you must prefix the value with `raw:`:

- `raw:null` resolves to `"null"`
- `raw:2010-10-10` resolves to `"2010-10-10"`
- `raw:PT12H` resolves to `"PT12H"`
- `raw:env:HOME` resolves to `"env:HOME"`
- `raw:raw:` resolves to `"raw:"`

## License

This code is licensed under [the 3-Clause BSD License][license].
