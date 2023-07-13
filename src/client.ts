import React from "react";

type QueryDefinition<Variables, Data> = {
  resolve(variables: Variables): Promise<Data>;
};

type MutationDefinition<Variables, Data> = {
  perform(variables: Variables): Promise<Data>;
  onSuccess?(args: { variables: Variables; data: Data }): Promise<void>;
  onError?(args: { variables: Variables; error: unknown }): Promise<void>;
};

type RecursiveOptional<T> = {
  [K in keyof T]?: T[K] extends Array<any>
    ? RecursiveOptional<T[K]>
    : T[K] extends Record<string, any>
    ? RecursiveOptional<T[K]>
    : T[K];
};

type Client<
  Queries extends Record<string, QueryDefinition<any, any>>,
  Mutations extends Record<string, MutationDefinition<any, any>>
> = {
  queries: Queries;
  invalidate<Q extends keyof Queries>(
    cacheKey: RecursiveOptional<[Q, ...Parameters<Queries[Q]["resolve"]>]>
  ): void;
  mutations: Mutations;
  mutate<M extends keyof Mutations>({}: {
    variables: [M, ...Parameters<Mutations[M]["perform"]>];
  }): void;
};

type QueriesOf<C extends Client<any, any>> = C extends Client<
  infer Queries,
  any
>
  ? Queries
  : never;

type MutationsOf<C extends Client<any, any>> = C extends Client<
  any,
  infer Mutations
>
  ? Mutations
  : never;

export function createClient<
  Queries extends Record<string, QueryDefinition<any, any>>,
  Mutations extends Record<string, MutationDefinition<any, any>>
>({}: { queries: Queries; mutations: Mutations }): Client<Queries, Mutations> {
  // TODO implement caching store here
  return null as any;
}

type Query<Variables, Data> = {
  current: QueryStatus<Variables, Data>;
  previous?: QueryStatus<Variables, Data>;
};

type QueryStatus<Variables, Data> = {
  variables: Variables;
} & ({ isLoading: true; data: undefined } | { isLoading: false; data: Data });

export function useQuery<
  C extends Client<any, any>,
  Q extends keyof QueriesOf<C>
>({}: {
  client: C;
  variables: [Q, ...Parameters<QueriesOf<C>[Q]["resolve"]>];
}): Query<
  [Q, ...Parameters<QueriesOf<C>[Q]["resolve"]>],
  Awaited<ReturnType<QueriesOf<C>[Q]["resolve"]>>
> {
  // TODO implement subscription to client
  return null as any;
}

type Mutation<Variables, Data> = {
  pending: Array<MutationStatus<Variables, Data>>;
};

type MutationStatus<Variables, Data> = {
  variables: Variables;
} & ({ isLoading: true; data: undefined } | { isLoading: false; data: Data });

export function useMutation<
  C extends Client<any, any>,
  M extends keyof MutationsOf<C>
>({}: {
  client: C;
  variables: [M, ...Parameters<MutationsOf<C>[M]["perform"]>] | undefined;
}): Mutation<
  [M, ...Parameters<MutationsOf<C>[M]["perform"]>],
  Awaited<ReturnType<MutationsOf<C>[M]["perform"]>>
> {
  // TODO implement subscription to client
  return null as any;
}
