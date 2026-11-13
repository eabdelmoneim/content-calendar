import type { Metadata } from "next";
import { Suspense } from "react";

import { PostsPage } from "@/features/posts/posts-page";

export const metadata: Metadata = { title: "Posts" };

export default function PostsRoute(): React.JSX.Element {
  return (
    <Suspense fallback={null}>
      <PostsPage />
    </Suspense>
  );
}
