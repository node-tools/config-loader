"use strict"

/* eslint no-unused-vars: ["warn", {"args": "after-used"}] */
/* eslint no-console: 0 */
/* eslint max-depth: 0 */

const _ = require("underscore")
const qs = require("qs")
const duration = require("iso8601-duration")
let singleValue = null

const getNodeEnv = () => process.env.NODE_ENV || "development"

// Woraround duration.default.pattern issue
const durationPattern = new RegExp(
  `^${duration.default.pattern.toString().slice(1, -1)}$`
)

const dtPattern =
  /^\d{4}-\d\d-\d\d(T\d\d:\d\d(:\d\d(\.\d\d\d)?([+-]\d{4}|Z)?)?)?$/


function replicate(destination, source) {
  if (destination === undefined || destination === source)
    return source

  if (_.isObject(destination))
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


singleValue = value =>
  (
    (_.keys(value).length === 1)
    && _.chain(value).values().first().value() === ""
  ) ? parseEnvValue(_.chain(value).keys().first().value())
    : value


module.exports = (config, nodeEnv) => {
  nodeEnv = nodeEnv || getNodeEnv()
  config = parseEnvValue(expandKeys(_.clone(config)))

  const { defaults, development } = config
  let current = _.isUndefined(config[nodeEnv]) ? development : config[nodeEnv]
  current = _.isUndefined(current) ? development : current
  current = _.isUndefined(current) ? defaults : current

  if (defaults !== current)
    current = replicate(current, defaults)

  return current
}
