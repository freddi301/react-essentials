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

export function createRouter<
  const Path extends string,
  Search extends Record<string, any>,
  Children extends Array<RouteDefinition<any, any, any>> | undefined
>(
  root: RouteDefinition<Path, Search, Children>
): {
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
  Link<P extends PathsOf<RouteDefinition<Path, Search, Children>>>({
    path,
    params,
    children,
  }: {
    path: P;
    children: React.ReactNode;
    search?: any; // TODO
  } & (ParamsFromPathRecursive<"", P> extends ""
    ? { params?: ParamsFromPath<P> }
    : { params: ParamsFromPath<P> })): React.ReactElement;
  Router: React.ComponentType<{}>;
} {
  const RouterContext = React.createContext<{
    current: string;
    setCurrent(path: string): void;
    isPending: boolean;
    startTransition(callback: () => void): void;
  }>(null as any);
  return {
    useRouter() {
      const { setCurrent } = React.useContext(RouterContext);
      return {
        navigate: React.useCallback(({ path, params = {}, search = {} }) => {
          startTransition(() => {
            setCurrent(rebuildPath(path, params, search));
          });
        }, []),
      };
    },
    Link({ path, params = {}, search = {}, children }) {
      const { setCurrent } = React.useContext(RouterContext);
      const href = rebuildPath(path, params, search);
      return (
        <a
          href={href}
          onClick={(event) => {
            event.preventDefault();
            startTransition(() => {
              setCurrent(href);
            });
          }}
        >
          {children}
        </a>
      );
    },
    Router() {
      const [current, setCurrent] = React.useState<string>("");
      const [isPending, startTransition] = React.useTransition();
      const [path, search = ""] = current.split("?");
      const contextValue = React.useMemo(() => {
        return {
          current,
          setCurrent,
          isPending,
          startTransition,
        };
      }, []);
      return (
        <RouterContext.Provider value={contextValue}>
          {renderRoute({
            route: root,
            path,
            urlSearchParams: new URLSearchParams(search),
          })}
        </RouterContext.Provider>
      );
    },
  };
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
