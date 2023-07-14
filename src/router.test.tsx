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

  const { Router, useRouter, Link } = createRouter({
    path: "company/$companyId" as const,
    children: (parent) => [
      route({
        path: "user/$userId" as const,
        Component({ params: { userId } }) {
          return (
            <div>
              <div>User {userId}</div>
            </div>
          );
        },
        children: (parent) => undefined,
      }),
      route({
        path: "user/$userId/post" as const,
        children: (parent) => undefined,
      }),
      route({
        path: "user/$userId/post/$postId" as const,
        Component({ children, params: { userId, postId } }) {
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
            path: "comments" as const,
            children: (parent) => undefined,
          }),
          route({
            path: "comments/$commentId" as const,
            search({ params, urlSearchParams }) {
              return { search: urlSearchParams.get("search") ?? undefined };
            },
            children: (parent) => undefined,
          }),
        ],
      }),
    ],
  });

  function App() {
    const router = useRouter();
    React.useEffect(() => {
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
    }, []);
    return (
      <Link path="company/$companyId" params={{ companyId: "42" }}>
        Link
      </Link>
    );
  }
});

test("router renders root route", () => {
  const { Router } = createRouter({
    path: "" as const,
    Component({}) {
      return <div>Heading</div>;
    },
    children: (parent) => undefined,
  });
  render(<Router />);
  expect(screen.getByText(/Heading/)).toBeInTheDocument();
});

test("router switches between two routes", async () => {
  const { Router, Link } = createRouter({
    path: "" as const,
    Component({ children }) {
      return (
        <div>
          <div>Heading</div>
          <nav>
            <Link path="/a">LinkA</Link>
            <Link path="/b">LinkB</Link>
          </nav>
          {children}
        </div>
      );
    },
    children: (parent) => [
      route({
        path: "a" as const,
        Component({ children }) {
          return <div>RouteA</div>;
        },
        children: (parent) => undefined,
      }),
      route({
        path: "b" as const,
        Component({ children }) {
          return <div>RouteB</div>;
        },
        children: (parent) => undefined,
      }),
    ],
  });
  render(<Router />);
  expect(screen.getByText(/Heading/)).toBeInTheDocument();
  userEvent.click(screen.getByText(/LinkA/));
  expect(screen.getByText(/Heading/)).toBeInTheDocument();
  expect(await screen.findByText(/RouteA/)).toBeInTheDocument();
  expect(screen.queryByText(/RouteB/)).not.toBeInTheDocument();
  userEvent.click(screen.getByText(/LinkB/));
  expect(screen.getByText(/Heading/)).toBeInTheDocument();
  expect(await screen.findByText(/RouteB/)).toBeInTheDocument();
  expect(screen.queryByText(/RouteA/)).not.toBeInTheDocument();
});

test("navigation works with clicks", async () => {
  const { Router, useRouter } = createRouter({
    path: "" as const,
    Component({ children }) {
      const { navigate } = useRouter();
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
        path: "a" as const,
        Component({ children }) {
          return <div>RouteA</div>;
        },
        children: (parent) => undefined,
      }),
      route({
        path: "b" as const,
        Component({ children }) {
          return <div>RouteB</div>;
        },
        children: (parent) => undefined,
      }),
    ],
  });
  render(<Router />);
  userEvent.click(screen.getByText(/LinkA/));
  expect(await screen.findByText(/RouteA/)).toBeInTheDocument();
  expect(screen.queryByText(/RouteB/)).not.toBeInTheDocument();
  userEvent.click(screen.getByText(/LinkB/));
  expect(await screen.findByText(/RouteB/)).toBeInTheDocument();
  expect(screen.queryByText(/RouteA/)).not.toBeInTheDocument();
});

test("navigation works with links", async () => {
  const { Router, Link } = createRouter({
    path: "" as const,
    Component({ children }) {
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
        path: "a" as const,
        Component({ children }) {
          return <div>RouteA</div>;
        },
        children: (parent) => undefined,
      }),
      route({
        path: "b" as const,
        Component({ children }) {
          return <div>RouteB</div>;
        },
        children: (parent) => undefined,
      }),
    ],
  });
  render(<Router />);
  userEvent.click(screen.getByText(/LinkA/));
  expect(await screen.findByText(/RouteA/)).toBeInTheDocument();
  expect(screen.queryByText(/RouteB/)).not.toBeInTheDocument();
  userEvent.click(screen.getByText(/LinkB/));
  expect(await screen.findByText(/RouteB/)).toBeInTheDocument();
  expect(screen.queryByText(/RouteA/)).not.toBeInTheDocument();
});

