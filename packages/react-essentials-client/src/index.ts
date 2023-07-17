import React from "react";

/*
TODO:
- let user track mutations more easily (just returning mutation promise now)
- check online status (https://tanstack.com/query/latest/docs/react/guides/network-mode)
*/

type Resource<Variables, Data> = {
  resolver(variables: Variables): Promise<Data>;
  resolve(variables: Variables): Promise<Data>;
  getStatus(variables: Variables): Status<Data>;
  read(variables: Variables): Data;
  invalidate(criteria: (variables: Variables) => boolean): void;
  invalidateAll(): void;
  invalidateExact(variables: Variables): void;
  invalidatePartial(variables: RecursivelyPartial<Variables>): void;
  subscribe(variables: Variables, listener: Listener): Unsubscribe;
  /** does not suspend */
  useStatus(
    variables: Variables,
    options?: { revalidateOnMount?: boolean }
  ): Status<Data>;
  /** does suspend */
  useRead(
    variables: Variables,
    options?: { revalidateOnMount?: boolean }
  ): Data;
};

type Entry<Variables, Data> = {
  nextResolutionId: number;
  expectedResolutionId: number;
  resolutions: Record<number, Resolution<Data>>;
  subscriptions: Set<{ variables: Variables; listener: Listener }>;
  cachedData?: Data;
  revalidateAfterTimeoutId?: ReturnType<typeof setTimeout>;
  retryTimeoutId?: ReturnType<typeof setTimeout>;
};

type Resolution<Data> =
  | PendingResolution<Data>
  | ResolvedResolution<Data>
  | RejectedResolution;

type PendingResolution<Data> = {
  status: "pending";
  promise: Promise<Data>;
  resolutionId: number;
  startTimestamp: number;
};

type ResolvedResolution<Data> = {
  status: "resolved";
  data: Data;
  resolutionId: number;
  startTimestamp: number;
  endTimestamp: number;
};

type RejectedResolution = {
  status: "rejected";
  error: unknown;
  resolutionId: number;
  startTimestamp: number;
  endTimestamp: number;
};

type Status<Data> = {
  isValid: boolean;
} & DependentFields<"isResolving", "promise", Promise<Data>> &
  DependentFields<"hasData", "data", Data> &
  DependentFields<"hasError", "error", unknown>;

type Listener = () => void;
type Unsubscribe = () => void;

type DependentFields<
  BooleanField extends string,
  Field extends string,
  Value
> =
  | ({
      [K in BooleanField]: true;
    } & {
      [K in Field]: Value;
    })
  | {
      [K in BooleanField]: false;
    };

