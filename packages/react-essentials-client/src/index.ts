import React from "react";

/*
TODO:
- createClient that returns createQuery and createMutation (so user can invalidate all queries at once)
- make single hook wiht and wihtout suspanse (suspend: boolean = true, catchError: boolean = true, useDeferredValue: boolean = true)
- refactor to 2 files
- let user track mutations more easily (just returning mutation promise now)
- check online status (https://tanstack.com/query/latest/docs/react/guides/network-mode)
- useReads useStatuses (for a list of queries)
- useStatuses (for a list of mutations)
*/

type Query<Variables, Data> = {
  resolver(variables: Variables): Promise<Data>;
  resolve(variables: Variables): Promise<Data>;
  getStatus(variables: Variables): QueryStatus<Data>;
  read(variables: Variables): Data;
  invalidate(criteria: (variables: Variables) => boolean): void;
  invalidateAll(): void;
  invalidateExact(variables: Variables): void;
  invalidatePartial(variables: RecursivelyPartial<Variables>): void;
  subscribe(variables: Variables, listener: Listener): Unsubscribe;
  useQueryState(
    variables: Variables,
    options?: { revalidateOnMount?: boolean }
  ): QueryState<Variables, Data>;
  /** uses suspense */
  useQueryRead<V extends Variables | null>(
    variables: V,
    options?: { revalidateOnMount?: boolean; useDeferredValue?: boolean }
  ): {
    isPending: boolean;
    variables: V;
    data: V extends null ? undefined : Data;
  };
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

type QueryStatus<Data> = { isValid: boolean } & (
  | { isResolving: true; promise: Promise<Data> }
  | { isResolving: false; promise: undefined }
) &
  (
    | {
        hasData: false;
        data: undefined;
        hasError: false;
        error: undefined;
      }
    | {
        hasData: true;
        data: Data;
        hasError: false;
        error: undefined;
      }
    | {
        hasData: false;
        data: undefined;
        hasError: true;
        error: unknown;
      }
  );

type QueryState<Variables, Data> = {
  isPending: boolean;
  variables: Variables | null;
  data: Data | undefined;
  error: unknown | undefined;
};

type Listener = () => void;
type Unsubscribe = () => void;

export function createQuery<Data, Variables = undefined>(
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
): Query<Variables, Data> {
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
          query.resolve(variables);
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
      garbageCollectResolutions(entry);
      if (
        entry.subscriptions.size === 0 &&
        Object.values(entry.resolutions).every(
          (resolution) =>
            resolution.status === "resolved" &&
            resolution.endTimestamp - resolution.startTimestamp <=
              revalidateAfterMs
        )
      ) {
        cache.delete(variables);
      }
    }
  };
  const query: Query<Variables, Data> = {
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
              query.resolve(variables);
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
      const lastSettledResolution = resolutions.find(
        (resolution) => resolution.status !== "pending"
      ) as ResolvedResolution<Data> | RejectedResolution | undefined;
      return {
        isValid,
        ...(() => {
          switch (lastResolution?.status) {
            case "pending": {
              return {
                isResolving: true,
                promise: lastResolution.promise,
              };
            }
            default: {
              return {
                isResolving: false,
                promise: undefined,
              };
            }
          }
        })(),
        ...(() => {
          switch (lastSettledResolution?.status) {
            case "resolved": {
              entry.cachedData = reuseInstances(
                entry.cachedData,
                lastSettledResolution.data
              ) as Data;
              return {
                hasData: true,
                data: entry.cachedData,
                hasError: false,
                error: undefined,
              };
            }
            case "rejected": {
              return {
                hasData: false,
                data: undefined,
                hasError: true,
                error: lastSettledResolution.error,
              };
            }
            default: {
              return {
                hasData: false,
                data: undefined,
                hasError: false,
                error: undefined,
              };
            }
          }
        })(),
      };
    },
    read(variables) {
      const status = query.getStatus(variables);
      if (status.isResolving) throw status.promise;
      if (status.hasError) throw status.error;
      if (status.hasData) return status.data;
      throw query.resolve(variables);
    },
    invalidate(criteria) {
      for (const [variables, entry] of cache.entries()) {
        if (criteria(variables)) {
          entry.expectedResolutionId = entry.nextResolutionId;
          if (entry.subscriptions.size > 0) {
            query.resolve(variables);
            notify(entry);
          }
        }
      }
    },
    invalidateAll() {
      query.invalidate(() => true);
    },
    invalidateExact(variables) {
      query.invalidate((other) => deepIsEqual(variables, other));
    },
    invalidatePartial(variables) {
      query.invalidate((other) => partialDeepEqual(variables, other));
    },
    subscribe(variables, listener) {
      const entry = findEntry(variables);
      const subscription = { variables, listener };
      entry.subscriptions.add(subscription);
      const status = query.getStatus(variables);
      if (!status.isValid) {
        query.resolve(variables);
      }
      return () => {
        entry.subscriptions.delete(subscription);
        setTimeout(garbageCollectEntries, 0);
      };
    },
    useQueryState(variables, { revalidateOnMount = true } = {}) {
      const variablesRef = React.useRef(null as Variables | null);
      if (!deepIsEqual(variablesRef.current, variables)) {
        variablesRef.current = variables;
      }
      const currentVariables = variablesRef.current;
      React.useEffect(() => {
        if (currentVariables !== null && revalidateOnMount) {
          // TODO check for unneeded rerenders
          query.resolve(currentVariables);
        }
      }, [revalidateOnMount, currentVariables]);
      const createDisabledState = (): QueryState<Variables, Data> => ({
        isPending: false,
        variables: null,
        data: undefined,
        error: undefined,
      });
      const [state, setState] = React.useState(
        (): QueryState<Variables, Data> => {
          if (currentVariables !== null) {
            const status = query.getStatus(currentVariables);
            return {
              isPending: status.isResolving,
              variables: currentVariables,
              data: status.hasData ? status.data : undefined,
              error: status.hasError ? status.error : undefined,
            };
          } else {
            return createDisabledState();
          }
        }
      );
      React.useEffect(() => {
        const updateState = (
          state: QueryState<Variables, Data>
        ): QueryState<Variables, Data> => {
          const status = query.getStatus(variables);
          if (status.hasData) {
            return {
              isPending: status.isResolving,
              variables: variables,
              data: status.data,
              error: undefined,
            };
          }
          if (status.hasError) {
            return {
              isPending: status.isResolving,
              variables: variables,
              data: undefined,
              error: status.error,
            };
          }
          return {
            isPending: status.isResolving,
            variables: null,
            data: state.data,
            error: state.error,
          };
        };
        if (variables !== null) {
          setState(updateState);
          return query.subscribe(variables, () => {
            setState(updateState);
          });
        } else {
          setState(createDisabledState());
        }
      }, [variables]);
      const lastDataRef = React.useRef(state.data);
      if (state.data !== undefined) {
        const reusedInstances = reuseInstances(
          lastDataRef.current,
          state.data
        ) as Data;
        lastDataRef.current = reusedInstances;
        state.data = reusedInstances;
      }
      return state;
    },
    useQueryRead(
      variables,
      { revalidateOnMount = true, useDeferredValue = true } = {}
    ) {
      const variablesRef = React.useRef(variables);
      if (!deepIsEqual(variablesRef.current, variables)) {
        variablesRef.current = variables;
      }
      const currentVariables = variablesRef.current;
      const deferredVariables = React.useDeferredValue(
        useDeferredValue ? currentVariables : null
      );
      const effectiveVariables = useDeferredValue
        ? deferredVariables
        : currentVariables;
      const [, forceUpdate] = React.useState(0);
      React.useEffect(() => {
        if (effectiveVariables !== null) {
          return query.subscribe(effectiveVariables, () => {
            forceUpdate(Math.random());
          });
        }
      }, [effectiveVariables]);
      React.useEffect(() => {
        if (effectiveVariables !== null && revalidateOnMount) {
          // TODO check for unneeded rerenders
          // TODO implement
          // query.resolve(currentVariables);
        }
      }, [revalidateOnMount, effectiveVariables]);
      const data =
        effectiveVariables !== null
          ? query.read(effectiveVariables)
          : undefined;
      const lastDataRef = React.useRef(data);
      lastDataRef.current = reuseInstances(lastDataRef.current, data) as
        | Data
        | undefined;
      return {
        isPending: useDeferredValue
          ? effectiveVariables !== currentVariables
          : false,
        variables: effectiveVariables as any,
        data: lastDataRef.current as any,
      };
    },
  };
  // TODO re-enable (error: component suspended while responding to synchronesus event)
  // if (revalidateOnFocus) {
  //   window.addEventListener("focus", query.invalidateAll);
  // }
  // if (revalidateOnConnect) {
  //   window.addEventListener("online", query.invalidateAll);
  // }
  return query;
}

