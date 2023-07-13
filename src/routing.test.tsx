import { createRouter, route } from "./routing";

//       <div>
//         {/* <nav>
//           <Link to={router["home"]}>Home</Link>
//           <Link to={router["user/$userId"]} params={{ userId: "123" }}>
//             User 123
//           </Link>
//           <Link to={postRoute} params={{ userId: "123", postId: "456" }}>
//             Post 456
//           </Link>
//           <Link
//             to={postsRoute}
//             params={{ userId: "123" }}
//             search={{ search: "foo" }}
//           >
//             Posts
//           </Link>
//           <Link to={commentsRoute} params={{ userId: "123", postId: "456" }}>
//             Comments
//           </Link>
//           <Link
//             to={commentRoute}
//             params={{ userId: "123", postId: "456", commentId: "789" }}
//           >
//             Comment 789
//           </Link>
//         </nav> */}
//         {children}
//       </div>

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

const router = createRouter(
  route({
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
  })
);

router.navigate({ path: "company/$companyId/user/$userId/post" });
