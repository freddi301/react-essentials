import React from "react";

// TODO fix invalidation e reloading

// TODO let user track mutations more easily (just returning mutation promise now)

type Resource<Variables, Data> = {
  resolver(variables: Variables): Promise<Data>;
  /** throws promise if not cached */
  read(variables: Variables): Data;
  invalidate(criteria: (variables: Variables) => boolean): void;
  invalidateAll(): void;
  invalidateExact(variables: Variables): void;
  invalidatePartial(variables: RecursivelyPartial<Variables>): void;
  subscribe(variables: Variables, listener: Listener): Unsubscribe;
  /** cuases component to suspend */
  useData(
    variables: Variables,
    options?: { revalidateOnMount?: boolean }
  ): Data;
  /** do not uses suspense */
  useQuery(
    variables: Variables,
    options?: { revalidateOnMount?: boolean }
  ): {
    data?: Data;
    isLoading: boolean;
  };
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
  type Entry = {
    isValid: boolean;
    revalidateAfterTimeoutId: ReturnType<typeof setTimeout> | null;
  } & ({ hasData: true; data: Data } | { hasData: false }) &
    (
      | { isResolving: true; promise: Promise<Data>; resolutionId: number }
      | { isResolving: false }
    ) &
    ({ hasError: true; error: unknown } | { hasError: false });
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
  const notify = (variables: Variables) => {
    subscriptions.forEach((subscription) => {
      if (deepIsEqual(subscription.variables, variables)) {
        subscription.listener();
      }
    });
  };

  const resolve = (variables: Variables): Promise<Data> => {
    let found = findEntry(variables);
    if (!found) {
      const entry: Entry = {
        isValid: false,
        revalidateAfterTimeoutId: null,
        hasData: false,
        isResolving: false,
        hasError: false,
      };
      cache.set(variables, entry);
      found = { variables, entry };
    }
    if (found.entry.revalidateAfterTimeoutId) {
      clearTimeout(found.entry.revalidateAfterTimeoutId);
    }
    const revalidateAfterTimeoutId = setTimeout(() => {
      resource.invalidateExact(variables);
    }, revalidateAfter);
    const resolutionId = Math.random();
    const promise = tryResolve(variables);
    cache.set(variables, {
      isValid: true,
      revalidateAfterTimeoutId,
      ...(found.entry.hasData
        ? {
            hasData: true,
            data: found.entry.data,
          }
        : { hasData: false }),
      isResolving: true,
      resolutionId,
      promise,
      hasError: false,
    });
    promise.then(
      (data) => {
        const found = findEntry(variables);
        if (
          found &&
          found.entry.isResolving &&
          found.entry.resolutionId !== resolutionId
        ) {
          return;
        }
        cache.set(variables, {
          isValid: true,
          revalidateAfterTimeoutId,
          hasData: true,
          data:
            found && found.entry.hasData
              ? (reuseInstances(found.entry.data, data) as Data)
              : data,
          isResolving: false,
          hasError: false,
        });
        notify(variables);
      },
      (error) => {
        const found = findEntry(variables);
        if (
          found &&
          found.entry.isResolving &&
          found.entry.resolutionId !== resolutionId
        ) {
          return;
        }
        cache.set(variables, {
          isValid: found?.entry.isValid ?? true,
          revalidateAfterTimeoutId,
          hasData: false,
          isResolving: false,
          hasError: true,
          error,
        });
        notify(variables);
      }
    );
    return promise;
  };
  const resource: Resource<Variables, Data> = {
    resolver,
    read(variables) {
      const found = findEntry(variables);
      if (!found) {
        throw resolve(variables);
      } else {
        if (!found.entry.isValid) {
          throw resolve(variables);
        } else if (found.entry.hasError) {
          throw found.entry.error;
        } else if (found.entry.hasData) {
          return found.entry.data;
        } else if (found.entry.isResolving) {
          throw found.entry.promise;
        } else {
          throw new Error(); // it should not get here
        }
      }
    },
    invalidate(criteria) {
      for (const [variables, entry] of cache.entries()) {
        if (criteria(variables)) {
          if ("isValid" in entry) entry.isValid = false;
          notify(variables);
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
      const previous = React.useRef<Data>();
      const data = resource.read(variables);
      const reused = reuseInstances(previous.current, data) as Data;
      previous.current = data;
      return reused;
    },
    useQuery(variables, { revalidateOnMount = true } = {}) {
      // TODO
      throw new Error("not yet implemented");
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

export function reuseInstances(cached: unknown, incoming: unknown) {
  if (incoming === cached) return cached;
  if (incoming instanceof Array && cached instanceof Array) {
    let everythingIsEqual = incoming.length === cached.length;
    const reconstructed: Array<unknown> = [];
    for (let i = 0; i < incoming.length; i++) {
      const chosen = reuseInstances(cached[i], incoming[i]);
      if (chosen === cached[i]) {
        reconstructed[i] = cached[i];
      } else {
        everythingIsEqual = false;
        reconstructed[i] = chosen;
      }
    }
    if (everythingIsEqual) return cached;
    return reconstructed;
  }
  if (
    typeof incoming === "object" &&
    incoming !== null &&
    typeof cached === "object" &&
    cached !== null
  ) {
    let everythingIsEqual = true;
    const reconstructed: Record<string, unknown> = {};
    for (const [key] of Object.keys(incoming)) {
      const chosen = reuseInstances(
        (cached as any)[key],
        (incoming as any)[key]
      );
      if (chosen === (cached as any)[key]) {
        reconstructed[key] = (cached as any)[key];
      } else {
        everythingIsEqual = false;
        reconstructed[key] = chosen;
      }
    }
    for (const [key] of Object.entries(cached)) {
      if (!(key in reconstructed)) {
        everythingIsEqual = false;
      }
    }
    if (everythingIsEqual) return cached;
    return reconstructed;
  }
  return incoming;
}
