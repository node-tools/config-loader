import * as _ from "underscore"
import * as envLoader from "../index"

const homedir = process.env.HOME
const config: Configs = require("./fixtures")


describe("env-loader", () => {

  let env: Config = envLoader(config)

  describe("default environment", () => {
    it("should be test", () => {
      expect(env).to.be.eql(config.test)
    })

    it("should preserve set attributes", () => {
      expect(env.name).to.be.equal("test")
      expect(env.log).to.be.false
      expect(env.foo).to.be.equal("")
      expect(env.x).to.be.equal(23)
      expect(env.y).to.be.equal(42)
      expect(env.z).to.be.undefined
    })

    it("should read from NODE_ENV", () => {
      process.env.NODE_ENV = "production"

      try {
        env = envLoader(config)
        const production = _.clone(config.production)
        const { defaults } = config
        production.x = defaults.x
        production.y = defaults.y
        production.home = homedir
        expect(env).to.be.eql(production)
        expect(env.name).to.be.equal("production")
        expect(env.log).to.be.true
        expect(env.foo).to.be.null
        expect(env.z).to.be.equal(5)

      } finally {
        process.env.NODE_ENV = "test"
      }
    })

    it("should use development when no NODE_ENV", () => {
      try {
        delete process.env.NODE_ENV
        env = envLoader(config)
        expect(env).to.be.eql(config.development)
        expect(env.name).to.be.equal("development")
        expect(env.log).to.be.false
        expect(env.foo).to.be.equal("bar")
        expect(env.z).to.be.undefined

      } finally {
        process.env.NODE_ENV = "test"
      }
    })

    it("should defaults to defaults", () => {
      env = envLoader({
        defaults: { x: 3, "v.j": "test" },
        test: { y: 4, "v.j": "env:DATA", "a.b.c": "env:ABC" },
      })
      expect(env.x).to.be.equal(3)
      expect(env.y).to.be.equal(4)
      expect(env.v.j).to.be.equal("test")
      expect(env.a.b.c).to.be.undefined
    })
  })

  describe("environments", () => {
    it("should load supplied environment", () => {
      const production = _.clone(config.production)
      expect(production.x).to.be.undefined
      expect(production.y).to.be.undefined
      const { defaults } = config
      production.x = defaults.x
      production.y = defaults.y
      production.home = homedir
      expect(envLoader(config, "test")).to.be.eql(config.test)
      expect(envLoader(config, "development")).to.be.eql(config.development)
      expect(envLoader(config, "production")).to.be.eql(production)
    })

    it("should fill unset attributes with development values", () => {
      const production = envLoader(config, "production")
      expect(production.x).to.be.equal(3)
      expect(production.y).to.be.equal(4)
    })

    it("should not affect set values", () => {
      const production = envLoader(config, "production")
      expect(production.name).to.be.equal("production")
      expect(production.log).to.be.true
      expect(production.foo).to.be.null
      expect(production.z).to.be.equal(5)
    })

    it("should deal with nested environments", () => {
      const env = envLoader({ defaults: { x: 3 }, "test.y": 4 })
      expect(env).to.be.eql({ x: 3, y: 4 })
    })
  })

  describe("support non-objects", () => {
    it("should return string", () => {
      expect(envLoader({ defaults: undefined, test: "something" }))
        .to.be.equal("something")
    })

    it("should return integer", () => {
      expect(envLoader({ defaults: undefined, test: 42 })).to.be.equal(42)
    })

    it("should not return integer", () => {
      expect(envLoader({ defaults: undefined, test: "42" })).to.be.equal("42")
    })

    it("should return float", () => {
      expect(envLoader({ defaults: undefined, test: .125 })).to.be.equal(.125)
    })

    it("should not return float", () => {
      expect(envLoader({ defaults: undefined, test: "5.0" })).to.be.equal("5.0")
    })

    it("should return true", () => {
      expect(envLoader({ defaults: undefined, test: true })).to.be.true
    })

    it("should not return true", () => {
      expect(envLoader({ defaults: undefined, test: "true" }))
        .to.be.equal("true")
    })

    it("should return false", () => {
      expect(envLoader({ defaults: undefined, test: false })).to.be.false
    })

    it("should not return false", () => {
      expect(envLoader({ defaults: undefined, test: "false" }))
        .to.be.equal("false")
    })

    it("should return null", () => {
      expect(envLoader({ defaults: undefined, test: null })).to.be.null
    })

    it("should not return null", () => {
      expect(envLoader({ defaults: undefined, test: "null" }))
        .to.be.equal("null")
    })

    it("should return regex", () => {
      const regex = envLoader({ defaults: undefined, test: "/^.*$/gi" })
      expect(regex).to.be.a("RegExp")
      expect(regex.source).to.be.equal("^.*$")
      expect(regex.flags).to.be.equal("gi")
    })
  })

  describe("duration strings", () => {
    it("should parse milliseconds", () => {
      expect(envLoader({ defaults: undefined, test: "PT0.050S" }))
        .to.be.equal(50)
    })

    it("should parse seconds", () => {
      expect(envLoader({ defaults: undefined, test: "PT2S" })).to.be.equal(2000)
    })

    it("should parse minutes", () => {
      expect(envLoader({ defaults: undefined, test: "PT5M" }))
        .to.be.equal(300000)
    })

    it("should parse hours", () => {
      expect(envLoader({ defaults: undefined, test: "PT3H" }))
        .to.be.equal(10800000)
    })

    it("should parse days", () => {
      expect(envLoader({ defaults: undefined, test: "P3DT12H" }))
        .to.be.equal(302400000)
    })

    it("should parse weeks", () => {
      expect(envLoader({ defaults: undefined, test: "P2W" }))
        .to.be.equal(1209600000)
    })

    it("should deal with compound times", () => {
      expect(envLoader({ defaults: undefined, test: "PT1H30M" }))
        .to.be.equal(5400000)
    })

    it("should detect internal data", () => {
      expect(
        envLoader({ defaults: undefined, test: { internal: "PT2.25S" } })
          .internal
      ).to.be.equal(2250)
    })
  })

  describe("date/time string", () => {
    it("should return date", () => {
      const value = envLoader({ defaults: undefined, test: "1970-01-01" })
      expect(value).to.be.a("date")
      expect(value.toJSON().slice(0, 10)).to.be.equal("1970-01-01")
    })

    it("should return date/time", () => {
      const value = envLoader({
        defaults: undefined,
        test: "1970-01-01T02:30:10Z",
      })
      expect(value).to.be.a("date")
      expect(value.toJSON()).to.be.equal("1970-01-01T02:30:10.000Z")
    })

    it("should return date/time with timezone", () => {
      const value = envLoader({
        defaults: undefined,
        test: "1970-01-01T02:30:10-0300",
      })
      expect(value).to.be.a("date")
      expect(value.toJSON()).to.be.equal("1970-01-01T05:30:10.000Z")
    })

    it("should return date/time with milliseconds", () => {
      const value = envLoader({
        defaults: undefined,
        test: "1970-01-02T12:40:03.125Z",
      })
      expect(value).to.be.a("date")
      expect(value.toJSON()).to.be.equal("1970-01-02T12:40:03.125Z")
    })

    it("should be wrong date resilient", () => {
      const value = envLoader({
        defaults: undefined,
        test: "1970-13-02T12:40:03.125Z",
      })
      expect(value).to.be.a("string")
      expect(value).to.be.equal("1970-13-02T12:40:03.125Z")
    })
  })

  describe("raw string", () => {
    it("should return empty string", () => {
      expect(envLoader({ defaults: undefined, test: "raw:" }))
        .to.be.equal("")
    })

    it("should not parse number", () => {
      expect(envLoader({ defaults: undefined, test: "raw:42" }))
        .to.be.equal("42")
    })

    it("should not parse true", () => {
      expect(envLoader({ defaults: undefined, test: "raw:true" }))
        .to.be.equal("true")
    })

    it("should not parse false", () => {
      expect(envLoader({ defaults: undefined, test: "raw:false" }))
        .to.be.equal("false")
    })

    it("should not parse null", () => {
      expect(envLoader({ defaults: undefined, test: "raw:null" }))
        .to.be.equal("null")
    })

    it("should not parse env", () => {
      expect(envLoader({ defaults: undefined, test: "raw:env:HOME" }))
        .to.be.equal("env:HOME")
    })

    it("should not parse duration", () => {
      expect(envLoader({ defaults: undefined, test: "raw:PT12H" }))
        .to.be.equal("PT12H")
    })

    it("should not parse raw", () => {
      expect(envLoader({ defaults: undefined, test: "raw:raw:true" }))
        .to.be.equal("raw:true")
    })

    it("should not parse regex", () => {
      expect(envLoader({ defaults: undefined, test: "raw:/^.*$/" }))
        .to.be.equal("/^.*$/")
    })

    it("should not parse date", () => {
      expect(envLoader({ defaults: undefined, test: "raw:2000-12-31" }))
        .to.be.equal("2000-12-31")
    })

    it("should not parse date/time", () => {
      expect(envLoader({
        defaults: undefined, test: "raw:2000-12-31T23:59:59.999Z",
      }))
        .to.be.equal("2000-12-31T23:59:59.999Z")
    })
  })

  describe("URI", () => {
    it("should respect local URIs", () => {
      const url = "file:///usr/local/bin"
      expect(envLoader({ defaults: undefined, test: url })).to.be.equal(url)
    })

    it("should respect remote URIs", () => {
      const url = "http://localhost/test/"
      expect(envLoader({ defaults: undefined, test: url })).to.be.equal(url)
    })

    it("should respect URIs with querystring", () => {
      const url = "mysql://user:pass@localhost:3600/db?charset=utf-8"
      expect(envLoader({ defaults: undefined, test: url })).to.be.equal(url)
    })
  })

  describe("nested keys", () => {
    it("should recognise nested keys", () => {
      const env = envLoader({
        defaults: undefined,
        test: {
          basic: 42,
          nonnested: { v: "PT0.125S" },
          "nonnested.x": "2010-10-10",
          "nested.a.a": "/^.*$/",
          "nested.a.b": "5.0",
          "nested.b.a": null,
          "nested.b.b": true,
          "nested.c": "some value",
        },
      })

      const nestedX = env.nonnested.x
      const regex = env.nested.a.a

      expect(env).to.be.eql({
        basic: 42,
        nonnested: { v: 125, x: nestedX },
        nested: {
          a: {
            a: regex,
            b: "5.0",
          },
          b: {
            a: null,
            b: true,
          },
          c: "some value",
        },
      })
      expect(nestedX).to.be.a("date")
      expect(nestedX.toJSON().slice(0, 10)).to.be.equal("2010-10-10")
      expect(regex).to.be.a("RegExp")
    })
  })

  describe("envvar", () => {

    before(() => {
      // Grant cleaning start
      delete process.env.DATA
    })

    after(() => {
      delete process.env.DATA
    })

    it("should support undefined", () => {
      expect(envLoader({ defaults: undefined, test: "env:DATA" }))
        .to.be.equal(undefined)
    })

    it("should get envvar", () => {
      process.env.DATA = "42"
      expect(envLoader({ defaults: undefined, test: "env:DATA" }))
        .to.be.equal(42)
    })

    it("should recognise empty", () => {
      process.env.DATA = ""
      expect(envLoader({ defaults: undefined, test: "env:DATA" }))
        .to.be.equal("")
    })

    it("should recognise undefined", () => {
      delete process.env.DATA
      expect(envLoader({ defaults: undefined, test: "env:DATA" }))
        .to.be.undefined
    })

    it("should recognise querystring", () => {
      process.env.DATA = "x=3&y=4&t=PT2S&v=null&b=true&v2=raw:null"
      expect(envLoader({ defaults: undefined, test: "env:DATA" }))
        .to.be.eql({ x: 3, y: 4, t: 2000, v: null, b: true, v2: "null" })
    })

    it("should recognise duration and array", () => {
      process.env.DATA = "log[]=error&log[]=trace&time=PT2H"
      const data = envLoader({ defaults: undefined, test: "env:DATA" })
      expect(data).to.have.all.keys([ "log", "time" ])
      expect(data.log).to.be.eql([ "error", "trace" ])
      expect(data.time).to.be.equal(7200000)
    })

    it("should recognise inner data", () => {
      process.env.DATA = "x=3&y=4&data[foo]=bar&data[baaz]=null"
      const data = envLoader({ defaults: undefined, test: "env:DATA" })
      expect(data).to.have.all.keys([ "x", "y", "data" ])
      expect(data.x).to.be.equal(3)
      expect(data.y).to.be.equal(4)
      expect(data.data).to.be.eql({ foo: "bar", baaz: null })
    })
  })

  describe("regression: array must not be treated as object", () => {
    const config = {
      defaults: { log: [ "error", "trace" ] },
      test: { log: [ "error" ] },
      production: "env:DATA",
    }

    let test
    let development
    let production

    before(() => {
      // Grant cleaning start
      delete process.env.DATA
      process.env.DATA = "log[]=debug&log[]=console"
      test = envLoader(config, "test")
      development = envLoader(config, "development")
      production = envLoader(config, "production")
    })

    after(() => {
      delete process.env.DATA
    })

    it("should development be default", () => {
      expect(development.log).to.be.eql([ "error", "trace" ])
    })

    it("should test be error", () => {
      expect(test.log).to.be.eql([ "error" ])
    })

    it("should production be alternative", () => {
      expect(production.log).to.be.eql([ "debug", "console" ])
    })
  })
})
