/**
 * @jest-environment jsdom
 */
import React from "react";
import { act, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import { createMutation, createResource } from "./client";

function example() {
  type User = {
    id: string;
    name: string;
  };

  // const customFetch = fetch;
  async function getUser({ id }: { id: string }): Promise<User> {
    const response = await fetch(`/api/users/${id}`);
    const data = await response.json();
    return data;
  }
  async function getUsers({
    ordering,
  }: {
    ordering: "ascending" | "descending";
  }): Promise<User[]> {
    const response = await fetch(`/api/users?ordering=${ordering}`);
    const data = await response.json();
    return data;
  }
  async function createUser(user: Omit<User, "id">): Promise<User> {
    const response = await fetch(`/api/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(user),
    });
    const data = await response.json();
    return data;
  }
  async function updateUser(user: User): Promise<User> {
    const response = await fetch(`/api/users/${user.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(user),
    });
    const data = await response.json();
    return data;
  }
  async function deleteUser({ id }: { id: string }): Promise<void> {
    const response = await fetch(`/api/users/${id}`, {
      method: "DELETE",
    });
    await response.json();
  }

  const userResource = createResource(getUser);
  const usersResource = createResource(getUsers);
  const createUserMutation = createMutation(createUser, {
    onSuccess() {
      usersResource.invalidateAll();
    },
  });
  const updateUserMutation = createMutation(updateUser, {
    onSuccess({ variables: { id } }) {
      userResource.invalidateExact({ id });
      usersResource.invalidateAll();
    },
  });
  const deleteUserMutation = createMutation(deleteUser, {
    onSuccess({ variables: { id } }) {
      userResource.invalidateExact({ id });
      usersResource.invalidateAll();
    },
  });
}

test("resource works with React.Suspense", async () => {
  async function getDouble(x: number) {
    return x * 2;
  }
  const doubleResource = createResource(getDouble);
  function Component() {
    const [count, setCount] = React.useState(0);
    const double = doubleResource.useData(count);
    return (
      <div>
        <div>Count: {count}</div>
        <button
          onClick={() => {
            setCount(count + 1);
          }}
        >
          Increase
        </button>
        <div>Double: {double}</div>
      </div>
    );
  }
  render(
    <React.Suspense fallback="loading">
      <Component />
    </React.Suspense>
  );
  expect(screen.getByText("loading")).toBeInTheDocument();
  expect(await screen.findByText("Count: 0")).toBeInTheDocument();
  expect(screen.getByText("Double: 0")).toBeInTheDocument();
  expect(screen.queryByText("loading")).not.toBeInTheDocument();
  userEvent.click(screen.getByText("Increase"));
  expect(await screen.findByText("loading")).toBeInTheDocument();
  expect(await screen.findByText("Count: 1")).toBeInTheDocument();
  expect(screen.getByText("Double: 2")).toBeInTheDocument();
  expect(screen.queryByText("loading")).not.toBeInTheDocument();
});

test("resource works with React.Suspense + React.useTransition", async () => {
  async function getDouble(x: number) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return x * 2;
  }
  const doubleResource = createResource(getDouble);
  function Component() {
    const [count, setCount] = React.useState(0);
    const double = doubleResource.useData(count);
    const [isPending, startTransition] = React.useTransition();
    return (
      <div>
        <div>Count: {count}</div>
        <div>Is pending: {isPending ? "true" : "false"}</div>
        <button
          onClick={() => {
            startTransition(() => {
              setCount(count + 1);
            });
          }}
        >
          Increase
        </button>
        <div>Double: {double}</div>
      </div>
    );
  }
  render(
    <React.Suspense fallback="loading">
      <Component />
    </React.Suspense>
  );
  expect(screen.getByText("loading")).toBeInTheDocument();
  expect(await screen.findByText("Count: 0")).toBeInTheDocument();
  expect(screen.getByText("Is pending: false")).toBeInTheDocument();
  expect(screen.getByText("Double: 0")).toBeInTheDocument();
  expect(screen.queryByText("loading")).not.toBeInTheDocument();
  userEvent.click(screen.getByText("Increase"));
  expect(screen.queryByText("loading")).not.toBeInTheDocument();
  expect(await screen.findByText("Is pending: true")).toBeInTheDocument();
  expect(screen.getByText("Count: 0")).toBeInTheDocument();
  expect(screen.getByText("Double: 0")).toBeInTheDocument();
  expect(screen.queryByText("loading")).not.toBeInTheDocument();
  expect(await screen.findByText("Is pending: false")).toBeInTheDocument();
  expect(screen.getByText("Count: 1")).toBeInTheDocument();
  expect(screen.getByText("Double: 2")).toBeInTheDocument();
  expect(screen.queryByText("loading")).not.toBeInTheDocument();
});

test("resources invalidated by a mutation are reloaded", async () => {
  type Entity = number;
  let entityPersistance: Entity = 0;
  function getEntity(): Promise<Entity> {
    return Promise.resolve(entityPersistance);
  }
  function updateEntity(entity: Entity): Promise<void> {
    entityPersistance = entity;
    return Promise.resolve();
  }
  const entityResource = createResource(getEntity);
  const entityUpdateMutation = createMutation(updateEntity, {
    onSuccess({ variables, data }) {
      entityResource.invalidateAll();
    },
  });
  function Component() {
    const entity = entityResource.useData(undefined);
    return (
      <div>
        <div>Entity: {entity}</div>
        <button
          onClick={() => {
            entityUpdateMutation.mutate(entity + 1);
          }}
        >
          update entity
        </button>
      </div>
    );
  }
  render(
    <React.Suspense>
      <Component />
    </React.Suspense>
  );
  expect(await screen.findByText("Entity: 0")).toBeInTheDocument();
  userEvent.click(screen.getByText("update entity"));
  expect(await screen.findByText("Entity: 1")).toBeInTheDocument();
  userEvent.click(screen.getByText("update entity"));
  expect(await screen.findByText("Entity: 2")).toBeInTheDocument();
});
