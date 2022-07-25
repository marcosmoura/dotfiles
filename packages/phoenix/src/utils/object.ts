function clearObject(obj: object) {
  for (const prop of Object.getOwnPropertyNames(obj)) {
    delete obj[prop]
  }
}

export { clearObject }
