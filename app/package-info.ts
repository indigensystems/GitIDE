import { bundleID, companyName, productName, version } from './package.json'

export function getProductName() {
  // Always use same product name so dev and prod share the same app data
  return productName
}

export function getCompanyName() {
  return companyName
}

export function getVersion() {
  return version
}

export function getBundleID() {
  return process.env.NODE_ENV === 'development' ? `${bundleID}Dev` : bundleID
}
