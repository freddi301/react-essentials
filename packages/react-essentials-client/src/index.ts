import React from "react";

/*
TODO:
- check online status (https://tanstack.com/query/latest/docs/react/guides/network-mode)
- useQueryStates (for a list of queries)
- useMutationStates (for a list of mutations)
*/

type ClientOptions = {
  query?: Partial<QueryOptions & QueryHookOptions>;
};

type Client = {
  createQuery<Variables, Data>(
    resolver: Resolver<Variables, Data>,
    options?: Partial<QueryOptions & QueryHookOptions>
  ): Query<Variables, Data>;
  createMutation<Variables, Data>(
    performer: Performer<Variables, Data>,
    options?: Partial<MutationOptions<Variables, Data>>
  ): Mutation<Variables, Data>;
};

type Resolver<Variables, Data> = (variables: Variables) => Promise<Data>;

type QueryOptions = {
  /** 0 to disable */
  revalidateAfterMs: number;
  revalidateOnFocus: boolean;
  revalidateOnConnect: boolean;
  /** 0 to stop retrying */
  shouldRetryInMs(_: { retries: number; error: unknown }): number;
};

type QueryHookOptions = {
  suspendData: boolean;
  /** updates isLoading value, start a transition if using suspense */
  handleLoading: boolean;
  /** true = catches error and returns it; false = lets error bubble up */
  handleError: boolean;
  revalidateOnMount: boolean;
};

type QueryHookState<Variables, Data> = {
  isLoading: boolean;
  variables: Variables | null;
  data: Data | undefined;
  error: unknown;
};

type Query<Variables, Data> = {
  resolver(variables: Variables): Promise<Data>;
  resolve(variables: Variables): Promise<Data>;
  getState(variables: Variables): QueryState<Data>;
  read(variables: Variables): Data;
  invalidate(criteria: (variables: Variables) => boolean): void;
  invalidateAll(): void;
  invalidateExact(variables: Variables): void;
  invalidatePartial(variables: RecursivelyPartial<Variables>): void;
  subscribe(variables: Variables, listener: Listener): Unsubscribe;
  useQueryState(
    variables: Variables | null,
    options?: Partial<QueryHookOptions>
  ): QueryHookState<Variables, Data>;
};

type Listener = () => void;
type Unsubscribe = () => void;

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

