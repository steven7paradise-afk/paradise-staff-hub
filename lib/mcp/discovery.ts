import { issuer, resource, MCP_SCOPE } from "./security";
export function protectedMetadata() {
  return Response.json({ resource: resource(), authorization_servers: [issuer()], scopes_supported: [MCP_SCOPE], bearer_methods_supported: ["header"], resource_name: "Paradise Staff Hub — dati operativi" }, { headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } });
}
export function authorizationMetadata() {
  return Response.json({ issuer: issuer(), authorization_endpoint: `${issuer()}/oauth/authorize`, token_endpoint: `${issuer()}/oauth/token`, registration_endpoint: `${issuer()}/oauth/register`, revocation_endpoint: `${issuer()}/oauth/revoke`, scopes_supported: [MCP_SCOPE], response_types_supported: ["code"], grant_types_supported: ["authorization_code", "refresh_token"], code_challenge_methods_supported: ["S256"], token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"] }, { headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } });
}
