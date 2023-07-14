import React, { startTransition } from "react";

type ParamsFromPathRecursive<
  Params,
  Path extends string
> = Path extends `$${infer Field}/${infer Rest}`
  ? ParamsFromPathRecursive<Params | Field, Rest>
  : Path extends `$${infer Field}`
  ? Params | Field
  : /* eslint-disable */
  Path extends `${infer Part}/${infer Rest}`
  ? ParamsFromPathRecursive<Params, Rest>
  : Params;

type ParamsFromPath<Path extends string> = ParamsFromPathRecursive<
  "",
  Path
> extends ""
  ? {}
  : Record<Exclude<ParamsFromPathRecursive<"", Path>, "">, string>;

type RouteDefinition<
  Path extends string,
  Search extends Record<string, any>,
  Children extends Array<RouteDefinition<any, any, any>> | undefined
> = {
  path: Path;
  search?(_: {
    params: ParamsFromPath<Path>;
    urlSearchParams: URLSearchParams;
  }): Search;
  validate?(_: { params: ParamsFromPath<Path>; search: Search }): boolean;
  render?(_: {
    params: ParamsFromPath<Path>;
    search: Search;
    children: React.ReactNode;
  }): React.ReactNode;
  /** this can't be optional due to typescript limitations */
  children(parent: { path: Path; params: ParamsFromPath<Path> }): Children;
};

export function route<
  const Path extends string,
  Search extends Record<string, any>,
  Children extends Array<RouteDefinition<any, any, any>> | undefined
>(
  props: RouteDefinition<Path, Search, Children>
): RouteDefinition<Path, Search, Children> {
  return props;
}

type PathsOf<Route> = Route extends RouteDefinition<
  infer Path,
  /* eslint-disable */
  infer Search,
  infer Children
>
  ? Path | `${Path}/${PathsOf<Children[keyof Children]>}`
  : never;

type Router<
  Path extends string,
  Search extends Record<string, any>,
  Children extends Array<RouteDefinition<any, any, any>> | undefined
> = {
  useRouter(): {
    navigate<P extends PathsOf<RouteDefinition<Path, Search, Children>>>({
      path,
    }: {
      path: P;
      search?: any; // TODO
    } & (ParamsFromPathRecursive<"", P> extends ""
      ? { params?: ParamsFromPath<P> }
      : { params: ParamsFromPath<P> })): void;
  };
  useRouterState(): {
    current: string;
    isPending: boolean;
  };
  /** By default wraps children in <a href=""/> */
  Link<P extends PathsOf<RouteDefinition<Path, Search, Children>>>({
    path,
    params,
    children,
  }: {
    path: P;
    children: React.ReactNode;
    /** oveeride default rendering */
    render?(_: {
      path: P;
      params: ParamsFromPath<P>;
      children: React.ReactNode;
      /** true is current route matches */
      isActive: boolean;
      href: string;
      navigate(): void;
    }): React.ReactNode;
    search?: any; // TODO
  } & (ParamsFromPathRecursive<"", P> extends ""
    ? { params?: ParamsFromPath<P> }
    : { params: ParamsFromPath<P> })): React.ReactElement;
  MatchRoute<P extends PathsOf<RouteDefinition<Path, Search, Children>>>({
    path,
  }: {
    path: P;
    render?(_: {
      path: P;
      params: ParamsFromPath<P>;
      children: React.ReactNode;
    }): React.ReactNode;
    children?: React.ReactNode;
  }): React.ReactNode;
  Router: React.ComponentType<{}>;
};

export function createRouter<
  const Path extends string,
  Search extends Record<string, any>,
  Children extends Array<RouteDefinition<any, any, any>> | undefined
