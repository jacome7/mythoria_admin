declare module 'googleapis' {
  interface JWTOptions {
    email?: string;
    key?: string;
    scopes?: string | string[];
    subject?: string;
  }

  namespace google {
    namespace auth {
      class JWT {
        constructor(options: JWTOptions);
        authorize(): Promise<void>;
      }
    }

    function gmailpostmastertools(options: { version: 'v1'; auth?: auth.JWT }): {
      domains: {
        trafficStats: {
          list(params: { parent: string; pageSize?: number }): Promise<{
            data: { trafficStats?: unknown[] };
          }>;
          get(params: { name: string }): Promise<{
            data: unknown;
          }>;
        };
      };
    };
  }

  export { google };
}