test("more specific routes take precedence", async () => {
  const { Router, Link } = createRouter({
    path: "" as const,
    Component({ children }) {
      return (
        <div>
          <nav>
            <Link path="/a">LinkA</Link>
            <Link path="/a/b">LinkSpecific</Link>
          </nav>
          {children}
        </div>
      );
    },
    children: (parent) => [
      route({
        path: "a" as const,
        Component({ children }) {
          return <div>RouteA</div>;
        },
        children: (parent) => undefined,
      }),
      route({
        path: "a/b" as const,
        Component({ children }) {
          return <div>RouteSpecific</div>;
        },
        children: (parent) => undefined,
      }),
    ],
  });
  render(<Router />);
  userEvent.click(screen.getByText(/LinkA/));
  expect(await screen.findByText(/RouteA/)).toBeInTheDocument();
  expect(screen.queryByText(/RouteSpecific/)).not.toBeInTheDocument();
  userEvent.click(screen.getByText(/LinkSpecific/));
  expect(await screen.findByText(/RouteSpecific/)).toBeInTheDocument();
  expect(screen.queryByText(/RouteA/)).not.toBeInTheDocument();
});

test("render method gets path params", async () => {
  const { Router, Link } = createRouter({
    path: "" as const,
    Component({ children }) {
      return (
        <div>
          <Link path="/a/$id" params={{ id: "complex/id with special $%?" }}>
            Link
          </Link>
          {children}
        </div>
      );
    },
    children: (parent) => [
      route({
        path: "a/$id" as const,
        Component({ params }) {
          return <div>RouteA {params.id}</div>;
        },
        children: (parent) => undefined,
      }),
    ],
  });
  render(<Router />);
  userEvent.click(screen.getByText(/Link/));
  expect(
    await screen.findByText(/RouteA complex\/id with special \$%\?/)
  ).toBeInTheDocument();
});

test("render method gets search params", async () => {
  const { Router, Link } = createRouter({
    path: "" as const,
    Component({ children }) {
      return (
        <div>
          <Link
            path="/a/$id"
            params={{ id: "42" }}
            search={{ searchParam: "666" }}
          >
            Link
          </Link>
          {children}
        </div>
      );
    },
    children: (parent) => [
      route({
        path: "a/$id" as const,
        search({ params, urlSearchParams }) {
          return {
            id: (urlSearchParams.get("searchParam") ?? "") + params.id,
          };
        },
        Component({ children, params, search }) {
          return <div>RouteA {search.id}</div>;
        },
        children: (parent) => undefined,
      }),
    ],
  });
  render(<Router />);
  userEvent.click(screen.getByText(/Link/));
  expect(await screen.findByText(/RouteA 66642/)).toBeInTheDocument();
});

test("child routes get parent path params", async () => {
  const { Router, Link } = createRouter({
    path: "" as const,
    Component({ children }) {
      return (
        <div>
          <nav>
            <Link
              path="/parent/$parentPathParam/child/$childPathParam"
              params={{ parentPathParam: "PPP", childPathParam: "CCC" }}
            >
              Link
            </Link>
          </nav>
          {children}
        </div>
      );
    },
    children: (parent) => [
      route({
        path: "parent/$parentPathParam" as const,
        Component({ children, params }) {
          return (
            <div>
              <div>Parent {params.parentPathParam}</div>
              {children}
            </div>
          );
        },
        children: (parent) => [
          route({
            path: "child/$childPathParam" as const,
            Component({ children, params }) {
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
  userEvent.click(screen.getByText(/Link/));
  expect(await screen.findByText(/Parent/)).toHaveTextContent("Parent PPP");
  expect(screen.getByText(/Child/)).toHaveTextContent("Child CCC PPP");
});

test("active links", async () => {
  const { Router, Link } = createRouter({
    path: "" as const,
    Component({ children }) {
      return (
        <div>
          <nav>
            <Link path="/a" Component={ActiveLinkSpan}>
              LinkA
            </Link>
            <Link path="/b" Component={ActiveLinkSpan}>
              LinkB
            </Link>
          </nav>
          {children}
        </div>
      );
    },
    children: (parent) => [
      route({
        path: "a" as const,
        children: (parent) => undefined,
      }),
      route({
        path: "b" as const,
        children: (parent) => undefined,
      }),
    ],
  });
  function ActiveLinkSpan({
    isActive,
    navigate,
    children,
  }: {
    isActive: boolean;
    navigate(): void;
    children: React.ReactNode;
  }) {
    return (
      <span onClick={navigate}>
        {children} {isActive ? "Active" : "Inactive"}
      </span>
    );
  }
  render(<Router />);
  expect(screen.getByText(/LinkA/)).toHaveTextContent("LinkA Inactive");
  expect(screen.getByText(/LinkB/)).toHaveTextContent("LinkB Inactive");
  userEvent.click(screen.getByText(/LinkA/));
  expect(await screen.findByText(/LinkA Active/)).toBeInTheDocument();
  expect(screen.getByText(/LinkB/)).toHaveTextContent("LinkB Inactive");
  userEvent.click(screen.getByText(/LinkB/));
  expect(await screen.findByText(/LinkB Active/)).toBeInTheDocument();
  expect(screen.getByText(/LinkA/)).toHaveTextContent("LinkA Inactive");
});
