import { GraphQLClient } from 'graphql-request';

const endpoint = process.env.NEXT_PUBLIC_HASURA_PROJECT_ENDPOINT || 'http://localhost:8080/v1/graphql';

export const hasuraClient = new GraphQLClient(endpoint, {
  headers: {
    'x-hasura-admin-secret': process.env.HASURA_ADMIN_SECRET || 'myadminsecret',
  },
});

export const fetchGraphQL = async (query: string, variables?: Record<string, unknown>) => {
  return hasuraClient.request(query, variables);
};
