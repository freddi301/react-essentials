import React from "react";

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

type RouteDefinition<
  Path extends string,
  Search extends Record<string, any>,
  Children extends Array<RouteDefinition<any, any, any>> | undefined
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
  } & (ParamsFromPathRecursive<"", P> extends ""
    ? { params?: ParamsFromPath<P> }
    : { params: ParamsFromPath<P> })): React.ReactElement;
  Router: React.ComponentType<{}>;
} {
  let current: { path?: string } = {};
  const listeners = new Set<() => void>();
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    console.log("LISTNERE ADDED", listener);
    return () => {
      listeners.delete(listener);
    };
  };
  const getSnapshot = () => {
    console.log("GET SNAPCHOT", current.path);
    return current.path;
  };
  return {
    navigate({ path, params = {} }) {
      console.log("NAVIGATE", current.path);
      current.path = rebuildPath(path, params);
      listeners.forEach((listener) => listener());
    },
    Link({ path, params = {}, children }) {
      const href = rebuildPath(path, params);
      return (
        <a
          href={href}
          onClick={(event) => {
            event.preventDefault();
            console.log("LINK NAVIGATE", current.path);
            current.path = rebuildPath(path, params);
            listeners.forEach((listener) => listener());
          }}
        >
          {children}
        </a>
      );
    },
    Router({}) {
      const current = React.useSyncExternalStore(subscribe, getSnapshot);
      console.log("CURRENT", current);
      if (current === undefined) return null;
      return renderRoute(root, current);
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
      params[pathDefinitionPart.slice(1)] = pathPart;
    } else if (pathDefinitionPart !== pathPart) {
      return null;
    }
  }
  return {
    params,
    remainingPath: pathParts.slice(pathDefinitionParts.length).join("/"),
  };
}

function rebuildPath(pathDefinition: string, params: Record<string, string>) {
  return pathDefinition
    .split("/")
    .map((part) => {
      if (part.startsWith("$")) {
        return params[part.slice(1)];
      } else {
        return part;
      }
    })
    .join("/");
}

function renderRoute(route: RouteDefinition<any, any, any>, path: string) {
  const match = matchPath(route.path, path);
  if (!match) return null;
  const children =
    route.children?.map((child: any) => (
      <React.Fragment key={child.path}>
        {renderRoute(child, match.remainingPath)}
      </React.Fragment>
    )) ?? null;
  if (!route.render) return children;
  return route.render({ params: match.params, children, search: null as any });
}
