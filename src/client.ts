import React from "react";

// TODO structural sharing
// TODO let user track mutations more easily (just returning mutation promise now)

type Resource<Variables, Data> = {
  read(variables: Variables): Data;
  invalidate(criteria: (variables: Variables) => boolean): void;
  invalidateAll(): void;
  invalidateExact(variables: Variables): void;
  invalidatePartial(variables: RecursivelyPartial<Variables>): void;
  subscribe(variables: Variables, listener: Listener): Unsubscribe;
  useData(
    variables: Variables,
    options?: { revalidateOnMount?: boolean }
  ): Data;
};

type Listener = () => void;
type Unsubscribe = () => void;

export function createResource<Variables, Data>(
  resolver: (variables: Variables) => Promise<Data>,
  {
    shouldRetry = ({ retries }) => {
      if (retries > 3) return false;
      return 1000 * Math.pow(retries, 2);
    },
    revalidateOnFocus = true,
    revalidateOnConnect = true,
    revalidateAfter = 5 * 60 * 1000,
  }: {
    shouldRetry?(_: { retries: number; error: unknown }): number | false;
    revalidateOnFocus?: boolean;
    revalidateOnConnect?: boolean;
    revalidateAfter?: number;
  } = {}
): Resource<Variables, Data> {
  type Entry =
    | { data: Data; isValid: true; revalidateAfterTimeoutId: number }
    | {
        data: Data;
        isValid: false;
        promise?: Promise<Data>;
        revalidateAfterTimeoutId: number;
      }
    | { promise: Promise<Data> };
  const cache = new Map<Variables, Entry>();
  const findEntry = (
    variables: Variables
  ): { variables: Variables; entry: Entry } | undefined => {
    for (const [entryVariables, entry] of cache.entries()) {
      if (deepIsEqual(entryVariables, variables)) {
        return { variables: entryVariables, entry };
      }
    }
  };
  const subscriptions = new Set<{ variables: Variables; listener: Listener }>();
  const tryResolve = async (variables: Variables): Promise<Data> => {
    let retries = 1;
    let error;
    while (shouldRetry({ retries, error })) {
      try {
        return await resolver(variables);
      } catch (e) {
        error = e;
        retries++;
      }
    }
    throw error;
  };
  const udpateEntry = (variables: Variables) => (data: Data) => {
    const found = findEntry(variables);
    if (found && "revalidateAfterTimeoutId" in found.entry) {
      window.clearTimeout(found.entry.revalidateAfterTimeoutId);
    }
    const revalidateAfterTimeoutId = window.setTimeout(() => {
      resource.invalidateExact(variables);
    }, revalidateAfter);
    cache.set(variables, { isValid: true, data, revalidateAfterTimeoutId });
    subscriptions.forEach((subscription) => {
      if (deepIsEqual(subscription.variables, variables)) {
        subscription.listener();
      }
    });
  };
  const resource: Resource<Variables, Data> = {
    read(variables) {
      const found = findEntry(variables);
      if (!found) {
        const promise = tryResolve(variables);
        cache.set(variables, { promise });
        promise.then(udpateEntry(variables));
        throw promise;
      } else {
        if ("isValid" in found.entry && !found.entry.isValid) {
          const promise = tryResolve(variables);
          cache.set(variables, {
            data: found.entry.data,
            isValid: false,
            promise,
            revalidateAfterTimeoutId: found.entry.revalidateAfterTimeoutId,
          });
          promise.then(udpateEntry(variables));
        }
        if ("data" in found.entry) return found.entry.data;
        else throw found.entry.promise;
      }
    },
    invalidate(criteria) {
      for (const [variables, entry] of cache.entries()) {
        if (criteria(variables)) {
          if ("isValid" in entry) entry.isValid = false;
          subscriptions.forEach((subscription) => {
            if (deepIsEqual(subscription.variables, variables)) {
              subscription.listener();
            }
          });
        }
      }
    },
    invalidateAll() {
      resource.invalidate(() => true);
    },
    invalidateExact(variables) {
      resource.invalidate((other) => deepIsEqual(variables, other));
    },
    invalidatePartial(variables) {
      resource.invalidate((other) => partialDeepEqual(variables, other));
    },
    subscribe(variables, listener) {
      const subscription = { variables, listener };
      subscriptions.add(subscription);
      return () => subscriptions.delete(subscription);
    },
    useData(variables, { revalidateOnMount = true } = {}) {
      const [, forceUpdate] = React.useState(0);
      React.useEffect(() => {
        if (revalidateOnMount) {
          resource.invalidateExact(variables);
        }
        return resource.subscribe(variables, () =>
          forceUpdate((count) => count + 1)
        );
      }, [variables, revalidateOnMount]);
      return resource.read(variables);
    },
  };
  if (revalidateOnFocus) {
    window.addEventListener("focus", resource.invalidateAll);
  }
  if (revalidateOnConnect) {
    window.addEventListener("online", resource.invalidateAll);
  }
  return resource;
}

type Mutation<Variables, Data> = {
  mutate(variables: Variables): Promise<Data>;
};

export function createMutation<Variables, Data>(
  performer: (variables: Variables) => Promise<Data>,
  {
    onSuccess,
    onError,
  }: {
    onSuccess?(_: { variables: Variables; data: Data }): void;
    onError?(_: { variables: Variables; error: unknown }): void;
  }
): Mutation<Variables, Data> {
  return {
    async mutate(variables) {
      try {
        const data = await performer(variables);
        onSuccess?.({ variables, data });
        return data;
      } catch (error) {
        onError?.({ variables, error });
        throw error;
      }
    },
  };
}

function deepIsEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a instanceof Array && b instanceof Array) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepIsEqual(a[i], b[i])) return false;
    }
    return true;
  }
  if (
    typeof a === "object" &&
    a !== null &&
    typeof b === "object" &&
    b !== null
  ) {
    const allKeys = new Set<string>();
    for (const [key] of Object.entries(a)) allKeys.add(key);
    for (const [key] of Object.entries(b)) allKeys.add(key);
    for (const key of allKeys) {
      if (!deepIsEqual((a as any)[key], (b as any)[key])) return false;
    }
    return true;
  }
  return false;
}

type RecursivelyPartial<T> = { [K in keyof T]?: RecursivelyPartial<T[K]> };

function partialDeepEqual(a: unknown, b: unknown) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a instanceof Array && b instanceof Array) {
    for (let i = 0; i < a.length; i++) {
      if (!partialDeepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  if (
    typeof a === "object" &&
    a !== null &&
    typeof b === "object" &&
    b !== null
  ) {
    for (const [key] of Object.entries(a)) {
      if (!partialDeepEqual((a as any)[key], (b as any)[key])) return false;
    }
    return true;
  }
  return false;
}
