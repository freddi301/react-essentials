/**
 * @jest-environment jsdom
 */
import React from "react";
import { createRouter, route } from "./router";
import { createResource } from "./client";

async function getData(x: string) {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  return "Hello" + x;
}

const dataResource = createResource(getData);

const { Router, Link, useRouterState } = createRouter(
  {
    path: "",
    render({ children }) {
      const { isPending } = useRouterState();
      return (
        <div>
          <nav>
            <Link path="/a">A</Link>,<Link path="/b">B</Link>
            {isPending && "TRANSITION"}
          </nav>
          {children}
        </div>
      );
    },
    children: (parent) => [
      route({
        path: "a",
        render() {
          const data = dataResource.useData("A");
          return <h1>A + {data}</h1>;
        },
        children: (parent) => undefined,
      }),
      route({
        path: "b",
        render() {
          return <p>b + {dataResource.read("B")}</p>;
        },
        children: (parent) => undefined,
      }),
    ],
  },
  {
    reactTransitionOnNavigate: true,
    documentViewTransitionOnNavigate: true,
  }
);

function App() {
  return (
    <React.Suspense fallback="loading">
      <Router />
    </React.Suspense>
  );
}

test.todo("test this visually");
