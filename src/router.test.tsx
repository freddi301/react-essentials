/**
 * @jest-environment jsdom
 */
import React from "react";
import { act, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";

import { createRouter, route } from "./router";

test("router typing", () => {
  // const router = (
  //   <Route path="company/$companyId">
  //     <Route
  //       path="user/$userId"
  //       render={({ params: { userId } }) => (
  //         <div>
  //           <div>User {userId}</div>
  //         </div>
  //       )}
  //     >
  //       {[]}
  //     </Route>
  //     <Route path="user/$userId/post">{[]}</Route>
  //     <Route
  //       path="user/$userId/post/$postId"
  //       render={({ children, params: { userId, postId } }) => (
  //         <div>
  //           <div>User {userId}</div>
  //           <div>Post {postId}</div>
  //           {children}
  //         </div>
  //       )}
  //     >
  //       <Route path="comments">{[]}</Route>
  //       <Route
  //         path="comments/$commentId"
  //         search={({ params, urlSearchParams }) => {
  //           return { search: urlSearchParams.get("search") ?? undefined };
  //         }}
  //       >
  //         {[]}
  //       </Route>
  //     </Route>
  //   </Route>
  // );

  const router = createRouter({
    path: "company/$companyId",
    children: (parent) => [
      route({
        path: "user/$userId",
        render({ params: { userId } }) {
          return (
            <div>
              <div>User {userId}</div>
            </div>
          );
        },
        children: (parent) => undefined,
      }),
      route({
        path: "user/$userId/post",
        children: (parent) => undefined,
      }),
      route({
        path: "user/$userId/post/$postId",
        render({ children, params: { userId, postId } }) {
          return (
            <div>
              <div>User {userId}</div>
              <div>Post {postId}</div>
              {children}
            </div>
          );
        },
        children: (parent) => [
          route({
            path: "comments",
            children: (parent) => undefined,
          }),
          route({
            path: "comments/$commentId",
            search({ params, urlSearchParams }) {
              return { search: urlSearchParams.get("search") ?? undefined };
            },
            children: (parent) => undefined,
          }),
        ],
      }),
    ],
  });

  router.navigate({
    path: "company/$companyId",
    params: { companyId: "1" },
  });
  router.navigate({
    path: "company/$companyId/user/$userId",
    params: { companyId: "1", userId: "2" },
  });
  router.navigate({
    path: "company/$companyId/user/$userId/post",
    params: { companyId: "1", userId: "2" },
  });
  router.navigate({
    path: "company/$companyId/user/$userId/post/$postId",
    params: { companyId: "1", userId: "2", postId: "3" },
  });
  router.navigate({
    path: "company/$companyId/user/$userId/post/$postId/comments",
    params: { companyId: "1", userId: "2", postId: "3" },
  });
  router.navigate({
    path: "company/$companyId/user/$userId/post/$postId/comments/$commentId",
    params: { companyId: "1", userId: "2", postId: "3", commentId: "4" },
  });

  router.navigate({
    // @ts-expect-error
    path: "",
  });
  router.navigate({
    path: "company/$companyId",
    params: {
      // @ts-expect-error
      companyI: "1",
    },
  });
  router.navigate({
    path: "company/$companyId/user/$userId",
    params: {
      companyId: "1",
      // @ts-expect-error
      userI: "2",
    },
  });
  router.navigate({
    path: "company/$companyId/user/$userId/post",
    // @ts-expect-error
    params: { companyId: "1" },
  });
  router.navigate({
    path: "company/$companyId/user/$userId/post/$postId",
    params: {
      // @ts-expect-error
      companyId: 45,
      userId: "2",
      posId: "3",
    },
  });
  router.navigate({
    // @ts-expect-error
    path: "company/$companyId/user/$userId/post/$postId/comment",
    // @ts-expect-error
    params: { companyId: "1", userId: "2", postId: "3" },
  });
  router.navigate({
    // @ts-expect-error
    path: "company/$companyd/user/$userId/post/$postId/comments/$commentId",
    params: {
      // @ts-expect-error
      companyd: "1",
      userId: "2",
      postId: "3",
      commentId: "4",
    },
  });
});

test("router renders root route", () => {
  const router = createRouter({
    path: "",
    render({ children }) {
      return (
        <div>
          <div>Heading</div>
          {children}
        </div>
      );
    },
    children: (parent) => undefined,
  });
  const { container } = render(<router.Router />);
  expect(container).toHaveTextContent("");
  act(() => {
    router.navigate({ path: "" });
  });
  expect(screen.getByText(/Heading/)).toBeInTheDocument();
});

test("router switches between two routes", async () => {
  const { Router, navigate } = createRouter({
    path: "",
    render({ children }) {
      return (
        <div>
          <div>Heading</div>
          {children}
        </div>
      );
    },
    children: (parent) => [
      route({
        path: "a",
        render({ children }) {
          return <div>RouteA</div>;
        },
        children: (parent) => undefined,
      }),
      route({
        path: "b",
        render({ children }) {
          return <div>RouteB</div>;
        },
        children: (parent) => undefined,
      }),
    ],
  });
  render(<Router />);
  act(() => {
    navigate({ path: "", params: {} });
  });
  expect(screen.getByText(/Heading/)).toBeInTheDocument();
  act(() => {
    navigate({ path: "/a", params: {} });
  });
  expect(screen.getByText(/Heading/)).toBeInTheDocument();
  expect(screen.getByText(/RouteA/)).toBeInTheDocument();
  expect(screen.queryByText(/RouteB/)).not.toBeInTheDocument();
  act(() => {
    navigate({ path: "/b" });
  });
  expect(screen.getByText(/Heading/)).toBeInTheDocument();
  expect(screen.getByText(/RouteB/)).toBeInTheDocument();
  expect(screen.queryByText(/RouteA/)).not.toBeInTheDocument();
});

test("navigation works with clicks", async () => {
  const { Router, navigate } = createRouter({
    path: "",
    render({ children }) {
      return (
        <>
          <nav>
            <button
              onClick={() => {
                navigate({ path: "/a", params: {} });
              }}
            >
              LinkA
            </button>
            <button
              onClick={() => {
                navigate({ path: "/b" });
              }}
            >
              LinkB
            </button>
          </nav>
          {children}
        </>
      );
    },
    children: (parent) => [
      route({
        path: "a",
        render({ children }) {
          return <div>RouteA</div>;
        },
        children: (parent) => undefined,
      }),
      route({
        path: "b",
        render({ children }) {
          return <div>RouteB</div>;
        },
        children: (parent) => undefined,
      }),
    ],
  });
  render(<Router />);
  act(() => navigate({ path: "", params: {} }));
  userEvent.click(screen.getByText(/LinkA/));
  expect(await screen.findByText(/RouteA/)).toBeInTheDocument();
  expect(screen.queryByText(/RouteB/)).not.toBeInTheDocument();
  userEvent.click(screen.getByText(/LinkB/));
  expect(await screen.findByText(/RouteB/)).toBeInTheDocument();
  expect(screen.queryByText(/RouteA/)).not.toBeInTheDocument();
});

test("navigation works with links", async () => {
  const { Link, Router, navigate } = createRouter({
    path: "",
    render({ children }) {
      return (
        <>
          <nav>
            <Link path="/a" params={{}}>
              LinkA
            </Link>
            <Link path="/b">LinkB</Link>
          </nav>
          {children}
        </>
      );
    },
    children: (parent) => [
      route({
        path: "a",
        render({ children }) {
          return <div>RouteA</div>;
        },
        children: (parent) => undefined,
      }),
      route({
        path: "b",
        render({ children }) {
          return <div>RouteB</div>;
        },
        children: (parent) => undefined,
      }),
    ],
  });
  render(<Router />);
  act(() => navigate({ path: "", params: {} }));
  userEvent.click(screen.getByText(/LinkA/));
  expect(await screen.findByText(/RouteA/)).toBeInTheDocument();
  expect(screen.queryByText(/RouteB/)).not.toBeInTheDocument();
  userEvent.click(screen.getByText(/LinkB/));
  expect(await screen.findByText(/RouteB/)).toBeInTheDocument();
  expect(screen.queryByText(/RouteA/)).not.toBeInTheDocument();
});

test("more specific routes take precedence", async () => {
  const { Router, navigate } = createRouter({
    path: "",
    children: (parent) => [
      route({
        path: "a",
        render({ children }) {
          return <div>RouteA</div>;
        },
        children: (parent) => undefined,
      }),
      route({
        path: "a/b",
        render({ children }) {
          return <div>RouteSpecific</div>;
        },
        children: (parent) => undefined,
      }),
    ],
  });
  render(<Router />);
  act(() => navigate({ path: "/a" }));
  expect(await screen.findByText(/RouteA/)).toBeInTheDocument();
  expect(screen.queryByText(/RouteSpecific/)).not.toBeInTheDocument();
  act(() => navigate({ path: "/a/b" }));
  expect(await screen.findByText(/RouteSpecific/)).toBeInTheDocument();
  expect(screen.queryByText(/RouteA/)).not.toBeInTheDocument();
});

test("render method gets path params", () => {
  const { Router, navigate } = createRouter({
    path: "",
    children: (parent) => [
      route({
        path: "a/$id",
        render({ children, params }) {
          return <div>RouteA {params.id}</div>;
        },
        children: (parent) => undefined,
      }),
    ],
  });
  render(<Router />);
  act(() =>
    navigate({ path: "/a/$id", params: { id: "complex/id with special $%?" } })
  );
  expect(
    screen.getByText(/RouteA complex\/id with special \$%\?/)
  ).toBeInTheDocument();
});

test("render method gets search params", () => {
  const { Router, navigate } = createRouter({
    path: "",
    children: (parent) => [
      route({
        path: "a/$id",
        search({ params, urlSearchParams }) {
          return {
            id: (urlSearchParams.get("searchParam") ?? "") + params.id,
          };
        },
        render({ children, params, search }) {
          return <div>RouteA {search.id}</div>;
        },
        children: (parent) => undefined,
      }),
    ],
  });
  render(<Router />);
  act(() =>
    navigate({
      path: "/a/$id",
      params: { id: "42" },
      search: { searchParam: "666" },
    })
  );
  expect(screen.getByText(/RouteA 66642/)).toBeInTheDocument();
});

test("child routes get parent path params", () => {
  const { Router, navigate } = createRouter({
    path: "",
    children: (parent) => [
      route({
        path: "parent/$parentPathParam",
        render({ children, params }) {
          return (
            <div>
              <div>Parent {params.parentPathParam}</div>
              {children}
            </div>
          );
        },
        children: (parent) => [
          route({
            path: "child/$childPathParam",
            render({ children, params }) {
              return (
                <div>
                  Child {params.childPathParam} {parent.params.parentPathParam}
                </div>
              );
            },
            children: (parent) => undefined,
          }),
        ],
      }),
    ],
  });
  render(<Router />);
  act(() =>
    navigate({
      path: "/parent/$parentPathParam/child/$childPathParam",
      params: { parentPathParam: "PPP", childPathParam: "CCC" },
    })
  );
  expect(screen.getByText(/Parent/)).toHaveTextContent("Parent PPP");
  expect(screen.getByText(/Child/)).toHaveTextContent("Child CCC PPP");
});