export function createResource<Variables, Data>(
  resolver: (variables: Variables) => Promise<Data>,
  {
    /** 0 to disable */
    revalidateAfterMs = 5 * 60 * 1000,
    revalidateOnFocus = true,
    revalidateOnConnect = true,
    /** 0 to stop retrying */
    shouldRetryInMs = ({ retries }) => {
      if (retries > 3) return 0;
      return 1000 * Math.pow(retries, 2);
    },
  }: {
    revalidateAfterMs?: number;
    revalidateOnFocus?: boolean;
    revalidateOnConnect?: boolean;
    shouldRetryInMs?(_: { retries: number; error: unknown }): number;
  } = {}
): Resource<Variables, Data> {
  const cache = new Map<Variables, Entry<Variables, Data>>();
  const findEntry = (variables: Variables): Entry<Variables, Data> => {
    for (const [entryVariables, entry] of cache.entries()) {
      if (deepIsEqual(entryVariables, variables)) {
        return entry;
      }
    }
    const entry: Entry<Variables, Data> = {
      nextResolutionId: 0,
      expectedResolutionId: 0,
      resolutions: {},
      subscriptions: new Set(),
    };
    cache.set(variables, entry);
    return entry;
  };
  const notify = (entry: Entry<Variables, Data>) => {
    entry.subscriptions.forEach((subscription) => {
      subscription.listener();
    });
  };
  const retryIt = (variables: Variables) => {
    const entry = findEntry(variables);
    const resolutions = Object.values(entry.resolutions).sort(
      (a, b) => b.resolutionId - a.resolutionId
    );
    const lastResolution = resolutions[0];
    if (lastResolution.status === "rejected") {
      const error = lastResolution.error;
      let retries = 0;
      for (let i = 0; i < resolutions.length; i++) {
        const resolution = resolutions[i];
        if (resolution.status === "rejected") retries++;
        else break;
      }
      const retryInMs = shouldRetryInMs({ error, retries });
      if (retryInMs > 0) {
        entry.retryTimeoutId = setTimeout(() => {
          resource.resolve(variables);
        }, retryInMs);
      }
    }
  };
  const garbageCollectResolutions = (entry: Entry<Variables, Data>) => {
    const resolutions = Object.values(entry.resolutions).sort(
      (a, b) => b.resolutionId - a.resolutionId
    );
    let startDeleting = false;
    for (let i = 1; i < resolutions.length; i++) {
      const resolution = resolutions[i];
      if (resolution.status === "resolved") startDeleting = true;
      if (startDeleting) delete entry.resolutions[resolution.resolutionId];
    }
  };
  const garbageCollectEntries = () => {
    for (const [variables, entry] of cache.entries()) {
      if (entry.subscriptions.size === 0) {
        cache.delete(variables);
      }
    }
  };
  const resource: Resource<Variables, Data> = {
    resolver,
    resolve(variables) {
      const entry = findEntry(variables);
      const startTimestamp = Date.now();
      const promise = resolver(variables);
      const resolutionId = entry.nextResolutionId++;
      const resolution: PendingResolution<Data> = {
        status: "pending",
        resolutionId,
        promise,
        startTimestamp,
      };
      entry.resolutions[resolutionId] = resolution;
      promise.then(
        (data) => {
          const endTimestamp = Date.now();
          const resolution: ResolvedResolution<Data> = {
            status: "resolved",
            resolutionId,
            data,
            startTimestamp,
            endTimestamp,
          };
          const entry = findEntry(variables);
          entry.resolutions[resolutionId] = resolution;
          if (entry.retryTimeoutId) {
            clearTimeout(entry.retryTimeoutId);
          }
          garbageCollectResolutions(entry);
        },
        (error) => {
          const endTimestamp = Date.now();
          const resolution: RejectedResolution = {
            status: "rejected",
            resolutionId,
            error,
            startTimestamp,
            endTimestamp,
          };
          const entry = findEntry(variables);
          entry.resolutions[resolutionId] = resolution;
          retryIt(variables);
          garbageCollectResolutions(entry);
        }
      );
      if (revalidateAfterMs > 0) {
        promise.finally(() => {
          const entry = findEntry(variables);
          if (entry.revalidateAfterTimeoutId) {
            clearTimeout(entry.revalidateAfterTimeoutId);
          }
          entry.revalidateAfterTimeoutId = setTimeout(() => {
            const entry = findEntry(variables);
            if (entry.subscriptions.size > 0) {
              resource.resolve(variables);
            }
          }, revalidateAfterMs);
        });
      }
      garbageCollectResolutions(entry);
      return promise;
    },
    getStatus(variables) {
      const entry = findEntry(variables);
      const resolutions = Object.values(entry.resolutions).sort(
        (a, b) => b.resolutionId - a.resolutionId
      );
      const lastResolution = resolutions[0];
      const isValid =
        lastResolution?.resolutionId >= entry.expectedResolutionId;
      const dataResolution = resolutions.find(
        (resolution) => resolution.status === "resolved"
      ) as ResolvedResolution<Data> | undefined;
      const errorResolution = resolutions.find(
        (resolution) =>
          resolution.status === "rejected" &&
          resolution.resolutionId > (dataResolution?.resolutionId ?? -1)
      ) as RejectedResolution | undefined;
      return {
        isValid,
        ...(lastResolution?.status === "pending"
          ? { isResolving: true, promise: lastResolution.promise }
          : { isResolving: false }),
        ...(dataResolution
          ? {
              hasData: true,
              data: (entry.cachedData = reuseInstances(
                entry.cachedData,
                dataResolution.data
              ) as Data),
            }
          : { hasData: false }),
        ...(errorResolution
          ? { hasError: true, error: errorResolution.error }
          : { hasError: false }),
      };
    },
    read(variables) {
      const status = resource.getStatus(variables);
      if (status.hasError) throw status.error;
      if (status.isResolving) throw status.promise;
      if (status.hasData) return status.data;
      throw resource.resolve(variables);
    },
    invalidate(criteria) {
      for (const [variables, entry] of cache.entries()) {
        if (criteria(variables)) {
          entry.expectedResolutionId = entry.nextResolutionId;
          if (entry.subscriptions.size > 0) {
            resource.resolve(variables);
            notify(entry);
          }
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
      const entry = findEntry(variables);
      const subscription = { variables, listener };
      entry.subscriptions.add(subscription);
      const status = resource.getStatus(variables);
      if (!status.isValid) {
        resource.resolve(variables);
      }
      return () => {
        entry.subscriptions.delete(subscription);
        garbageCollectEntries();
      };
    },
    useStatus(variables, { revalidateOnMount = true } = {}) {
      const structuralVariables = useStructuralValue(variables);
      const [status, setStatus] = React.useState(() =>
        resource.getStatus(structuralVariables)
      );
      React.useEffect(() => {
        if (revalidateOnMount) {
          resource.resolve(structuralVariables);
        }
        return resource.subscribe(structuralVariables, () => {
          setStatus(resource.getStatus(structuralVariables));
        });
      }, [revalidateOnMount, structuralVariables]);
      const lastDataRef = React.useRef(
        status.hasData ? status.data : undefined
      );
      if (status.hasData) {
        const reusedInstances = reuseInstances(
          lastDataRef.current,
          status.data
        ) as Data;
        lastDataRef.current = reusedInstances;
        status.data = reusedInstances;
      }
      return status;
    },
    useRead(variables, { revalidateOnMount = true } = {}) {
      const structuralVariables = useStructuralValue(variables);
      const [, forceUpdate] = React.useState(0);
      React.useEffect(() => {
        if (revalidateOnMount) {
          resource.resolve(structuralVariables);
        }
        return resource.subscribe(structuralVariables, () => {
          forceUpdate((count) => count + 1);
        });
      }, [revalidateOnMount, structuralVariables]);
      const data = resource.read(structuralVariables);
      const lastDataRef = React.useRef(data);
      lastDataRef.current = reuseInstances(lastDataRef.current, data) as Data;
      return lastDataRef.current;
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

function useStructuralValue<Value>(value: Value) {
  const lastValueRef = React.useRef(value);
  if (!deepIsEqual(lastValueRef.current, value)) {
    lastValueRef.current = value;
  }
  return lastValueRef.current;
}
