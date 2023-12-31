import React from "react";

// TODO: see index_todo file
// TODO: reneable suspense
// TODO: check online status (https://tanstack.com/query/latest/docs/react/guides/network-mode)
// TODO: useQueryStates (for a list of queries)
// TODO: useMutationStates (for a list of mutations)
// TODO: suspend (throw promise) on useMutationState

type QueryOptions = {
  revalidateOnFocus: boolean;
  revalidateOnConnect: boolean;
  //   /** 0 to disable */
  revalidateAfterMs: number;
};
type QueryHookOptions = {
  revalidateOnMount: boolean;
  /** true = catches error and returns it; false = lets error bubble up */
  handleError: boolean;
};
const defaultQueryOptions: QueryOptions = {
  revalidateOnFocus: true,
  revalidateOnConnect: true,
  revalidateAfterMs: 5 * 60 * 1000,
};
const defaultQueryHookOptions: QueryHookOptions = {
  revalidateOnMount: true,
  handleError: true,
};

export function createClient(clientOptions?: {
  queryOptions?: Partial<QueryOptions>;
  queryHookOptions?: Partial<QueryHookOptions>;
}) {
  function createQuery<Variables, Data>(
    resolver: (variables: Variables) => Promise<Data>,
    queryOptions?: Partial<QueryOptions>
  ) {
    const { revalidateOnFocus, revalidateOnConnect, revalidateAfterMs } = {
      ...defaultQueryOptions,
      ...clientOptions?.queryOptions,
      ...queryOptions,
    };

    const cache = new Map<Variables, Entry>();

    type Entry = {
      nextResolutionId: number;
      expectedResolutionId: number;
      resolutions: Record<number, Resolution>;
      subscriptions: Set<Subscription>;
      cachedData: Data | undefined;
    };
    type Resolution =
      | {
          type: "pending";
          promise: Promise<Data>;
          startTimestamp: number;
        }
      | {
          type: "resolved";
          data: Data;
          startTimestamp: number;
          endTimestamp: number;
        }
      | {
          type: "rejected";
          error: unknown;
          startTimestamp: number;
          endTimestamp: number;
        };
    type Subscription = { listener: Listener };
    type Listener = () => void;

    function getEntry(variables: Variables): Entry {
      for (const [cachedVariables, entry] of cache.entries()) {
        if (isDeepEqual(cachedVariables, variables)) {
          return entry;
        }
      }
      const entry: Entry = {
        nextResolutionId: 0,
        expectedResolutionId: 0,
        resolutions: {},
        subscriptions: new Set(),
        cachedData: undefined,
      };
      cache.set(variables, entry);
      return entry;
    }

    function subscribe(variables: Variables, listener: Listener) {
      const subscription: Subscription = { listener };
      const entry = getEntry(variables);
      entry.subscriptions.add(subscription);
      const state = getState(variables);
      if (!state.isValid) {
        resolve(variables);
      }
      return () => {
        entry.subscriptions.delete(subscription);
      };
    }

    function notify(entry: Entry) {
      for (const subscription of entry.subscriptions) {
        subscription.listener();
      }
    }

    function resolve(variables: Variables) {
      const promise = resolver(variables);
      const entry = getEntry(variables);
      const resolutionId = entry.nextResolutionId++;
      const startTimestamp = Date.now();
      entry.resolutions[resolutionId] = {
        type: "pending",
        promise,
        startTimestamp,
      };
      promise.then(
        (data) => {
          entry.resolutions[resolutionId] = {
            type: "resolved",
            data,
            startTimestamp,
            endTimestamp: Date.now(),
          };
          garbageCollectResolutions(entry);
          notify(entry);
        },
        (error) => {
          entry.resolutions[resolutionId] = {
            type: "rejected",
            error,
            startTimestamp,
            endTimestamp: Date.now(),
          };
          garbageCollectResolutions(entry);
          notify(entry);
        }
      );
      garbageCollectResolutions(entry);
      notify(entry);
      return promise;
    }

    function invalidate(criteria: (variables: Variables) => boolean) {
      for (const [variables, entry] of cache.entries()) {
        if (criteria(variables)) {
          entry.expectedResolutionId = entry.nextResolutionId;
          if (entry.subscriptions.size > 0) {
            resolve(variables);
            notify(entry);
          }
        }
      }
    }

    function invalidateAll() {
      invalidate(() => true);
    }
    function invalidateExact(variables: Variables) {
      invalidate((other) => isDeepEqual(variables, other));
    }
    type RecursivelyPartial<T> = { [K in keyof T]?: RecursivelyPartial<T[K]> };
    function invalidatePartial(variables: RecursivelyPartial<Variables>) {
      invalidate((other) => isPartialDeepEqual(variables, other));
    }

    if (revalidateOnFocus) {
      window.addEventListener("focus", invalidateAll);
    }
    if (revalidateOnConnect) {
      window.addEventListener("online", invalidateAll);
    }

    function garbageCollectResolutions(entry: Entry) {
      const resolutions = getSortedResolutions(entry);
      let startDeleting = false;
      for (let i = 0; i < resolutions.length; i++) {
        const resolution = resolutions[i]!;
        if (startDeleting) delete entry.resolutions[Number(resolution.id)];
        if (resolution.type !== "pending") startDeleting = true;
      }
    }

    function getSortedResolutions(entry: Entry) {
      return Object.entries(entry.resolutions)
        .map(([resolutionId, resolution]) => ({
          id: resolutionId,
          ...resolution,
        }))
        .sort((a, b) => Number(b.id) - Number(a.id));
    }

    function getState(variables: Variables) {
      const entry = getEntry(variables);
      const resolutions = getSortedResolutions(entry);
      const latestResolution = resolutions[0];
      const isLoading = latestResolution?.type === "pending";
      const promise =
        latestResolution?.type === "pending"
          ? latestResolution.promise
          : undefined;
      const latestSettledResolution = resolutions.find(
        (resolution) => resolution.type !== "pending"
      );
      const data = (entry.cachedData = reuseInstances(
        entry.cachedData,
        latestSettledResolution?.type === "resolved"
          ? latestSettledResolution.data
          : undefined
      ) as Data | undefined);
      const error =
        latestSettledResolution?.type === "rejected"
          ? latestSettledResolution.error
          : undefined;
      const isFresh =
        revalidateAfterMs > 0 &&
        latestSettledResolution &&
        latestSettledResolution?.type !== "pending"
          ? Date.now() - latestSettledResolution.endTimestamp <
            revalidateAfterMs
          : true;
      const isValid =
        Number(latestResolution?.id) >= entry.expectedResolutionId && isFresh;
      return {
        isValid,
        isLoading,
        promise,
        data,
        error,
      };
    }

    function read(variables: Variables) {
      const state = getState(variables);
      if (!state.isValid) throw resolve(variables);
      if (state.isLoading) throw state.promise;
      if (state.error) throw state.error;
      if (state.data) return state.data;
      throw resolve(variables);
    }

    type QueryHookState = {
      isValid: boolean;
      isLoading: boolean;
      data: Data | undefined;
      error: unknown;
    };
    const disabledQueryHookState: QueryHookState = {
      isValid: false,
      isLoading: false,
      data: undefined,
      error: undefined,
    };

    function useQueryState(
      variables: Variables | null,
      hookOptions?: Partial<QueryHookOptions>
    ) {
      const { revalidateOnMount, handleError } = {
        ...defaultQueryHookOptions,
        ...clientOptions?.queryHookOptions,
        ...hookOptions,
      };
      const variablesRef = React.useRef(variables);
      if (!isDeepEqual(variables, variablesRef.current)) {
        variablesRef.current = variables;
      }
      const currentVariables = variablesRef.current;
      const [hookState, setHookState] = React.useState<QueryHookState>(
        disabledQueryHookState
      );
      React.useEffect(() => {
        if (currentVariables !== null && revalidateOnMount) {
          invalidateExact(currentVariables);
        }
        const doIt = () => {
          if (currentVariables === null) {
            setHookState(disabledQueryHookState);
          } else {
            const queryState = getState(currentVariables);
            setHookState((hookState): QueryHookState => {
              const newHookState: QueryHookState = {
                isValid: queryState.isValid,
                isLoading: queryState.isLoading,
                data: queryState.data,
                error: queryState.error,
              };
              return reuseInstances(hookState, newHookState) as QueryHookState;
            });
          }
        };
        doIt();
        if (currentVariables !== null) {
          return subscribe(currentVariables, doIt);
        }
      }, [currentVariables, revalidateOnMount]);
      const lastDataRef = React.useRef(hookState.data);
      lastDataRef.current = reuseInstances(
        lastDataRef.current,
        hookState.data
      ) as Data | undefined;
      if (!handleError && hookState.error) {
        throw hookState.error;
      }
      return { ...hookState, data: lastDataRef.current };
    }

    return {
      resolver,
      resolve,
      invalidate,
      invalidateAll,
      invalidateExact,
      invalidatePartial,
      subscribe,
      getState,
      read,
      useQueryState,
    };
  }

  function createMutation<Variables, Data>(
    performer: (variables: Variables) => Promise<Data>,
    mutationOptions?: {
      onSuccess?(_: { variables: Variables; data: Data }): void;
      onError?(_: { variables: Variables; error: unknown }): void;
    }
  ) {
    function mutate(
      variables: Variables,
      mutateOptions?: {
        onSuccess?(_: { variables: Variables; data: Data }): void;
        onError?(_: { variables: Variables; error: unknown }): void;
      }
    ) {
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
    }

    function useMutationState() {
      type MutationHookState =
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
      const [state, setState] = React.useState<MutationHookState>({
        type: "idle",
      });
      const hookMutate = React.useCallback(
        (
          variables: Variables,
          mutateOptions?: {
            onSuccess?(_: { variables: Variables; data: Data }): void;
            onError?(_: { variables: Variables; error: unknown }): void;
          }
        ): Promise<Data> => {
          const promise = mutate(variables, mutateOptions);
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
        mutate: hookMutate,
      };
    }
    return {
      mutate,
      useMutationState,
    };
  }

  return {
    createQuery,
    createMutation,
  };
}

function isDeepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a instanceof Array && b instanceof Array) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!isDeepEqual(a[i], b[i])) return false;
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
      if (!isDeepEqual((a as any)[key], (b as any)[key])) return false;
    }
    return true;
  }
  return false;
}

function isPartialDeepEqual(a: unknown, b: unknown) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a instanceof Array && b instanceof Array) {
    for (let i = 0; i < a.length; i++) {
      if (!isPartialDeepEqual(a[i], b[i])) return false;
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
      if (!isPartialDeepEqual((a as any)[key], (b as any)[key])) return false;
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
