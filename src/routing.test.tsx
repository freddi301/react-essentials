import { Link, createRoute, createRouter } from "./routing";

// TODO fix: types
// TODO let it work with JSX syntax like react reouter dom

const router = createRouter({
  home: {
    render({ children }) {
      return (
        <div>
          <nav>
            <Link to={router["home"]}>Home</Link>
            <Link to={router["user/$userId"]} params={{ userId: "123" }}>
              User 123
            </Link>
            <Link to={postRoute} params={{ userId: "123", postId: "456" }}>
              Post 456
            </Link>
            <Link
              to={postsRoute}
              params={{ userId: "123" }}
              search={{ search: "foo" }}
            >
              Posts
            </Link>
            <Link to={commentsRoute} params={{ userId: "123", postId: "456" }}>
              Comments
            </Link>
            <Link
              to={commentRoute}
              params={{ userId: "123", postId: "456", commentId: "789" }}
            >
              Comment 789
            </Link>
          </nav>
          {children}
        </div>
      );
    },
    children: {
      "user/$userId": {},
      "user/$userId/post/$postId": {},
      "user/$userId/post": {},
      "user/$userId/post/$postId/comments": {
        render({ params: { userId, postId } }) {
          return (
            <div>
              <div>User {userId}</div>
              <div>Post {postId}</div>
            </div>
          );
        },
      },
      "user/$userId/post/$postId/comments/$commentId": {
        search(urlSearchParams) {
          if (urlSearchParams.has("search"))
            return { search: urlSearchParams.get("search")! };
          return {};
        },
      },
      $any: {
        render() {
          return <div>Not found</div>;
        },
      },
    },
  },
});
