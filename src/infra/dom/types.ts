/** DOM value-bearing elements used by DomService. Lives in infra (browser type). */
export type ValueElement =
  | HTMLInputElement
  | HTMLSelectElement
  | HTMLTextAreaElement
  | (HTMLElement & { value: string });
