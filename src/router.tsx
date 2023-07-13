import React from "react";

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
  children: Children | undefined;
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
  navigate<P extends PathsOf<RouteDefinition<Path, Search, Children>>>({
    path,
  }: {
    path: P;
    search?: any; // TODO
  } & (ParamsFromPathRecursive<"", P> extends ""
    ? { params?: ParamsFromPath<P> }
    : { params: ParamsFromPath<P> })): void;
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
  let current: { path?: string } = {};
  const listeners = new Set<() => void>();
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  const getSnapshot = () => {
    return current.path;
  };
  return {
    navigate({ path, params = {}, search = {} }) {
      current.path = rebuildPath(path, params, search);
      listeners.forEach((listener) => listener());
    },
    Link({ path, params = {}, search = {}, children }) {
      const href = rebuildPath(path, params, search);
      return (
        <a
          href={href}
          onClick={(event) => {
            event.preventDefault();
            current.path = href;
            listeners.forEach((listener) => listener());
          }}
        >
          {children}
        </a>
      );
    },
    Router() {
      const current = React.useSyncExternalStore(subscribe, getSnapshot);
      if (current === undefined) return null;
      const [path, search = ""] = current.split("?");
      return renderRoute(
        root,
        path,
        new URLSearchParams(search)
      ) as JSX.Element;
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

function renderRoute(
  route: RouteDefinition<any, any, any>,
  path: string,
  urlSearchParams: URLSearchParams
): React.ReactNode {
  const match = matchPath(route.path, path);
  if (!match) return null;
  let children = null;
  if (route.children) {
    const mostSpecific = [...route.children].sort((a, b) => {
      const aParts = a.path.split("/");
      const bParts = b.path.split("/");
      return bParts.length - aParts.length;
    });
    for (const child of mostSpecific) {
      children = renderRoute(child, match.remainingPath, urlSearchParams);
      if (children) break;
    }
  }
  if (!route.render) return children;
  return route.render({
    params: match.params,
    children,
    search:
      route.search?.({
        params: match.params,
        urlSearchParams,
      }) ?? {},
  });
}
