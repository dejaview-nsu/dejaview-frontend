import { createJsonQuery } from "@farfetched/core";

import { zodContract } from "@/shared/lib/contracts";

import { postSchema } from "./schema";

const POST_URL = "https://jsonplaceholder.typicode.com/posts/1";

export const createPostQuery = () =>
  createJsonQuery({
    request: {
      method: "GET",
      url: POST_URL,
    },
    response: {
      contract: zodContract(postSchema),
    },
  });