>(
  root: RouteDefinition<Path, Search, Children>
): Router<Path, Search, Children> {
  const RouterChangingContext = React.createContext<{
    current: string;
    isPending: boolean;
  }>(null as any);
  const RouterStaticContext = React.createContext<{
    setCurrent(path: string): void;
    startTransition(callback: () => void): void;
  }>(null as any);
  const router: Router<Path, Search, Children> = {
    /** this hook never triggers rerender */
    useRouter() {
      const { setCurrent } = React.useContext(RouterStaticContext);
      return {
        navigate: React.useCallback(({ path, params = {}, search = {} }) => {
          startTransition(() => {
            setCurrent(rebuildPath(path, params, search));
          });
        }, []),
      };
    },
    /** this hook trigger rerender when route updates */
    useRouterState() {
      const { current, isPending } = React.useContext(RouterChangingContext);
      return {
        current,
        isPending,
      };
    },
    Link({ path, params = {}, search = {}, children, render }) {
      const { current } = router.useRouterState();
      const { navigate } = router.useRouter();
      const href = rebuildPath(path, params, search);
      if (render) {
        return React.createElement(render, {
          path,
          params: params as any,
          children,
          isActive: href === current,
          href,
          navigate() {
            navigate({ path, params, search } as any);
          },
        });
      }
      return (
        <a
          href={href}
          onClick={(event) => {
            event.preventDefault();
            navigate({ path, params, search } as any);
          }}
        >
          {children}
        </a>
      );
    },
    MatchRoute({ path, render, children }) {
      const { current } = router.useRouterState();
      // TODO actually use route definitions (aslo to supply search params)
      const match = matchPath(path, current);
      if (!match) return null;
      if (!render) return children;
      return React.createElement(render, {
        path,
        params: match.params as any,
        children,
      });
    },
    Router() {
      const [current, setCurrent] = React.useState<string>("");
      const [isPending, startTransition] = React.useTransition();
      const [path, search = ""] = current.split("?");
      const staticContext = React.useMemo(() => {
        return {
          setCurrent,
          startTransition,
        };
      }, []);
      const changingContext = React.useMemo(() => {
        return {
          current,
          isPending,
        };
      }, [current, isPending]);
      return (
        <RouterStaticContext.Provider value={staticContext}>
          <RouterChangingContext.Provider value={changingContext}>
            {renderRoute({
              route: root,
              path,
              urlSearchParams: new URLSearchParams(search),
            })}
          </RouterChangingContext.Provider>{" "}
        </RouterStaticContext.Provider>
      );
    },
  };
  return router;
}

function matchPath(pathDefinition: string, path: string) {
  const pathDefinitionParts = pathDefinition.split("/");
  const pathParts = path.split("/");
  const params: Record<string, string> = {};
  for (let i = 0; i < pathDefinitionParts.length; i++) {
    const pathDefinitionPart = pathDefinitionParts[i];
    const pathPart = pathParts[i];
    if (pathDefinitionPart.startsWith("$")) {
      params[pathDefinitionPart.slice(1)] = decodeURIComponent(pathPart);
    } else if (pathDefinitionPart !== pathPart) {
      return null;
    }
  }
  return {
    params,
    remainingPath: pathParts.slice(pathDefinitionParts.length).join("/"),
  };
}

function rebuildPath(
  pathDefinition: string,
  params: Record<string, string>,
  search: Record<string, string>
) {
  let path = pathDefinition
    .split("/")
    .map((part) => {
      if (part.startsWith("$")) {
        return encodeURIComponent(params[part.slice(1)]);
      } else {
        return part;
      }
    })
    .join("/");
  if (Object.keys(search).length > 0) {
    path += "?" + new URLSearchParams(search).toString();
  }
  return path;
}

// TODO prevent unnecessary rerenders
function renderRoute({
  route,
  path,
  urlSearchParams,
}: {
  route: RouteDefinition<any, any, any>;
  path: string;
  urlSearchParams: URLSearchParams;
}): React.ReactNode {
  const match = matchPath(route.path, path);
  if (!match) return null;
  let children = null;
  const mostSpecific = route
    .children?.({ path: route.path, params: match.params })
    ?.sort(
      (
        a: RouteDefinition<any, any, any>,
        b: RouteDefinition<any, any, any>
      ) => {
        const aParts = a.path.split("/");
        const bParts = b.path.split("/");
        return bParts.length - aParts.length;
      }
    );
  if (mostSpecific) {
    for (const child of mostSpecific) {
      children = renderRoute({
        route: child,
        path: match.remainingPath,
        urlSearchParams,
      });
      if (children) break;
    }
  }
  if (!route.render) return children;
  return React.createElement(route.render, {
    params: match.params,
    children,
    search:
      route.search?.({
        params: match.params,
        urlSearchParams,
      }) ?? {},
  });
}
