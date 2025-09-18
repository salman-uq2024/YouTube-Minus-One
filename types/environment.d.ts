declare namespace NodeJS {
  interface ProcessEnv {
    YT_API_KEY?: string;
    UPSTASH_REDIS_REST_URL?: string;
    UPSTASH_REDIS_REST_TOKEN?: string;
    NEXT_PUBLIC_APP_NAME?: string;
  }
}

interface Process {
  env: NodeJS.ProcessEnv;
}

declare const process: Process;
