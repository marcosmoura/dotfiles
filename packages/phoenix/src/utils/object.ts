function clearObject(obj: object) {
  for (const prop of Object.getOwnPropertyNames(obj)) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    delete obj[prop]
  }
}

export { clearObject }
