/**
 * @jest-environment jsdom
 */
import React from "react";
import { act, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";

import { createRouter, route } from "./routing";

function developerExperienceExample() {
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
    children: [
      route({
        path: "user/$userId",
        render({ params: { userId } }) {
          return (
            <div>
              <div>User {userId}</div>
            </div>
          );
        },
        children: [],
      }),
      route({
        path: "user/$userId/post",
        children: [],
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
        children: [
          route({
            path: "comments",
            children: [],
          }),
          route({
            path: "comments/$commentId",
            search({ params, urlSearchParams }) {
              return { search: urlSearchParams.get("search") ?? undefined };
            },
            children: [],
          }),
        ],
      }),
    ],
  });

  router.navigate({ path: "company/$companyId", params: { companyId: "1" } });
  router.navigate({
    path: "company/$companyId/user/$userId/post",
    params: {
      companyId: "1",
      userId: "2",
    },
  });
  router.navigate({
    path: "company/$companyId/user/$userId/post",
    params: { companyId: "", userId: "" },
  });
}

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
    children: [],
  });
  const { container } = render(<router.Render />);
  expect(container).toHaveTextContent("");
  act(() => {
    router.navigate({ path: "", params: {} });
  });
  expect(screen.getByText(/Heading/)).toBeInTheDocument();
});

test("router switches between two routes", async () => {
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
    children: [
      route({
        path: "a",
        render({ children }) {
          return <div>RouteA</div>;
        },
        children: [],
      }),
      route({
        path: "b",
        render({ children }) {
          return <div>RouteB</div>;
        },
        children: [],
      }),
    ],
  });
  render(<router.Render />);
  act(() => {
    router.navigate({ path: "", params: {} });
  });
  expect(screen.getByText(/Heading/)).toBeInTheDocument();
  act(() => {
    router.navigate({ path: "/a", params: {} });
  });
  expect(screen.getByText(/Heading/)).toBeInTheDocument();
  expect(screen.getByText(/RouteA/)).toBeInTheDocument();
  expect(screen.queryByText(/RouteB/)).not.toBeInTheDocument();
  act(() => {
    router.navigate({ path: "/b", params: {} });
  });
  expect(screen.getByText(/Heading/)).toBeInTheDocument();
  expect(screen.getByText(/RouteB/)).toBeInTheDocument();
  expect(screen.queryByText(/RouteA/)).not.toBeInTheDocument();
});

test("navigation works with clicks", async () => {
  const router = createRouter({
    path: "",
    render({ children }) {
      return (
        <>
          <nav>
            <button
              onClick={() => {
                router.navigate({ path: "/a", params: {} });
              }}
            >
              LinkA
            </button>
            <button
              onClick={() => {
                router.navigate({ path: "/b", params: {} });
              }}
            >
              LinkB
            </button>
          </nav>
          {children}
        </>
      );
    },
    children: [
      route({
        path: "a",
        render({ children }) {
          return <div>RouteA</div>;
        },
        children: [],
      }),
      route({
        path: "b",
        render({ children }) {
          return <div>RouteB</div>;
        },
        children: [],
      }),
    ],
  });
  render(<router.Render />);
  act(() => router.navigate({ path: "", params: {} }));
  userEvent.click(screen.getByText(/LinkA/));
  expect(await screen.findByText(/RouteA/)).toBeInTheDocument();
  expect(screen.queryByText(/RouteB/)).not.toBeInTheDocument();
  userEvent.click(screen.getByText(/LinkB/));
  expect(await screen.findByText(/RouteB/)).toBeInTheDocument();
  expect(screen.queryByText(/RouteA/)).not.toBeInTheDocument();
});

test("navigation works with links", async () => {
  const router = createRouter({
    path: "",
    render({ children }) {
      return (
        <>
          <nav>
            <router.Link path="/a" params={{}}>
              LinkA
            </router.Link>
            <router.Link path="/b" params={{}}>
              LinkB
            </router.Link>
          </nav>
          {children}
        </>
      );
    },
    children: [
      route({
        path: "a",
        render({ children }) {
          return <div>RouteA</div>;
        },
        children: [],
      }),
      route({
        path: "b",
        render({ children }) {
          return <div>RouteB</div>;
        },
        children: [],
      }),
    ],
  });
  render(<router.Render />);
  act(() => router.navigate({ path: "", params: {} }));
  userEvent.click(screen.getByText(/LinkA/));
  expect(await screen.findByText(/RouteA/)).toBeInTheDocument();
  expect(screen.queryByText(/RouteB/)).not.toBeInTheDocument();
  userEvent.click(screen.getByText(/LinkB/));
  expect(await screen.findByText(/RouteB/)).toBeInTheDocument();
  expect(screen.queryByText(/RouteA/)).not.toBeInTheDocument();
});