type Mutation<Variables, Data> = {
  mutate(
    variables: Variables,
    options?: {
      onSuccess?(_: { variables: Variables; data: Data }): void;
      onError?(_: { variables: Variables; error: unknown }): void;
    }
  ): Promise<Data>;
  useStatus(): SingleMutationStatus<Variables, Data>;
};

type SingleMutationStatus<Variables, Data> = (
  | {
      isResolving: false;
      hasData: false;
      hasError: false;
      variables: undefined;
      data: undefined;
      error: undefined;
    }
  | MutationStatus<Variables, Data>
) & {
  mutate(
    variables: Variables,
    options?: {
      onSuccess?(_: { variables: Variables; data: Data }): void;
      onError?(_: { variables: Variables; error: unknown }): void;
    }
  ): Promise<Data>;
};

type MutationStatus<Variables, Data> =
  | {
      isResolving: true;
      hasData: false;
      hasError: false;
      variables: Variables;
      data: undefined;
      error: undefined;
    }
  | {
      isResolving: false;
      hasData: true;
      hasError: false;
      variables: Variables;
      data: Data;
      error: undefined;
    }
  | {
      isResolving: false;
      hasData: false;
      hasError: true;
      variables: Variables;
      data: undefined;
      error: unknown;
    };

export function createMutation<Data, Variables = undefined>(
  performer: (variables: Variables) => Promise<Data>,
  globalOptions: {
    onSuccess?(_: { variables: Variables; data: Data }): void;
    onError?(_: { variables: Variables; error: unknown }): void;
  }
): Mutation<Variables, Data> {
  const mutation: Mutation<Variables, Data> = {
    mutate(variables, localOptions = {}) {
      const promise = performer(variables);
      promise.then(
        (data) => {
          globalOptions.onSuccess?.({ variables, data });
          localOptions.onSuccess?.({ variables, data });
        },
        (error) => {
          globalOptions.onError?.({ variables, error });
          localOptions.onError?.({ variables, error });
        }
      );
      return promise;
    },
    useStatus() {
      type State =
        | {
            type: "idle";
          }
        | {
            type: "pending";
            variables: Variables;
            promise: Promise<Data>;
          }
        | {
            type: "resolved";
            variables: Variables;
            data: Data;
          }
        | {
            type: "rejected";
            variables: Variables;
            error: unknown;
          };
      const [state, setState] = React.useState<State>({ type: "idle" });
      const mutate = React.useCallback<
        SingleMutationStatus<Variables, Data>["mutate"]
      >((variables, options) => {
        const promise = mutation.mutate(variables, options);
        setState({ type: "pending", variables, promise });
        promise.then(
          (data) => {
            setState((state) => {
              if (state.type === "pending" && promise === state.promise) {
                return { type: "resolved", variables, data };
              } else return state;
            });
          },
          (error) => {
            setState((state) => {
              if (state.type === "pending" && promise === state.promise) {
                return { type: "rejected", variables, error };
              } else return state;
            });
          }
        );
        return promise;
      }, []);
      switch (state.type) {
        case "idle": {
          return {
            isResolving: false,
            hasData: false,
            hasError: false,
            variables: undefined,
            data: undefined,
            error: undefined,
            mutate,
          };
        }
        case "pending": {
          return {
            isResolving: true,
            hasData: false,
            hasError: false,
            variables: state.variables,
            data: undefined,
            error: undefined,
            mutate,
          };
        }
        case "resolved": {
          return {
            isResolving: false,
            hasData: true,
            hasError: false,
            variables: state.variables,
            data: state.data,
            error: undefined,
            mutate,
          };
        }
        case "rejected": {
          return {
            isResolving: false,
            hasData: false,
            hasError: true,
            variables: state.variables,
            data: undefined,
            error: state.error,
            mutate,
          };
        }
      }
    },
  };
  return mutation;
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
    for (const [key] of Object.entries(incoming)) {
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
