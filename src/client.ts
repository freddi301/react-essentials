import React from "react";

// TODO apply @tanstack/react-query cache invalidation (see page docs)
// TODO retry queries on error (see @tanstack/react-query)
// TODO let user track mutations

type Resource<Variables, Data> = {
  read(variables: Variables): Data;
  invalidate(criteria: (variables: Variables) => boolean): void;
  invalidateAll(): void;
  invalidateExact(variables: Variables): void;
  invalidatePartial(variables: RecursivelyPartial<Variables>): void;
  subscribe(variables: Variables, listener: Listener): Unsubscribe;
  useData(variables: Variables): Data;
};

type Listener = () => void;
type Unsubscribe = () => void;

export function createResource<Variables, Data>(
  resolver: (variables: Variables) => Promise<Data>
): Resource<Variables, Data> {
  type Entry = { data: Data } | { promise: Promise<Data> };
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
  return {
    read(variables) {
      const found = findEntry(variables);
      if (!found) {
        const promise = resolver(variables);
        cache.set(variables, { promise });
        promise.then((data) => {
          cache.set(variables, { data });
        });
        throw promise;
      } else {
        if ("data" in found.entry) return found.entry.data;
        else throw found.entry.promise;
      }
    },
    invalidate(criteria) {
      for (const variables of cache.keys()) {
        if (criteria(variables)) {
          cache.delete(variables);
          subscriptions.forEach((subscription) => {
            if (deepIsEqual(subscription.variables, variables)) {
              subscription.listener();
            }
          });
        }
      }
    },
    invalidateAll() {
      this.invalidate(() => true);
    },
    invalidateExact(variables) {
      this.invalidate((other) => deepIsEqual(variables, other));
    },
    invalidatePartial(variables) {
      this.invalidate((other) => partialDeepEqual(variables, other));
    },
    subscribe(variables, listener) {
      const subscription = { variables, listener };
      subscriptions.add(subscription);
      return () => subscriptions.delete(subscription);
    },
    useData(variables) {
      const [, forceUpdate] = React.useState(0);
      React.useEffect(
        () =>
          this.subscribe(variables, () => forceUpdate((count) => count + 1)),
        [variables]
      );
      return this.read(variables);
    },
  };
}

type Mutation<Variables, Data> = {
  mutate(variables: Variables): void;
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
    mutate(variables) {
      performer(variables).then(
        (data) => {
          onSuccess?.({ variables, data });
        },
        (error) => {
          onError?.({ variables, error });
        }
      );
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
