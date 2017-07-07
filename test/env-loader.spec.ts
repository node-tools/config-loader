"use strict"


process.env.NODE_ENV = "test"
import * as _ from "underscore"
import { after, before, describe, it } from "mocha-co"
import { expect } from "chai"
const envLoader = require("../index")


type Config = { [key: string]: any }


const config: { [env: string]: Config } = {
  defaults:    { x: 3, y: 4 },
  test:        { name: "test", log: false, foo: "", x: 23, y: 42 },
  development: { name: "development", log: false, foo: "bar", x: 6, y: 8 },
  production:  { name: "production", log: true, foo: null, z: 5 },
}


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
      try {
        process.env.NODE_ENV = "production"
        env = envLoader(config)
        const production = _.clone(config.production)
        const { defaults } = config
        production.x = defaults.x
        production.y = defaults.y
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
  })

  describe("environments", () => {
    it("should load supplied environment", () => {
      const production = _.clone(config.production)
      const { defaults } = config
      production.x = defaults.x
      production.y = defaults.y
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
  })

  describe("support non-objects", () => {
    it("should return string", () => {
      expect(envLoader({ test: "something" })).to.be.equal("something")
    })

    it("should return number", () => {
      expect(envLoader({ test: 42 })).to.be.equal(42)
    })
  })

  describe("temporal strings", () => {
    it("should parse milliseconds", () => {
      expect(envLoader({ test: "50" })).to.be.equal(50)
    })

    it("should parse seconds", () => {
      expect(envLoader({ test: "2s" })).to.be.equal(2000)
    })

    it("should parse minutes", () => {
      expect(envLoader({ test: "5m" })).to.be.equal(300000)
    })

    it("should parse hours", () => {
      expect(envLoader({ test: "3h" })).to.be.equal(10800000)
    })

    it("should parse days", () => {
      expect(envLoader({ test: "3.5d" })).to.be.equal(302400000)
    })

    it("should detect internal data", () => {
      expect(envLoader({ test: { internal: "2.25h" } }).internal)
      .to.be.equal(8100000)
    })
  })

  describe("URI", () => {
    it("should respect local URIs", () => {
      const url = "file:///usr/local/bin"
      expect(envLoader({ test: url })).to.be.equal(url)
    })

    it("should respect remote URIs", () => {
      const url = "http://localhost/test/"
      expect(envLoader({ test: url })).to.be.equal(url)
    })

    it("should respect URIs with querystring", () => {
      const url = "mysql://user:pass@localhost:3600/db?charset=utf-8"
      expect(envLoader({ test: url })).to.be.equal(url)
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
      expect(envLoader({ test: "env:DATA" })).to.be.equal(undefined)
    })

    it("should get envvar", () => {
      process.env.DATA = "42"
      expect(envLoader({ test: "env:DATA" })).to.be.equal(42)
    })

    it("should recognise empty", () => {
      process.env.DATA = ""
      expect(envLoader({ test: "env:DATA" })).to.be.equal("")
    })

    it("should recognise querystring", () => {
      process.env.DATA = "x=3&y=4"
      expect(envLoader({ test: "env:DATA" })).to.be.eql({ x: 3, y: 4 })
    })

    it("should recognise temporal data", () => {
      process.env.DATA = "log=error&log=trace&time=2h"
      const data = envLoader({ test: "env:DATA" })
      expect(data).to.have.all.keys([ "log", "time" ])
      expect(data.log).to.be.eql([ "error", "trace" ])
      expect(data.time).to.be.equal(7200000)
    })

    it("should recognise inner data", () => {
      process.env.DATA = "x=3&y=4&data[foo]=bar&data[baaz]=null"
      const data = envLoader({ test: "env:DATA" })
      expect(data).to.have.all.keys([ "x", "y", "data" ])
      expect(data.x).to.be.equal(3)
      expect(data.y).to.be.equal(4)
      expect(data.data).to.be.eql({ foo: "bar", baaz: null })
    })
  })
})