type QueryState<Data> = { isValid: boolean } & (
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

type Performer<Variables, Data> = (variables: Variables) => Promise<Data>;

type MutationOptions<Variables, Data> = {
  onSuccess(_: { variables: Variables; data: Data }): void;
  onError(_: { variables: Variables; error: unknown }): void;
};

type MutateOptions<Variables, Data> = {
  onSuccess(_: { variables: Variables; data: Data }): void;
  onError(_: { variables: Variables; error: unknown }): void;
};

type Mutation<Variables, Data> = {
  mutate(
    variables: Variables,
    options?: Partial<MutationOptions<Variables, Data>>
  ): Promise<Data>;
  useMutationState(): MutationHookState<Variables, Data>;
};

type MutationHookState<Variables, Data> = {
  isLoading: boolean;
  variables: Variables | null;
  data: Data | undefined;
  error: unknown;
  mutate(
    variables: Variables,
    options?: Partial<MutateOptions<Variables, Data>>
  ): Promise<Data>;
};

type MutationState<Variables, Data> =
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

const defaultQueryOptions: QueryOptions = {
  revalidateAfterMs: 5 * 60 * 1000,
  revalidateOnFocus: true,
  revalidateOnConnect: true,
  shouldRetryInMs({ retries }) {
    if (retries > 3) return 0;
    return 1000 * Math.pow(retries, 2);
  },
};

const defaultQueryHookOptions: QueryHookOptions = {
  suspendData: true,
  handleLoading: true,
  handleError: true,
  revalidateOnMount: true,
};

export function createClient(clientOptions?: ClientOptions): Client {
  return {
    createQuery<Variables, Data>(
      resolver: (variables: Variables) => Promise<Data>,
      queryOptions?: QueryOptions & QueryHookOptions
    ): Query<Variables, Data> {
      const { shouldRetryInMs, revalidateAfterMs, revalidateOnFocus } = {
        ...defaultQueryOptions,
        ...defaultQueryHookOptions,
        ...clientOptions?.query,
        ...queryOptions,
      };
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
          const retryInMs = shouldRetryInMs!({ error, retries });
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
        for (let i = 0; i < resolutions.length; i++) {
          const resolution = resolutions[i];
          if (startDeleting) delete entry.resolutions[resolution.resolutionId];
          if (resolution.status !== "pending") startDeleting = true;
        }
      };
      const garbageCollectEntries = () => {
        for (const [variables, entry] of cache.entries()) {
          garbageCollectResolutions(entry);
          if (
            entry.subscriptions.size === 0 &&
            Object.values(entry.resolutions).every(
              (resolution) =>
                resolution.status !== "pending" &&
                Date.now() - resolution.endTimestamp >= revalidateAfterMs
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
              notify(entry);
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
          notify(entry);
          return promise;
        },
        getState(variables) {
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
          const status = query.getState(variables);
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
          const status = query.getState(variables);
          if (!status.isValid) {
            query.resolve(variables);
          }
          return () => {
            entry.subscriptions.delete(subscription);
            setTimeout(garbageCollectEntries, 0);
          };
        },
        useQueryState(variables, hookOptions) {
          // TODO implement all hook options
          const { handleLoading, suspendData, revalidateOnMount } = {
            ...defaultQueryOptions,
            ...defaultQueryHookOptions,
            ...clientOptions?.query,
            ...queryOptions,
            ...hookOptions,
          };
          // const useDeferredValue = suspendData && handleLoading;
          const variablesRef = React.useRef(variables);
          if (!deepIsEqual(variablesRef.current, variables)) {
            variablesRef.current = variables;
          }
          const currentVariables = variablesRef.current;
          // const deferredVariables = React.useDeferredValue(
          //   useDeferredValue ? currentVariables : null
          // );
          // const effectiveVariables = useDeferredValue
          //   ? deferredVariables
          //   : currentVariables;
          const updateState = React.useCallback(
            (variables: Variables | null) =>
              (
                state: QueryHookState<Variables, Data>
              ): QueryHookState<Variables, Data> => {
                if (variables === null) {
                  return {
                    isLoading: false,
                    variables: null,
                    data: undefined,
                    error: undefined,
                  };
                } else {
                  const queryState = query.getState(variables);
                  return {
                    isLoading: queryState.isResolving,
                    variables:
                      queryState.hasData || queryState.hasError
                        ? variables
                        : state.variables,
                    data: queryState.hasData ? queryState.data : state.data,
                    error: queryState.hasError ? queryState.error : state.error,
                  };
                }
              },
            []
          );
          const [state, setState] = React.useState(() =>
            updateState(currentVariables)({
              isLoading: false,
              variables: null,
              data: undefined,
              error: undefined,
            })
          );
          React.useEffect(() => {
            setState(updateState(currentVariables));
            if (currentVariables !== null) {
              return query.subscribe(currentVariables, () => {
                setState(updateState(currentVariables));
              });
            }
          }, [currentVariables, updateState]);
          React.useEffect(() => {
            if (currentVariables !== null && revalidateOnMount) {
              // TODO check for unneeded rerenders
              // TODO implement
              // query.resolve(currentVariables);
            }
          }, [revalidateOnMount, currentVariables]);
          const lastDataRef = React.useRef(state.data);
          lastDataRef.current = reuseInstances(
            lastDataRef.current,
            state.data
          ) as Data | undefined;
          return { ...state, data: lastDataRef.current };
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
    },
    createMutation<Data, Variables = undefined>(
      performer: (variables: Variables) => Promise<Data>,
      mutationOptions?: Partial<MutationOptions<Variables, Data>>
    ): Mutation<Variables, Data> {
      const mutation: Mutation<Variables, Data> = {
        mutate(variables, mutateOptions) {
          const promise = performer(variables);
          promise.then(
            (data) => {
              mutationOptions?.onSuccess?.({ variables, data });
              mutateOptions?.onSuccess?.({ variables, data });
            },
            (error) => {
              mutationOptions?.onError?.({ variables, error });
              mutateOptions?.onError?.({ variables, error });
            }
          );
          return promise;
        },
        useMutationState() {
          const [state, setState] = React.useState<
            MutationState<Variables, Data>
          >({ type: "idle" });
          const mutate = React.useCallback(
            (
              variables: Variables,
              options?: Partial<MutateOptions<Variables, Data>>
            ): Promise<Data> => {
              const promise = mutation.mutate(variables, options);
              setState({ type: "pending", variables, promise });
              promise.then(
                (data) => {
                  setState((state) => {
                    if (state.type === "pending" && promise === state.promise) {
                      return { type: "resolved", variables, data };
                    } else {
                      return state;
                    }
                  });
                },
                (error) => {
                  setState((state) => {
                    if (state.type === "pending" && promise === state.promise) {
                      return { type: "rejected", variables, error };
                    } else {
                      return state;
                    }
                  });
                }
              );
              return promise;
            },
            []
          );
          return {
            isLoading: state.type === "pending",
            variables: state.type !== "idle" ? state.variables : null,
            data: state.type === "resolved" ? state.data : undefined,
            error: state.type === "rejected" ? state.error : undefined,
            mutate,
          };
        },
      };
      return mutation;
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
