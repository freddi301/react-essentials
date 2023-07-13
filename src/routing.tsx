type ParamsFromPathRecursive<
  Params,
  Path extends string
> = Path extends `$${infer Field}/${infer Rest}`
  ? ParamsFromPathRecursive<Params | Field, Rest>
  : Path extends `$${infer Field}`
  ? Params | Field
  : Path extends `${infer Part}/${infer Rest}`
  ? ParamsFromPathRecursive<Params, Rest>
  : Params;

type ParamsFromPath<Path extends string> = ParamsFromPathRecursive<
  "",
  Path
> extends ""
  ? {}
  : Record<Exclude<ParamsFromPathRecursive<"", Path>, "">, string>;

type Route<Path extends string, Params = undefined, Search = undefined> = {
  path: Path;
  href(params: Params, search: Search): string;
};

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

type RouteDefinition<
  Path extends string,
  Search extends Record<string, any>,
  Children extends Array<RouteDefinition<any, any, any>>
> = {
  path: Path;
  search?({}: {
    params: ParamsFromPath<Path>;
    urlSearchParams: URLSearchParams;
  }): Search;
  validate?({}: { params: ParamsFromPath<Path>; search: Search }): boolean;
  render?({}: {
    params: ParamsFromPath<Path>;
    search: Search;
    children: React.ReactNode;
  }): React.ReactNode;
  children?: Children;
};

export function route<
  const Path extends string,
  Search extends Record<string, any>,
  Children extends Array<RouteDefinition<any, any, any>>
>(route: RouteDefinition<Path, Search, Children>) {
  return route;
}

type PathsOf<Route> = Route extends RouteDefinition<
  infer Path,
  infer Search,
  infer Children
>
  ? Path | PathsOf<Children[number]>
  : never;

export function navigate<Root extends RouteDefinition<any, any, any>>(
  root: Root,
  path: PathsOf<Root>
) {}
