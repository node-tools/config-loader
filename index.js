"use strict"

/* eslint no-unused-vars: ["warn", {"args": "after-used"}] */
/* eslint no-console: 0 */
/* eslint max-depth: 0 */

const _ = require("underscore")
const fs = require("fs")
const path = require("path")
const qs = require("qs")
const yaml = require("js-yaml")
const duration = require("iso8601-duration")
const callsites = require("callsites")

let singleValue = null

const getNodeEnv = () => process.env.NODE_ENV || "development"

// Woraround duration.default.pattern issue
const durationPattern = new RegExp(
  `^${duration.default.pattern.toString().slice(1, -1)}$`
)

const dtPattern =
  /^\d{4}-\d\d-\d\d(T\d\d:\d\d(:\d\d(\.\d\d\d)?([+-]\d{4}|Z)?)?)?$/

function buildEnvromentConfigs(configs) {
  const envName = getNodeEnv().toUpperCase()
  const rootKeys = Object.keys(process.env)
                         .filter(key => key.startsWith(envName))
  
  for(const propName of rootKeys) {
    const [ , ...navKeys ] = propName.split(/_/g)
      const desiredValue = process.env[propName]
      setValue(configs, navKeys, desiredValue)
  }
  
  return configs
}

function setValue(configs, navKeys, desiredValue) {

  for (const currentKey of navKeys) {
    const entry = [
      [ currentKey              , configs[currentKey]               ],
      [ currentKey.toLowerCase(), configs[currentKey.toLowerCase()] ]
    ].find(e => e[1])

    if (entry) {
      const [ propName, propValue ] = entry
      if (propName) { 
        
        /** if Object */
        if (
            _.isObject(propValue) && 
            !_.isArray(propValue)
          ) {

          const [, ...tail ] = navKeys
          configs[propName] = setValue(configs[propName], tail, desiredValue)
        } else {
          configs[propName] = desiredValue
        }
      }
    }

    return configs
  }
}

function replicate(destination, source) {
  if (destination === undefined || destination === source)
    return source

  if (_.isObject(destination) && !_.isArray(destination))
    for (const attr in source)
      if (_.chain(source).keys().contains(attr).value())
        destination[attr] = replicate(destination[attr], source[attr])

  return destination
}


function parseEnvValue(resource, isQs = false) {
  if (isQs && typeof resource === "string")
    try { resource = JSON.parse(resource) }
    catch(_err) {}

  try {
    switch (typeof resource) {
      //------------------------------------------------------------------------
      case "string":
        switch (true) {
          case resource.trim() === "": // empty string
            break

          case resource.startsWith("raw:"): // raw string
            resource = resource.slice(4)
            break

          case resource.startsWith("env:"): // parse envvar
            resource = parseEnvValue(process.env[resource.slice(4)], true)
            break

          case durationPattern.test(resource): // ISO-8601 duration
            resource = duration.toSeconds(duration.parse(resource)) * 1000
            break

          case /^\w+(\[\w*\])?=([^&]*)?(&\w+(\[\w*\])?=([^&]*)?)*$/
              .test(resource):
            resource = _.chain(qs.parse(resource))
                        .map((v, k) => [ k, parseEnvValue(v, true) ])
                        .filter(pair => pair[1] !== undefined)
                        .object()
                        .value()
            resource = singleValue(_.isEmpty(resource) ? undefined : resource)
            break

          case /^\/.+\/[gimuy]*$/.test(resource):
            {
              let flags
              if (!resource.endsWith("/")) {
                flags = _.last(resource.split("/"))
                resource = resource.replace(/^(\/.+\/)[gimuy]+$/, "$1")
              }
              resource = new RegExp(resource.slice(1, -1), flags)
            }
            break

          case dtPattern.test(resource): // ISO-8601 date/time
            try {
              const date = new Date(resource)
              if (date.toJSON() !== null)
                resource = date
            } catch(_e) {}
            break

          // TODO: nested keys
          default:

            // Take what you got
            break
        }

        break

      //------------------------------------------------------------------------
      case "object":
        switch (true) {
          case _.isEmpty(resource):
            // null, empty arrays, empty objects: do nothing
            break

          case Array.isArray(resource):
            resource = resource.map(e => parseEnvValue(e, isQs))
            break

          /*
           * Other cases go here
           */

          default:
            resource = _.chain(resource)
                        .map((v, k) => [ k, parseEnvValue(v, isQs) ])
                        .object()
                        .value()
        }

        break

      /*------------------------------------------------------------------------
       * case other type:
       *   goes here
       */

      //------------------------------------------------------------------------
      default:
        // Take what you got
        break
    }

  } catch(err) {
    console.error(err)
  }

  return resource
}


function expandKeys(obj) {
  if (!_.isObject(obj))
    return obj

  for (const [ key, value ] of _.pairs(obj))
    if (key.indexOf(".") > 0) {
      const [ outer, ...rest ] = key.split(".")
      const inner = rest.join(".")

      if (_.isObject(obj[outer])) {
        obj[outer][inner] = value
        delete obj[key]

      } else if (_.isUndefined(obj[outer])) {
        obj[outer] = { [inner]: value }
        delete obj[key]
      }
    }

  for (const value of _.values(obj))
    expandKeys(value)

  return obj
}


function loadModule(fname) {
  if (!fname.startsWith("/")) {
    const base = path.dirname(callsites()[2].getFileName())
    fname = path.join(base, fname)
  }

  if (fname.endsWith(".json"))
    return require(fname)
  else if (fname.endsWith(".yaml") || fname.endsWith(".yml"))
    return yaml.safeLoad(fs.readFileSync(fname, "utf8"))
  else
    throw new Error(`invalid file ${fname}`)
}


singleValue = value =>
  (
    (_.keys(value).length === 1)
    && _.chain(value).values().first().value() === ""
  ) ? parseEnvValue(_.chain(value).keys().first().value())
    : value


module.exports = (config, nodeEnv) => {
  if (_.isString(config))
    config = loadModule(config)

  nodeEnv = nodeEnv || getNodeEnv()
  config = parseEnvValue(expandKeys(_.clone(config)))

  const { defaults, development } = config
  let current = _.isUndefined(config[nodeEnv]) ? development : config[nodeEnv]
  current = _.isUndefined(current) ? development : current
  current = _.isUndefined(current) ? defaults : current

  if (current !== defaults)
    current = replicate(current, defaults)

  return buildEnvromentConfigs(current)
  // return current
}
