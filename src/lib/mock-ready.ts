let initialization: Promise<void> = Promise.resolve()

export function setMockInitialization(promise: Promise<unknown>) {
  initialization = promise.then(() => undefined)
}

export function waitForMockInitialization() {
  return initialization
}
