export class RuntimeError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = "RuntimeError"
    this.status = status
    this.code = code
  }
}

export class CancelledError extends Error {
  constructor() {
    super("The run was cancelled")
    this.name = "CancelledError"
  }
}

export class BudgetError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = "BudgetError"
    this.code = code
  }
}
