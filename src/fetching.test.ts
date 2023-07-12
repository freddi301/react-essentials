import React from "react";
import { createClient, useMutation, useQuery } from "./fetching";

type User = {
  id: string;
  name: string;
};

const customFetch = fetch;
const client = createClient({
  queries: {
    user: {
      async resolve({ id }: { id: string }): Promise<User> {
        const response = await customFetch(`/api/users/${id}`);
        const data = await response.json();
        return data;
      },
    },
    users: {
      async resolve({ ordering }: { ordering?: "ascending" | "descending" }) {
        const response = await customFetch(`/api/users?ordering=${ordering}`);
        const data = await response.json();
        return data;
      },
    },
  },
  mutations: {
    createUser: {
      async perform(user: Omit<User, "id">): Promise<User> {
        const response = await customFetch(`/api/users`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(user),
        });
        const data = await response.json();
        return data;
      },
    },
    updateUser: {
      async perform({ id, ...info }: User): Promise<User> {
        const response = await customFetch(`/api/users/${id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(info),
        });
        const data = await response.json();
        return data;
      },
    },
    deleteUser: {
      async perform({ id }: { id: string }): Promise<void> {
        const response = await customFetch(`/api/users/${id}`, {
          method: "DELETE",
        });
        await response.json();
      },
    },
  },
});

const ClientContext = React.createContext(client);

function MyComponent() {
  const client = React.useContext(ClientContext);
  const userQuery = useQuery({ client, variables: ["user", { id: "1" }] });
  const usersQuery = useQuery({
    client,
    variables: ["users", { ordering: "ascending" }],
  });
  const [userData, setUserData] = React.useState<Omit<User, "id"> | undefined>(
    undefined
  );
  const createUserMutation = useMutation({
    client,
    variables: userData && ["createUser", userData],
  });
  client.invalidate(["users", {}]);
  if (userData) {
    client.mutate({ variables: ["createUser", userData] });
  }
  console.log(userQuery.current.data);
  console.log(usersQuery.current.isLoading);
  console.log(
    userQuery.current.data ?? userQuery.previous?.data ?? "loading..."
  );
  console.log(createUserMutation.pending);
  if (createUserMutation.pending.length === 0 && userData) {
    client.mutate({ variables: ["createUser", userData] });
  }
}
