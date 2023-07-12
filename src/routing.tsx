type ParamsFromPath<
  Params,
  Path extends string
> = Path extends `$${infer Field}/${infer Rest}`
  ? ParamsFromPath<Params | Field, Rest>
  : Path extends `$${infer Field}`
  ? Params | Field
  : Path extends `${infer Part}/${infer Rest}`
  ? ParamsFromPath<Params, Rest>
  : Params;

type Route<Path extends string, Params = undefined, Search = undefined> = {
  path: Path;
  href(params: Params, search: Search): string;
};

export function createRoute<const Path extends string, Search = undefined>(
  path: Path,
  search?: (urlSearchParams: URLSearchParams) => Search
): Route<
  Path,
  ParamsFromPath<"", Path> extends ""
    ? undefined
    : Record<Exclude<ParamsFromPath<"", Path>, "">, string>,
  Search
> {
  // TODO: implement
  return null as any;
}

export function Link<Params = undefined, Search = undefined>({
  to,
  params,
  search,
  children,
}: {
  to: Route<any, Params, Search>;
  children: React.ReactNode;
} & (Params extends undefined ? { params?: undefined } : { params: Params }) &
  (Search extends undefined ? { search?: undefined } : { search: Search })) {
  return <a href={to.href(params!, search!)}>{children}</a>;
}

type RouteShape<
  Children extends Record<string, RouteShape<any, any, any>>,
  Params = undefined,
  Search = undefined
> = {
  search?(urlSearchParams: URLSearchParams): Search;
  render?({}: {
    params: Params;
    search: Search;
    children: React.ReactNode;
  }): React.ReactNode;
  children?: Children;
};

export function createRouter<
  Routes extends Record<string, RouteShape<any, any, any>>
>(ruotes: Routes) {}
