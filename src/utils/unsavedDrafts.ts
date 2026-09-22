const dirtySources = new Set<string>();
const busySources = new Set<string>();

export function setUnsavedDraft(source: string, dirty: boolean) {
  if (dirty) dirtySources.add(source);
  else dirtySources.delete(source);
}

export function hasUnsavedDrafts() {
  return dirtySources.size > 0;
}

export function setAppBusy(source: string, busy: boolean) {
  if (busy) busySources.add(source);
  else busySources.delete(source);
}

export function hasAppBusy() {
  return busySources.size > 0;
}

let nextBusyToken = 0;
export async function whileAppBusy<T>(operation: () => Promise<T>): Promise<T> {
  const token = `pending-write-${++nextBusyToken}`;
  setAppBusy(token, true);
  try {
    return await operation();
  } finally {
    setAppBusy(token, false);
  }
}
